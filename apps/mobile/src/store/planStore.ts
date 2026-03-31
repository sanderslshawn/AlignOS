/**
 * PLAN STATE MANAGER
 * Single source of truth for plan generation, event mutations, and sync.
 * Handles local offline computation and API sync when available.
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type * as Calendar from 'expo-calendar';
import type {
  UserProfile,
  DayState,
  Event,
  MealEvent,
  WalkEvent,
  ConstraintBlock,
  EngineInput,
  EngineOutput,
  ScheduleItem,
  DayPlan,
} from '@physiology-engine/shared';
import { generatePlan } from '@physiology-engine/engine';
import { format, addMinutes } from 'date-fns';
import { getApiBaseUrl } from '../utils/apiBaseUrl';
import { buildTimelinePlan } from '../utils/planGenerator';
import { applyScheduleMutation } from '../engine/applyScheduleMutation';
import { buildDaySchedule } from '../engine/buildDaySchedule';
import { buildAnchorConflictRecommendations, stableSortTimeline as stableSortTimelineEngine, type AnchorRecommendationAction } from '../engine/anchorPlanning';
import { canDeleteScheduleItem } from '../engine/normalizeTimeline';
import { clockTimeFromISO, parseClockTime, toISOWithClockTime } from '../utils/clockTime';
import type { MutationIntent } from '../types/mutationIntent';
import {
  ensureStartEnd,
  minutesToHHmm,
  parseTimeToMinutes,
} from '../utils/time';
import { normalizeQuickStatusSignals, type QuickStatusSignal } from '../types/quickStatus';
import { getMajorSettingsFingerprint } from '../utils/shouldPromptRefresh';
import { shouldAutoRecomputeFromNow } from '../utils/shouldAutoRecomputeFromNow';
import { dedupeBehaviorBlocks } from '../utils/dedupeBehaviorBlocks';

// Simple UUID generator (fallback if expo-crypto not available)
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : ((r & 0x3) | 0x8);
    return v.toString(16);
  });
}

export type SyncStatus = 'offline' | 'syncing' | 'synced' | 'error';

export interface TomorrowPreview {
  dateISO: string;
  wakeTime: string;
  sleepTime: string;
  workStartTime?: string;
  workEndTime?: string;
  anchors: Array<{ title: string; time: string }>;
  items?: ScheduleItem[];
  suggestions?: string[];
  predictive?: {
    predictedDayMode: string;
    bestFocusWindow: string;
    likelyDipWindow: string;
    bestOpportunityWindow: string;
    topRisk: string;
    bestMove: string;
  };
  generated: boolean;
}

interface PlanState {
  deviceId: string | null;
  profile: UserProfile | null;
  dayState: DayState | null;
  computedPlan: EngineOutput | null;

  todayEntries: ScheduleItem[];
  fullDayPlan: DayPlan | null;
  pendingRecommendations: AnchorRecommendationAction[];
  pendingAnchorRecommendations: AnchorRecommendationAction[];
  todayPlanSettingsFingerprint: string | null;
  initialized: boolean;
  // If true, generatePlan/generateFullDayPlan should run in deferred init
  needsInitialPlanGeneration?: boolean;

  syncStatus: SyncStatus;
  lastSyncAt: Date | null;
  syncError: string | null;

  autoRefreshEnabled: boolean;
  autoRefreshIntervalMs: number;

  initialize: () => Promise<void>;
  loadProfile: () => Promise<UserProfile | null>;
  saveProfile: (profile: UserProfile) => Promise<void>;

  generatePlan: (forceRecompute?: boolean) => Promise<void>;
  generateFullDayPlan: (options?: {
    intent?: MutationIntent;
    baseItems?: ScheduleItem[];
    beforeItems?: ScheduleItem[];
    deletedItemId?: string;
  }) => Promise<void>;
  refreshFromNow: () => Promise<void>;
  checkStaleness: () => 'FRESH' | 'AGING' | 'STALE' | 'CRITICAL';
  setupToday: (dayState: Partial<DayState>) => Promise<void>;

  addTodayEntry: (entry: Omit<ScheduleItem, 'id'>) => Promise<string>;
  setTodayEntries: (entries: ScheduleItem[]) => Promise<void>;
  updateTodayEntry: (id: string, updates: Partial<ScheduleItem>) => Promise<void>;
  deleteTodayEntry: (id: string) => Promise<void>;
  getTomorrowPreview: () => Promise<TomorrowPreview>;

  addEvent: (event: Event) => Promise<void>;
  updateEvent: (eventId: string, updates: Partial<Event>) => Promise<void>;
  markDone: (eventId: string) => Promise<void>;
  markSkipped: (eventId: string) => Promise<void>;
  deleteEvent: (eventId: string) => Promise<void>;

  delayMeal: (mealId: string, minutes: number) => Promise<void>;
  addComfortMeal: (time: Date) => Promise<void>;
  addMeetingBlock: (start: Date, end: Date, description?: string) => Promise<void>;
  shortenWalk: (walkId: string, newDuration: number) => Promise<void>;
  setStress: (level: number) => Promise<void>;
  setSleep: (level: number) => Promise<void>;
  setQuickStatusSignals: (signals: QuickStatusSignal[]) => Promise<void>;
  applyRecommendation: (recommendationId: string) => Promise<void>;
  applyAllRecommendations: () => Promise<void>;
  declineRecommendation: (recommendationId: string) => void;
  declineAllRecommendations: () => void;
  applyAnchorRecommendation: (recommendationId: string) => Promise<void>;
  applyAllAnchorRecommendations: () => Promise<void>;
  clearAnchorRecommendations: () => void;

  syncToAPI: () => Promise<void>;
  enableAutoRefresh: () => void;
  disableAutoRefresh: () => void;
  importCalendarEvents: () => Promise<void>;
  // Calendar sync state & actions
  calendarPermissionStatus?: 'granted' | 'denied' | 'undetermined';
  selectedCalendarIds?: string[];
  calendarSyncEnabled?: boolean;
  lastCalendarSyncAt?: string | null;

  requestCalendarPermission: () => Promise<boolean>;
  loadAvailableCalendars: () => Promise<Array<{ id: string; title: string; color?: string }>>;
  setSelectedCalendarIds: (ids: string[]) => Promise<void>;
  setCalendarSyncEnabled: (enabled: boolean) => Promise<void>;
  syncCalendarEvents: (range?: 'today' | 'tomorrow' | 'today_and_tomorrow') => Promise<void>;
  removeImportedCalendarEvent: (externalEventId: string) => Promise<void>;
  maybeRefreshCalendarOnAppOpen: () => Promise<void>;
  runDeferredInitializations?: () => Promise<void>;
}

const API_BASE_URL = getApiBaseUrl();
const API_TIMEOUT = 5000;

function migrateProfileTimes(profile: UserProfile): UserProfile {
  const wakeMin = profile.wakeMin ?? parseTimeToMinutes(profile.wakeTime) ?? 420;
  const sleepMin = profile.sleepMin ?? parseTimeToMinutes(profile.sleepTime) ?? 1380;
  const workStartMin = profile.workStartMin ?? parseTimeToMinutes(profile.workStartTime);
  const workEndMin = profile.workEndMin ?? parseTimeToMinutes(profile.workEndTime);
  const lunchStartMin = profile.lunchStartMin ?? parseTimeToMinutes(profile.lunchTime);
  const wakeClockTime = profile.wakeClockTime ?? parseClockTime(profile.wakeTime);
  const sleepClockTime = profile.sleepClockTime ?? parseClockTime(profile.sleepTime);
  const workStartClockTime = profile.workStartClockTime ?? parseClockTime(profile.workStartTime);
  const workEndClockTime = profile.workEndClockTime ?? parseClockTime(profile.workEndTime);
  const lunchClockTime = profile.lunchClockTime ?? parseClockTime(profile.lunchTime);

  return {
    ...profile,
    wakeMin,
    sleepMin,
    workStartMin: workStartMin ?? undefined,
    workEndMin: workEndMin ?? undefined,
    lunchStartMin: lunchStartMin ?? undefined,
    wakeTime: minutesToHHmm(wakeMin),
    sleepTime: minutesToHHmm(sleepMin),
    workStartTime:
      workStartMin !== null && workStartMin !== undefined ? minutesToHHmm(workStartMin) : profile.workStartTime,
    workEndTime:
      workEndMin !== null && workEndMin !== undefined ? minutesToHHmm(workEndMin) : profile.workEndTime,
    lunchTime:
      lunchStartMin !== null && lunchStartMin !== undefined ? minutesToHHmm(lunchStartMin) : profile.lunchTime,
    wakeClockTime: wakeClockTime || undefined,
    sleepClockTime: sleepClockTime || undefined,
    workStartClockTime: workStartClockTime || undefined,
    workEndClockTime: workEndClockTime || undefined,
    lunchClockTime: lunchClockTime || undefined,
  };
}

function normalizeScheduleEntries(entries: ScheduleItem[]): ScheduleItem[] {
  const dateISO = format(new Date(), 'yyyy-MM-dd');

  const normalizedEntries: ScheduleItem[] = entries.map((entry) => {
    const normalizedTime = ensureStartEnd(entry);
    const startTime = entry.startTime || clockTimeFromISO(entry.startISO);
    const endTime = entry.endTime || (entry.endISO ? clockTimeFromISO(entry.endISO) : undefined);

    const status: ScheduleItem['status'] =
      entry.status === 'actual' || entry.status === 'skipped' || entry.status === 'adjusted'
        ? entry.status
        : entry.status === 'auto_adjusted'
          ? 'adjusted'
          : 'planned';

    const source: ScheduleItem['source'] =
      entry.source === 'user' || entry.source === 'advisor' || entry.source === 'system'
        ? entry.source
        : entry.source === 'advisor_added'
          ? 'advisor'
          : entry.source === 'user_added'
            ? 'user'
            : 'system';

    const legacyIsAnchor = Boolean(entry.meta && (entry.meta as any).isAnchor);
    const isSystemAnchor = Boolean(
      entry.isSystemAnchor ||
      entry.type === 'wake' ||
      entry.type === 'sleep' ||
      (entry.type === 'work' && (
        (entry.title || '').toLowerCase().includes('work start') ||
        (entry.title || '').toLowerCase().includes('work end')
      ))
    );
    const isFixedAnchor = Boolean(
      entry.isFixedAnchor ||
      entry.fixed ||
      (legacyIsAnchor && isSystemAnchor)
    );

    return {
      ...normalizedTime,
      startTime: startTime || undefined,
      endTime: endTime || undefined,
      // Preserve explicit ISO timestamps when present (e.g., imported calendar
      // events). Only synthesize an ISO using the local `dateISO` when an
      // ISO is not available but a clock-time was provided.
      startISO: entry.startISO ? entry.startISO : (startTime ? toISOWithClockTime(dateISO, startTime) : entry.startISO),
      endISO: entry.endISO ? entry.endISO : (endTime ? toISOWithClockTime(dateISO, endTime) : entry.endISO),
      status,
      source,
      isSystemAnchor,
      isFixedAnchor,
      fixed: isFixedAnchor,
      locked: isSystemAnchor ? true : Boolean(entry.locked),
      deletable: canDeleteScheduleItem({ ...entry, isSystemAnchor }),
      meta: {
        ...(entry.meta || {}),
        isAnchor: isSystemAnchor,
      },
      createdAt: entry.createdAt || new Date().toISOString(),
      updatedAt: entry.updatedAt || new Date().toISOString(),
    } as ScheduleItem;
  });

  const sorted = stableSortTimeline(normalizedEntries);

  const applyMinutesToIso = (baseISO: string, minutesFromMidnight: number): string => {
    const datePart = (baseISO || new Date().toISOString()).split('T')[0];
    const normalized = ((Math.round(minutesFromMidnight) % (24 * 60)) + (24 * 60)) % (24 * 60);
    const hours = Math.floor(normalized / 60);
    const minutes = normalized % 60;
    const [y, m, d] = datePart.split('-').map((v) => Number(v));
    const local = new Date(y, m - 1, d, hours, minutes, 0, 0);
    return local.toISOString();
  };

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const current = sorted[i];

    const prevEndMin = ensureStartEnd(prev).endMin;
    const currentNormalized = ensureStartEnd(current);
    const currentStartMin = currentNormalized.startMin;

    if (currentStartMin < prevEndMin) {
      const durationMin = Math.max(5, currentNormalized.endMin - currentStartMin);
      const pushedStartMin = prevEndMin;
      const pushedEndMin = pushedStartMin + durationMin;

      sorted[i] = {
        ...current,
        startMin: pushedStartMin,
        endMin: pushedEndMin,
        durationMin,
        startISO: applyMinutesToIso(current.startISO, pushedStartMin),
        endISO: applyMinutesToIso(current.endISO, pushedEndMin),
      };
    }
  }

  return sorted;
}

function stableSortTimeline(items: ScheduleItem[]): ScheduleItem[] {
  return stableSortTimelineEngine(items);
}

function signatureForDeleteGuard(item: Pick<ScheduleItem, 'type' | 'title' | 'startMin' | 'startISO' | 'startTime'>): string {
  const normalizedTitle = (item.title || '').trim().toLowerCase();
  const minuteFromIso =
    typeof item.startISO === 'string' && item.startISO.includes('T')
      ? (() => {
          const d = new Date(item.startISO);
          if (Number.isNaN(d.getTime())) return undefined;
          return d.getHours() * 60 + d.getMinutes();
        })()
      : undefined;
  const minuteFromTime = item.startTime
    ? (((item.startTime.period === 'PM' ? (item.startTime.hour % 12) + 12 : item.startTime.hour % 12) * 60) +
        item.startTime.minute)
    : undefined;
  const startMinute = item.startMin ?? minuteFromIso ?? minuteFromTime ?? 0;
  return `${item.type}|${normalizedTitle}|${startMinute}`;
}

function applyDeleteSafetyGuard(
  beforeItems: ScheduleItem[],
  afterItems: ScheduleItem[],
  deletedItemId?: string
): { items: ScheduleItem[]; insertedCount: number; blockedCount: number } {
  const beforeSignatures = new Set(beforeItems.map((item) => signatureForDeleteGuard(item)));

  const unexpectedInserted = afterItems.filter((item) => {
    if (!canDeleteScheduleItem(item)) return false;
    if (deletedItemId && item.id === deletedItemId) return true;
    return !beforeSignatures.has(signatureForDeleteGuard(item));
  });

  if (!unexpectedInserted.length) {
    return { items: afterItems, insertedCount: 0, blockedCount: 0 };
  }

  const unexpectedSignatures = new Set(unexpectedInserted.map((item) => signatureForDeleteGuard(item)));
  const blockedItems = afterItems.filter((item) => {
    if (!canDeleteScheduleItem(item)) return false;
    if (deletedItemId && item.id === deletedItemId) return true;
    return unexpectedSignatures.has(signatureForDeleteGuard(item));
  });

  const guardedItems = afterItems.filter((item) => !blockedItems.some((blocked) => blocked.id === item.id));

  return {
    items: guardedItems,
    insertedCount: unexpectedInserted.length,
    blockedCount: blockedItems.length,
  };
}

function getWorkingSchedule(fullDayPlan: DayPlan | null, todayEntries: ScheduleItem[]): ScheduleItem[] {
  if (todayEntries?.length) {
    return normalizeScheduleEntries(todayEntries);
  }
  if (fullDayPlan?.items?.length) {
    return normalizeScheduleEntries(fullDayPlan.items);
  }
  return [];
}

function hasMeaningfulScheduleItems(items: ScheduleItem[]): boolean {
  return items.some(
    (item) =>
      canDeleteScheduleItem(item) &&
      item.notes !== 'deleted-marker'
  );
}

let autoRecomputeTimer: NodeJS.Timeout | null = null;
let lastAutoRecomputeAt = 0;
const AUTO_RECOMPUTE_DEBOUNCE_MS = 900;
const AUTO_RECOMPUTE_THROTTLE_MS = 4000;

function scheduleAutoRecomputeFromNow(run: () => Promise<void>) {
  if (autoRecomputeTimer) {
    clearTimeout(autoRecomputeTimer);
  }

  autoRecomputeTimer = setTimeout(() => {
    const elapsed = Date.now() - lastAutoRecomputeAt;
    if (elapsed < AUTO_RECOMPUTE_THROTTLE_MS) {
      return;
    }

    lastAutoRecomputeAt = Date.now();
    run().catch((error) => {
      console.warn('[PlanStore] Auto recompute-from-now failed', error);
    });
  }, AUTO_RECOMPUTE_DEBOUNCE_MS);
}

export const usePlanStore = create<PlanState>((set, get) => ({
  deviceId: null,
  profile: null,
  dayState: null,
  computedPlan: null,
  todayEntries: [],
  fullDayPlan: null,
  pendingRecommendations: [],
  pendingAnchorRecommendations: [],
  todayPlanSettingsFingerprint: null,
  initialized: false,
  syncStatus: 'offline',
  lastSyncAt: null,
  syncError: null,
  autoRefreshEnabled: true,
  autoRefreshIntervalMs: 60000,

  initialize: async () => {
    try {
      let deviceId = await AsyncStorage.getItem('deviceId');
      if (!deviceId) {
        deviceId = generateUUID();
        await AsyncStorage.setItem('deviceId', deviceId);
      }

      let profile = await get().loadProfile();

      if (!profile) {
        const oldAppState = await AsyncStorage.getItem('appState');
        if (oldAppState) {
          const parsed = JSON.parse(oldAppState);
          if (parsed.userProfile) {
            profile = parsed.userProfile;
            await AsyncStorage.setItem('userProfile', JSON.stringify(profile));
          }
        }
      }

      if (profile) {
        profile = migrateProfileTimes(profile);
        await AsyncStorage.setItem('userProfile', JSON.stringify(profile));
      }

      const dateKey = format(new Date(), 'yyyy-MM-dd');
      let dayState: DayState | null = null;

      const dayStateJson = await AsyncStorage.getItem(`dayState_${dateKey}`);
      if (dayStateJson) {
        dayState = JSON.parse(dayStateJson, (key, value) => {
          if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
            return new Date(value);
          }
          return value;
        });
      }

      if (!dayState) {
        const oldAppState = await AsyncStorage.getItem('appState');
        if (oldAppState) {
          const parsed = JSON.parse(oldAppState, (key, value) => {
            if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
              return new Date(value);
            }
            return value;
          });
          if (parsed.dayState) {
            dayState = {
              ...parsed.dayState,
              deviceId,
              dateKey,
              events: parsed.dayState.events || [],
              computedPlan: parsed.dayState.computedPlan || [],
            };
          }
        }
      }

      const fullDayPlanJson = await AsyncStorage.getItem(`fullDayPlan_${dateKey}`);
      let fullDayPlan: DayPlan | null = null;
      if (fullDayPlanJson) {
        fullDayPlan = JSON.parse(fullDayPlanJson);
      }

      let todayEntries: ScheduleItem[] = [];
      const todayEntriesJson = await AsyncStorage.getItem(`todayEntries_${dateKey}`);
      if (todayEntriesJson) {
        todayEntries = normalizeScheduleEntries(JSON.parse(todayEntriesJson));
      }

      const todayPlanSettingsFingerprint = await AsyncStorage.getItem(`planProfileFingerprint_${dateKey}`);

      set({
        deviceId,
        profile,
        dayState,
        todayEntries,
        fullDayPlan,
        todayPlanSettingsFingerprint,
        initialized: true,
        needsInitialPlanGeneration: !!(profile && dayState && !fullDayPlan),
      });

      // load persisted calendar selection and sync state
      try {
        const storedSelected = await AsyncStorage.getItem('calendar_selected_ids');
        if (storedSelected) {
          const ids = JSON.parse(storedSelected || '[]');
          set({ selectedCalendarIds: ids });
        }
        const lastSync = await AsyncStorage.getItem('calendar_last_sync');
        if (lastSync) set({ lastCalendarSyncAt: lastSync });
        const syncEnabled = await AsyncStorage.getItem('calendar_sync_enabled');
        if (syncEnabled) set({ calendarSyncEnabled: syncEnabled === 'true' });
      } catch (err) {
        console.warn('[PlanStore] failed to load calendar prefs', err);
      }

      // NOTE: heavy plan generation moved to deferred initialization
      // if a fullDayPlan is missing we mark that generation should occur later
      // (see `runDeferredInitializations`)
    } catch (error) {
      console.error('[PlanStore] Initialize error:', error);
      set({ syncStatus: 'error', syncError: String(error), initialized: true });
    }
  },

  loadProfile: async () => {
    const profileJson = await AsyncStorage.getItem('userProfile');
    if (profileJson) {
      return migrateProfileTimes(JSON.parse(profileJson));
    }
    return null;
  },

  saveProfile: async (profile: UserProfile) => {
    const normalizedProfile = migrateProfileTimes(profile);
    await AsyncStorage.setItem('userProfile', JSON.stringify(normalizedProfile));
    set({ profile: normalizedProfile });
  },

  setupToday: async (dayStateInput: Partial<DayState>) => {
    const { deviceId, profile } = get();

    if (!profile) {
      console.error('[PlanStore] Cannot setup day without profile');
      return;
    }

    const now = new Date();
    const dateKey = format(now, 'yyyy-MM-dd');
    const quickStatusSignals = normalizeQuickStatusSignals((dayStateInput as any)?.quickStatusSignals);

    const dayState: DayState = {
      deviceId: deviceId || 'unknown',
      dateKey,
      date: now,
      dayMode: dayStateInput.dayMode || profile.defaultDayMode || 'flex',
      currentTime: now,
      sleepQuality: dayStateInput.sleepQuality || 7,
      stressLevel: dayStateInput.stressLevel || profile.stressBaseline || 5,
      isHungry: dayStateInput.isHungry || quickStatusSignals.includes('hungry-now') || false,
      isCraving: dayStateInput.isCraving || quickStatusSignals.includes('craving-comfort') || false,
      events: dayStateInput.events || [],
      constraints: dayStateInput.constraints || [],
      plannedMeals: dayStateInput.plannedMeals || [],
      plannedCaffeine: dayStateInput.plannedCaffeine || [],
      plannedWalks: dayStateInput.plannedWalks || [],
      plannedWorkouts: dayStateInput.plannedWorkouts || [],
      plannedActivations: dayStateInput.plannedActivations || [],
      completedEvents: dayStateInput.completedEvents || [],
      removedStepIds: dayStateInput.removedStepIds || [],
      modifiedEvents: dayStateInput.modifiedEvents || {},
      computedPlan: [],
    };

    (dayState as any).quickStatusSignals = quickStatusSignals;

    await AsyncStorage.setItem(`dayState_${dateKey}`, JSON.stringify(dayState));
    set({ dayState });

    await get().generatePlan(true);
    await get().generateFullDayPlan({
      intent: 'REGENERATE',
      baseItems: [],
    });
  },

  importCalendarEvents: async () => {
    await get().syncCalendarEvents('today');
  },

  // Calendar operations
  requestCalendarPermission: async () => {
    try {
      const CalendarModule = await import('expo-calendar');
      const { status } = await CalendarModule.requestCalendarPermissionsAsync();
      const granted = status === 'granted';
      set({ calendarPermissionStatus: granted ? 'granted' : 'denied' });
      return granted;
    } catch (err) {
      console.warn('[PlanStore] requestCalendarPermission failed', err);
      set({ calendarPermissionStatus: 'denied' });
      return false;
    }
  },

  loadAvailableCalendars: async () => {
    try {
      const CalendarModule = await import('expo-calendar');
      const calendars = await CalendarModule.getCalendarsAsync(CalendarModule.EntityTypes.EVENT);
      return calendars.map((c) => ({ id: c.id, title: c.title, color: (c as any).color }));
    } catch (err) {
      console.warn('[PlanStore] loadAvailableCalendars failed', err);
      return [];
    }
  },

  setSelectedCalendarIds: async (ids: string[]) => {
    try {
      await AsyncStorage.setItem('calendar_selected_ids', JSON.stringify(ids || []));
      set({ selectedCalendarIds: ids });
    } catch (err) {
      console.warn('[PlanStore] setSelectedCalendarIds failed', err);
    }
  },

  setCalendarSyncEnabled: async (enabled: boolean) => {
    try {
      await AsyncStorage.setItem('calendar_sync_enabled', enabled ? 'true' : 'false');
      set({ calendarSyncEnabled: enabled });
    } catch (err) {
      console.warn('[PlanStore] setCalendarSyncEnabled failed', err);
    }
  },

  syncCalendarEvents: async (range = 'today') => {
    try {
      const ids = get().selectedCalendarIds || [];
      const now = new Date();
      const ranges: Array<{ start: Date; end: Date }> = [];
      const startToday = new Date(now); startToday.setHours(0,0,0,0);
      const endToday = new Date(now); endToday.setHours(23,59,59,999);
      const tomorrow = new Date(now); tomorrow.setDate(now.getDate()+1);
      const startTomorrow = new Date(tomorrow); startTomorrow.setHours(0,0,0,0);
      const endTomorrow = new Date(tomorrow); endTomorrow.setHours(23,59,59,999);

      if (range === 'today' || range === 'today_and_tomorrow') ranges.push({ start: startToday, end: endToday });
      if (range === 'tomorrow' || range === 'today_and_tomorrow') ranges.push({ start: startTomorrow, end: endTomorrow });

      for (const r of ranges) {
        const events = await importCalendarEventsForRange(r.start, r.end, ids);
        for (const evt of events) {
          const exists = (get().todayEntries || []).find((e) => (e.meta as any)?.externalEventId === (evt.meta as any).externalEventId && (e.meta as any).calendarId === (evt.meta as any).calendarId);
          if (exists) {
            await get().updateTodayEntry(exists.id, {
              title: evt.title,
              startISO: evt.startISO,
              endISO: evt.endISO,
              startMin: evt.startMin,
              endMin: evt.endMin,
              durationMin: evt.durationMin,
              meta: { ...(exists.meta || {}), ...(evt.meta || {}), lastSyncedAt: new Date().toISOString() },
            } as any);
          } else {
            try {
              await get().addTodayEntry(evt as any);
            } catch (err) {
              console.warn('[PlanStore] syncCalendarEvents add failed', err);
            }
          }
        }
      }

      const nowIso = new Date().toISOString();
      await AsyncStorage.setItem('calendar_last_sync', nowIso);
      set({ lastCalendarSyncAt: nowIso });
    } catch (err) {
      console.warn('[PlanStore] syncCalendarEvents failed', err);
    }
  },

  removeImportedCalendarEvent: async (externalEventId: string) => {
    try {
      const items = get().todayEntries || [];
      const target = items.find((i) => (i.meta as any)?.externalEventId === externalEventId && (i.meta as any)?.isImported);
      if (target) {
        await get().deleteTodayEntry(target.id);
      }
    } catch (err) {
      console.warn('[PlanStore] removeImportedCalendarEvent failed', err);
    }
  },

  maybeRefreshCalendarOnAppOpen: async () => {
    try {
      const enabled = get().calendarSyncEnabled;
      if (!enabled) return;
      await get().requestCalendarPermission();
      await get().syncCalendarEvents('today');
    } catch (err) {
      console.warn('[PlanStore] maybeRefreshCalendarOnAppOpen failed', err);
    }
  },

  // Deferred initializations that may be heavy or should not block first render.
  runDeferredInitializations: async () => {
    try {
      // If plan generation was deferred, run it now
      if (get().needsInitialPlanGeneration) {
        try {
          await get().generatePlan(true);
        } catch (err) {
          console.warn('[PlanStore] deferred generatePlan failed', err);
        }
        try {
          await get().generateFullDayPlan({ intent: 'REGENERATE', baseItems: [] });
        } catch (err) {
          console.warn('[PlanStore] deferred generateFullDayPlan failed', err);
        }
        set({ needsInitialPlanGeneration: false });
      }

      // Calendar auto-sync only if user previously enabled it and permission is already granted.
      try {
        const enabled = get().calendarSyncEnabled;
        const perm = get().calendarPermissionStatus;
        if (enabled && perm === 'granted') {
          // run sync but do not request permissions here
          await get().syncCalendarEvents('today');
        }
      } catch (err) {
        console.warn('[PlanStore] deferred calendar auto-sync failed', err);
      }
    } catch (err) {
      console.warn('[PlanStore] runDeferredInitializations failed', err);
    }
  },

  generatePlan: async (forceRecompute = false) => {
    const { profile, dayState, syncToAPI } = get();

    if (!profile) {
      console.warn('[PlanStore] Cannot generate plan without profile');
      return;
    }

    if (!dayState) {
      console.warn('[PlanStore] No day state found. Please set up today first.');
      return;
    }

    try {
      const input: EngineInput = {
        now: new Date(),
        profile,
        dayState,
        options: {
          forceRecompute,
          stalenessThresholdMinutes: 15,
        },
      };

      const output = generatePlan(input);

      const updatedDayState: DayState = {
        ...dayState,
        lastComputedAt: new Date(),
        computedPlan: output.scheduleItems,
        planMeta: {
          mode: dayState.dayMode,
          score: output.score,
          dayOneLiner: output.dayInOneLine,
          warnings: output.warnings,
        },
      };

      const dateKey = format(new Date(), 'yyyy-MM-dd');
      await AsyncStorage.setItem(`dayState_${dateKey}`, JSON.stringify(updatedDayState));

      set({
        dayState: updatedDayState,
        computedPlan: output,
        syncStatus: 'synced',
      });

      syncToAPI().catch((err) => {
        console.warn('[PlanStore] Background sync failed:', err);
      });
    } catch (error) {
      console.error('[PlanStore] Generate plan error:', error);
      set({ syncStatus: 'error', syncError: String(error) });
    }
  },

  checkStaleness: () => {
    const { computedPlan } = get();
    if (!computedPlan || !computedPlan.recomputeHints) {
      return 'CRITICAL';
    }
    return computedPlan.recomputeHints.staleness;
  },

  refreshFromNow: async () => {
    const { profile, fullDayPlan, todayEntries } = get();
    if (!profile) return;

    const baseItems = stableSortTimeline(getWorkingSchedule(fullDayPlan, todayEntries));
    if (!baseItems.length) return;

    await get().generateFullDayPlan({
      intent: 'RECOMPUTE_FROM_NOW',
      baseItems,
    });
  },

  generateFullDayPlan: async (options) => {
    const { profile, todayEntries, dayState, fullDayPlan } = get();

    if (!profile) {
      console.warn('[PlanStore] Cannot generate full day plan without profile');
      return;
    }

    try {
      const dateISO = format(new Date(), 'yyyy-MM-dd');
      const canonicalTodayEntries = normalizeScheduleEntries(todayEntries);
      const canonicalBaseItems = normalizeScheduleEntries(
        options?.baseItems ?? getWorkingSchedule(fullDayPlan, canonicalTodayEntries)
      );

      const requestedIntent = options?.intent;
      const hasMeaningfulBaseItems = hasMeaningfulScheduleItems(canonicalBaseItems);

      const shouldForceRegenerate =
        !hasMeaningfulBaseItems &&
        (
          requestedIntent === undefined ||
          requestedIntent === 'EDIT' ||
          requestedIntent === 'ADD' ||
          requestedIntent === 'SELF_HEAL'
        );

      const intent: MutationIntent =
        shouldForceRegenerate
          ? 'REGENERATE'
          : (requestedIntent ?? (hasMeaningfulBaseItems ? 'EDIT' : 'REGENERATE'));

      const resolvedIntent: MutationIntent = intent === 'DELETE' ? 'DELETE_VALIDATE_ONLY' : intent;

      const beforeItems = options?.beforeItems;
      const deletedItemId = options?.deletedItemId;
      const isDeleteIntent = resolvedIntent === 'DELETE_VALIDATE_ONLY';

      if (isDeleteIntent) {
        console.log('[PlanStore][DeleteTrace] generateFullDayPlan start', {
          intent: resolvedIntent,
          sourceCount: canonicalBaseItems.length,
          beforeCount: beforeItems?.length ?? 0,
          deletedItemId,
        });
      }

      let builtPlan: DayPlan;

      try {
        // collect suppression markers from today's entries so buildDaySchedule can honor them
        const deletionMarkers = canonicalTodayEntries.filter((item) => item.notes === 'deleted-marker');
        const suppressedIds = deletionMarkers.map((d) => (d.meta && (d.meta as any).suppressedId) || undefined).filter(Boolean) as string[];
        const suppressedKeys = deletionMarkers.map((d) => (d.meta && (d.meta as any).suppressedKey) || undefined).filter(Boolean) as string[];
        const suppressedExactKeys = deletionMarkers.map((d) => (d.meta && (d.meta as any).suppressedExactKey) || undefined).filter(Boolean) as string[];

        builtPlan = isDeleteIntent
            ? {
                dateISO,
                items: buildDaySchedule({
                  dateISO,
                  settings: profile,
                  existingItems: canonicalBaseItems,
                  intent: 'DELETE',
                  validateOnly: true,
                  suppressedIds,
                  suppressedKeys,
                  suppressedExactKeys,
                }),
                summary: 'Delete applied (validate-only)',
                recommendations: [],
              }
          : buildTimelinePlan({
              dateISO,
              settings: profile,
              todayEntries: canonicalTodayEntries,
              constraints: dayState?.constraints,
              plannedWorkouts: dayState?.plannedWorkouts,
              plannedMeals: dayState?.plannedMeals,
              mutationIntent: resolvedIntent,
              baseItems: canonicalBaseItems,
            });
      } catch (buildError) {
        console.warn('[PlanStore] Plan generation failed, recovering with validate-only schedule', buildError);
        builtPlan = {
          dateISO,
          items: buildDaySchedule({
            dateISO,
            settings: profile,
            existingItems: canonicalBaseItems,
            intent: resolvedIntent,
            validateOnly: true,
          }),
          summary: 'Recovered from generation error with validate-only rebuild',
          recommendations: [],
        };
      }

      if (!Array.isArray(builtPlan.items) || !builtPlan.items.length) {
        console.warn('[PlanStore] Built plan was invalid/empty, recovering with validate-only schedule');
        builtPlan = {
          dateISO,
          items: buildDaySchedule({
            dateISO,
            settings: profile,
            existingItems: canonicalBaseItems,
            intent: resolvedIntent,
            validateOnly: true,
          }),
          summary: 'Recovered empty plan with validate-only rebuild',
          recommendations: [],
        };
      }

      const guardedItems =
        isDeleteIntent && beforeItems
          ? applyDeleteSafetyGuard(beforeItems, builtPlan.items, deletedItemId)
          : { items: builtPlan.items, insertedCount: 0, blockedCount: 0 };

      if (isDeleteIntent && beforeItems && guardedItems.items.length > beforeItems.length) {
        console.warn('[PlanStore][DeleteTrace] Length guard blocked delete insertion', {
          beforeCount: beforeItems.length,
          afterCount: guardedItems.items.length,
          deletedItemId,
        });
      }

      const finalItems = stableSortTimeline(
        isDeleteIntent
          ? dedupeBehaviorBlocks(normalizeScheduleEntries(guardedItems.items), { dateISO })
          : dedupeBehaviorBlocks(normalizeScheduleEntries(builtPlan.items), { dateISO })
      );

      const finalPlan: DayPlan = isDeleteIntent
        ? {
            ...builtPlan,
            items: finalItems,
            recommendations: [],
          }
        : {
            ...builtPlan,
            items: finalItems,
          };

      if (isDeleteIntent) {
        console.log('[PlanStore][DeleteTrace] generateFullDayPlan result', {
          intent: resolvedIntent,
          generatedCount: builtPlan.items.length,
          finalCount: finalPlan.items.length,
          unexpectedInserted: guardedItems.insertedCount,
          blockedUnexpected: guardedItems.blockedCount,
        });
      }

      await AsyncStorage.setItem(`fullDayPlan_${dateISO}`, JSON.stringify(finalPlan));
      const settingsFingerprint = getMajorSettingsFingerprint(profile);
      await AsyncStorage.setItem(`planProfileFingerprint_${dateISO}`, settingsFingerprint);

      set({
        fullDayPlan: finalPlan,
        todayPlanSettingsFingerprint: settingsFingerprint,
      });

      get().syncToAPI().catch((error) => {
        console.warn('[PlanStore] Full day plan sync failed:', error);
      });

      console.log('[PlanStore] Full day plan generated:', finalPlan.summary);
    } catch (error) {
      console.error('[PlanStore] Generate full day plan error:', error);
      set({ syncError: String(error) });
    }
  },

  addTodayEntry: async (entry: Omit<ScheduleItem, 'id'>) => {
    const { profile, todayEntries, fullDayPlan } = get();
    if (!profile) return '';

    const nowISO = new Date().toISOString();
    const dateISO = format(new Date(), 'yyyy-MM-dd');
    const workingSchedule = getWorkingSchedule(fullDayPlan, todayEntries);

    const legacyIsAnchor = Boolean(entry.meta && (entry.meta as any).isAnchor);
    const isSystemAnchor = Boolean(
      entry.isSystemAnchor ||
      entry.type === 'wake' ||
      entry.type === 'sleep' ||
      (entry.type === 'work' && (
        (entry.title || '').toLowerCase().includes('work start') ||
        (entry.title || '').toLowerCase().includes('work end')
      ))
    );
    const isFixedAnchor = Boolean(
      entry.isFixedAnchor ||
      entry.fixed ||
      (legacyIsAnchor && isSystemAnchor)
    );

    const newEntry: ScheduleItem = {
      ...entry,
      id: generateUUID(),
      status: entry.status || (entry.origin === 'actual' ? 'actual' : 'planned'),
      source: entry.source === 'advisor' ? 'advisor' : 'user',
      isSystemAnchor,
      isFixedAnchor,
      fixed: isFixedAnchor,
      locked: isSystemAnchor ? true : Boolean(entry.locked),
      deletable: canDeleteScheduleItem({ ...entry, isSystemAnchor }),
      meta: {
        ...(entry.meta || {}),
        isAnchor: isSystemAnchor,
      },
      createdAt: entry.createdAt || nowISO,
      updatedAt: nowISO,
    };

    const updated = stableSortTimeline(applyScheduleMutation({
      currentItems: workingSchedule,
      mutation: { kind: 'add', item: newEntry },
      settings: profile,
      intent: 'ADD',
      dateISO,
    }));

    set({ todayEntries: stableSortTimeline(updated) });
    await AsyncStorage.setItem(`todayEntries_${dateISO}`, JSON.stringify(updated));

    const isHardAnchorInsert =
      newEntry.source === 'user' &&
      (newEntry.isSystemAnchor || newEntry.isFixedAnchor || Boolean(newEntry.meta && (newEntry.meta as any).isAnchor));

    if (isHardAnchorInsert) {
      const recommendations = buildAnchorConflictRecommendations(workingSchedule, newEntry);
      set({ pendingRecommendations: recommendations, pendingAnchorRecommendations: recommendations });
    }

    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const shouldRecomputeFromNow =
      (newEntry.startMin ?? 0) > nowMinutes || newEntry.status === 'planned';

    await get().generateFullDayPlan({
      intent: shouldRecomputeFromNow ? 'RECOMPUTE_FROM_NOW' : 'ADD',
      baseItems: updated,
    });
    const inferredAction =
      newEntry.status === 'actual' && newEntry.type === 'meal'
        ? 'log-meal'
        : newEntry.status === 'actual' && newEntry.type === 'walk'
          ? 'log-walk'
          : newEntry.status === 'actual' && newEntry.type === 'workout'
            ? 'log-workout'
            : 'other';

    if (
      shouldAutoRecomputeFromNow({
        action: inferredAction,
        nowMinutes,
        affectedItem: newEntry,
        intent: 'ADD',
      })
    ) {
      scheduleAutoRecomputeFromNow(async () => {
        const state = get();
        const freshBase = stableSortTimeline(getWorkingSchedule(state.fullDayPlan, state.todayEntries));
        await state.generateFullDayPlan({
          intent: 'RECOMPUTE_FROM_NOW',
          baseItems: freshBase,
        });
      });
    }

    return newEntry.id;
  },

  setTodayEntries: async (entries: ScheduleItem[]) => {
    const { profile } = get();
    if (!profile) return;

    const normalized = stableSortTimeline(normalizeScheduleEntries(entries));
    set({ todayEntries: stableSortTimeline(normalized) });

    const dateISO = format(new Date(), 'yyyy-MM-dd');
    await AsyncStorage.setItem(`todayEntries_${dateISO}`, JSON.stringify(normalized));

    await get().generateFullDayPlan({
      intent: hasMeaningfulScheduleItems(normalized) ? 'EDIT' : 'REGENERATE',
      baseItems: normalized,
    });
  },

  updateTodayEntry: async (id: string, updates: Partial<ScheduleItem>) => {
    const { profile, todayEntries, fullDayPlan } = get();
    if (!profile) return;

    const dateISO = format(new Date(), 'yyyy-MM-dd');
    const workingSchedule = getWorkingSchedule(fullDayPlan, todayEntries);
    const previousItem = workingSchedule.find((item) => item.id === id) || null;

    const updated = stableSortTimeline(applyScheduleMutation({
      currentItems: workingSchedule,
      mutation: { kind: 'edit', id, updates },
      settings: profile,
      intent: 'EDIT',
      dateISO,
    }));

    set({ todayEntries: stableSortTimeline(updated) });
    await AsyncStorage.setItem(`todayEntries_${dateISO}`, JSON.stringify(updated));

    await get().generateFullDayPlan({
      intent: 'EDIT',
      baseItems: updated,
    });

    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    const nextStartMin = updates.startMin ?? previousItem?.startMin ?? 0;
    const inferredAction =
      updates.status === 'actual' || updates.origin === 'actual'
        ? 'mark-actual'
        : updates.status === 'skipped'
          ? 'mark-skipped'
          : (typeof updates.startMin === 'number' || Boolean(updates.startISO) || Boolean(updates.startTime)) && nextStartMin > nowMinutes
            ? 'edit-future-time'
            : 'other';

    if (
      shouldAutoRecomputeFromNow({
        action: inferredAction,
        nowMinutes,
        affectedItem: {
          ...previousItem,
          ...updates,
          startMin: nextStartMin,
        } as ScheduleItem,
        intent: 'EDIT',
      })
    ) {
      scheduleAutoRecomputeFromNow(async () => {
        const state = get();
        const freshBase = stableSortTimeline(getWorkingSchedule(state.fullDayPlan, state.todayEntries));
        await state.generateFullDayPlan({
          intent: 'RECOMPUTE_FROM_NOW',
          baseItems: freshBase,
        });
      });
    }
  },

  deleteTodayEntry: async (id: string) => {
    const { profile, todayEntries, fullDayPlan } = get();
    if (!profile) return;

    const dateISO = format(new Date(), 'yyyy-MM-dd');
    const workingSchedule = getWorkingSchedule(fullDayPlan, todayEntries);
    const beforeItems = normalizeScheduleEntries(workingSchedule);

    const entryToDelete = workingSchedule.find((item) => item.id === id);
    if (!canDeleteScheduleItem(entryToDelete)) {
      return;
    }

      const updated = stableSortTimeline(applyScheduleMutation({
        currentItems: workingSchedule,
        mutation: { kind: 'delete', id },
        settings: profile,
        intent: 'DELETE',
        dateISO,
      }));

      const deletionMarker: ScheduleItem | null = entryToDelete
        ? {
            id: `deleted-marker-${entryToDelete.id}-${Date.now()}`,
            type: entryToDelete.type === 'wake' || entryToDelete.type === 'sleep' ? 'custom' : entryToDelete.type,
            title: `Deleted: ${entryToDelete.title}`,
            startISO: entryToDelete.startISO,
            endISO: entryToDelete.endISO,
            startMin: entryToDelete.startMin,
            endMin: entryToDelete.endMin,
            durationMin: entryToDelete.durationMin || 5,
            isSystemAnchor: false,
            isFixedAnchor: false,
            fixed: false,
            locked: false,
            deletable: false,
            source: 'user',
            status: 'adjusted',
            notes: 'deleted-marker',
            meta: {
              suppressedId: entryToDelete.id,
              suppressedKey: suppressionKeyForItem(entryToDelete),
              suppressedExactKey: suppressionExactKeyForItem(entryToDelete),
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }
        : null;

      const updatedWithMarker = deletionMarker ? [...updated, deletionMarker] : updated;

      set({ todayEntries: stableSortTimeline(updatedWithMarker) });
      await AsyncStorage.setItem(`todayEntries_${dateISO}`, JSON.stringify(updatedWithMarker));

      await get().generateFullDayPlan({
        intent: 'DELETE_VALIDATE_ONLY',
        baseItems: updatedWithMarker,
        beforeItems,
        deletedItemId: id,
      });
  },

  getTomorrowPreview: async () => {
    const { profile, dayState } = get();
    const tomorrow = addMinutes(new Date(), 24 * 60);
    const dateISO = format(tomorrow, 'yyyy-MM-dd');

    if (!profile) {
      return {
        dateISO,
        wakeTime: '07:00',
        sleepTime: '23:00',
        anchors: [
          { title: 'Meal 1', time: '08:30' },
          { title: 'Lunch', time: '12:30' },
          { title: 'Workout / Walk', time: '17:30' },
        ],
        generated: false,
      };
    }

    const generated = buildTimelinePlan({
      dateISO,
      settings: profile,
      todayEntries: [],
      constraints: dayState?.constraints,
      plannedMeals: dayState?.plannedMeals,
      plannedWorkouts: dayState?.plannedWorkouts,
      mutationIntent: 'GENERATE_TOMORROW',
      baseItems: [],
    });

    return {
      dateISO,
      wakeTime: profile.wakeTime,
      sleepTime: profile.sleepTime,
      workStartTime: profile.workStartTime,
      workEndTime: profile.workEndTime,
      anchors: generated.items
        .filter(
          (item) =>
            item.type === 'wake' ||
            item.type === 'work' ||
            item.type === 'lunch' ||
            item.type === 'meal' ||
            item.type === 'snack' ||
            item.type === 'walk' ||
            item.type === 'workout' ||
            item.type === 'sleep'
        )
        .slice(0, 10)
        .map((item) => ({ title: item.title, time: minutesToHHmm(item.startMin || 0) })),
      items: generated.items,
      suggestions: generated.recommendations,
      generated: true,
    };
  },

  addEvent: async (event: Event) => {
    const { dayState } = get();
    if (!dayState) return;

    const updatedState: DayState = {
      ...dayState,
      events: [...dayState.events, event],
    };

    set({ dayState: updatedState });
    await get().generatePlan(true);
  },

  updateEvent: async (eventId: string, updates: Partial<Event>) => {
    const { dayState } = get();
    if (!dayState) return;

    const updatedEvents = dayState.events.map((e) => {
      const timeMatch = updates.time && e.time.getTime() === updates.time.getTime();
      const typeMatch = e.type === updates.type;
      return timeMatch && typeMatch ? ({ ...e, ...updates } as Event) : e;
    });

    const updatedState: DayState = {
      ...dayState,
      events: updatedEvents,
    };

    set({ dayState: updatedState });
    await get().generatePlan(true);
  },

  markDone: async (eventId: string) => {
    const { dayState, computedPlan } = get();
    if (!dayState || !computedPlan) return;

    const step = computedPlan.scheduleItems.find((s) => s.id === eventId);
    if (!step) return;

    const doneEvent: Event = {
      ...step.event,
      status: 'DONE',
    };

    const updatedState: DayState = {
      ...dayState,
      events: [...dayState.events, doneEvent],
      completedEvents: [...dayState.completedEvents, doneEvent],
    };

    set({ dayState: updatedState });
    await get().generatePlan(true);
  },

  markSkipped: async (eventId: string) => {
    const { dayState, computedPlan } = get();
    if (!dayState || !computedPlan) return;

    const step = computedPlan.scheduleItems.find((s) => s.id === eventId);
    if (!step) return;

    const skippedEvent: Event = {
      ...step.event,
      status: 'SKIPPED',
    };

    const updatedState: DayState = {
      ...dayState,
      events: [...dayState.events, skippedEvent],
    };

    set({ dayState: updatedState });
    await get().generatePlan(true);
  },

  deleteEvent: async (eventId: string) => {
    const { dayState } = get();
    if (!dayState) return;

    const updatedState: DayState = {
      ...dayState,
      removedStepIds: [...dayState.removedStepIds, eventId],
    };

    set({ dayState: updatedState });
    await get().generatePlan(true);
  },

  delayMeal: async (mealId: string, minutes: number) => {
    const { dayState, computedPlan } = get();
    if (!dayState || !computedPlan) return;

    const step = computedPlan.scheduleItems.find((s) => s.id === mealId);
    if (!step || step.event.type !== 'meal') return;

    const delayedEvent: MealEvent = {
      ...(step.event as MealEvent),
      time: addMinutes(step.event.time, minutes),
      originalPlannedTime: step.event.time,
    };

    const updatedState: DayState = {
      ...dayState,
      modifiedEvents: {
        ...dayState.modifiedEvents,
        [mealId]: delayedEvent,
      },
    };

    set({ dayState: updatedState });
    await get().generatePlan(true);
  },

  addComfortMeal: async (time: Date) => {
    const comfortMeal: MealEvent = {
      type: 'meal',
      time,
      mealType: 'comfort-meal',
      source: 'USER',
      status: 'PLANNED',
      meal: {
        category: 'COMFORT',
        template: 'Comfort Window Meal',
      },
    };

    await get().addEvent(comfortMeal);
  },

  addMeetingBlock: async (start: Date, end: Date, description?: string) => {
    const { dayState } = get();
    if (!dayState) return;

    const meeting: ConstraintBlock = {
      start,
      end,
      type: 'meeting',
      description,
    };

    const updatedState: DayState = {
      ...dayState,
      constraints: [...dayState.constraints, meeting],
    };

    set({ dayState: updatedState });
    await get().generatePlan(true);
  },

  shortenWalk: async (walkId: string, newDuration: number) => {
    const { dayState, computedPlan } = get();
    if (!dayState || !computedPlan) return;

    const step = computedPlan.scheduleItems.find((s) => s.id === walkId);
    if (!step || step.event.type !== 'walk') return;

    const updatedWalk: WalkEvent = {
      ...(step.event as WalkEvent),
      duration: newDuration,
    };

    const updatedState: DayState = {
      ...dayState,
      modifiedEvents: {
        ...dayState.modifiedEvents,
        [walkId]: updatedWalk,
      },
    };

    set({ dayState: updatedState });
    await get().generatePlan(true);
  },

  setStress: async (level: number) => {
    const { dayState } = get();
    if (!dayState) return;

    const updatedState: DayState = {
      ...dayState,
      stressLevel: level,
    };

    set({ dayState: updatedState });
    await get().generatePlan(true);
  },

  setSleep: async (level: number) => {
    const { dayState } = get();
    if (!dayState) return;

    const updatedState: DayState = {
      ...dayState,
      sleepQuality: level,
    };

    set({ dayState: updatedState });
    await get().generatePlan(true);
  },

  setQuickStatusSignals: async (signals: QuickStatusSignal[]) => {
    const { dayState } = get();
    if (!dayState) return;

    const normalizedSignals = normalizeQuickStatusSignals(signals);
    const dateKey = format(new Date(), 'yyyy-MM-dd');

    const updatedState: DayState = {
      ...dayState,
      isHungry: normalizedSignals.includes('hungry-now'),
      isCraving: normalizedSignals.includes('craving-comfort'),
    };

    (updatedState as any).quickStatusSignals = normalizedSignals;

    set({ dayState: updatedState });
    await AsyncStorage.setItem(`dayState_${dateKey}`, JSON.stringify(updatedState));

    get().syncToAPI().catch((error) => {
      console.warn('[PlanStore] Quick status sync failed:', error);
    });
  },

  applyRecommendation: async (recommendationId: string) => {
    const { pendingRecommendations, updateTodayEntry, deleteTodayEntry, addTodayEntry } = get();
    const recommendation = pendingRecommendations.find((item) => item.id === recommendationId);
    if (!recommendation) return;

    switch (recommendation.payload.kind) {
      case 'move': {
        const startMin = recommendation.payload.startMin;
        const endMin = recommendation.payload.endMin;
        await updateTodayEntry(recommendation.payload.itemId, {
          startMin,
          endMin,
          durationMin: Math.max(5, endMin - startMin),
          status: 'adjusted',
        });
        break;
      }
      case 'shorten': {
        await updateTodayEntry(recommendation.payload.itemId, {
          endMin: recommendation.payload.endMin,
          durationMin: recommendation.payload.durationMin,
          status: 'adjusted',
        });
        break;
      }
      case 'insert': {
        await addTodayEntry(recommendation.payload.item);
        break;
      }
      case 'remove': {
        await deleteTodayEntry(recommendation.payload.itemId);
        break;
      }
      default:
        break;
    }

    set({
      pendingRecommendations: pendingRecommendations.filter((item) => item.id !== recommendationId),
      pendingAnchorRecommendations: pendingRecommendations.filter((item) => item.id !== recommendationId),
    });
  },

  applyAllRecommendations: async () => {
    const { pendingRecommendations } = get();
    for (const recommendation of pendingRecommendations) {
      await get().applyRecommendation(recommendation.id);
    }
  },

  declineRecommendation: (recommendationId: string) => {
    const { pendingRecommendations } = get();
    const remaining = pendingRecommendations.filter((item) => item.id !== recommendationId);
    set({ pendingRecommendations: remaining, pendingAnchorRecommendations: remaining });
  },

  declineAllRecommendations: () => {
    set({ pendingRecommendations: [], pendingAnchorRecommendations: [] });
  },

  applyAnchorRecommendation: async (recommendationId: string) => {
    await get().applyRecommendation(recommendationId);
  },

  applyAllAnchorRecommendations: async () => {
    await get().applyAllRecommendations();
  },

  clearAnchorRecommendations: () => {
    get().declineAllRecommendations();
  },

  syncToAPI: async () => {
    const { deviceId, dayState, fullDayPlan, todayEntries, syncStatus } = get();

    if (!deviceId || !dayState) return;
    if (syncStatus === 'syncing') return;

    set({ syncStatus: 'syncing' });

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), API_TIMEOUT);

      const response = await fetch(`${API_BASE_URL}/day/${deviceId}/state`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dayState,
          fullDayPlan,
          todayEntries,
          syncedAt: new Date().toISOString(),
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      set({ syncStatus: 'synced', lastSyncAt: new Date(), syncError: null });
    } catch (error: any) {
      console.warn('[PlanStore] API sync failed:', error.message);
      set({ syncStatus: 'offline', syncError: error.message });
    }
  },

  enableAutoRefresh: () => set({ autoRefreshEnabled: true }),
  disableAutoRefresh: () => set({ autoRefreshEnabled: false }),
}));

let autoRefreshTimer: NodeJS.Timeout | null = null;

export function startAutoRefresh() {
  if (autoRefreshTimer) return;

  autoRefreshTimer = setInterval(() => {
    const state = usePlanStore.getState();

    if (!state.autoRefreshEnabled) return;

    const staleness = state.checkStaleness();

    if (staleness === 'STALE' || staleness === 'CRITICAL') {
      console.log('[PlanStore] Auto-refreshing stale plan');
      state.generatePlan(true).catch((err) => {
        console.error('[PlanStore] Auto-refresh failed:', err);
      });
    }
  }, usePlanStore.getState().autoRefreshIntervalMs);
}

export function stopAutoRefresh() {
  if (autoRefreshTimer) {
    clearInterval(autoRefreshTimer);
    autoRefreshTimer = null;
  }
}

function suppressionKeyForItem(
  item: Pick<ScheduleItem, 'type' | 'title'>
): string {
  const normalizedTitle = (item.title || '').trim().toLowerCase();
  return `${item.type}|${normalizedTitle}`;
}

function suppressionExactKeyForItem(
  item: Pick<ScheduleItem, 'type' | 'title' | 'startMin' | 'startISO' | 'startTime'>
): string {
  return signatureForDeleteGuard(item);
}

// Calendar import helper: returns schedule items mapped from a calendar range
async function importCalendarEventsForRange(start: Date, end: Date, selectedCalendarIds?: string[]): Promise<Omit<ScheduleItem, 'id'>[]> {
  const CalendarModule = await import('expo-calendar');
  // Ensure permission is granted before attempting to read calendars/events
  const perm = await CalendarModule.requestCalendarPermissionsAsync();
  const status = perm?.status;
  if (!status || status !== 'granted') {
    throw new Error('Calendar permission denied');
  }

  const allCalendars = await CalendarModule.getCalendarsAsync(CalendarModule.EntityTypes.EVENT);
  const calendars = (selectedCalendarIds && selectedCalendarIds.length)
    ? allCalendars.filter((c) => selectedCalendarIds.includes(c.id))
    : allCalendars;

  let events: Calendar.Event[] = [] as any;

  for (const cal of calendars) {
    try {
      const calEvents = await CalendarModule.getEventsAsync([cal.id], start, end);
      // attach calendar title and only include events whose start falls within the requested range
      const mapped = calEvents
        .map((e) => ({ ...e, _calendarTitle: cal.title }))
        .filter((e) => {
          try {
            const sd = new Date(e.startDate as any);
            return sd.getTime() >= start.getTime() && sd.getTime() <= end.getTime();
          } catch (err) {
            return false;
          }
        });
      events = [...events, ...mapped];
    } catch (err) {
      // ignore per-calendar errors
      console.warn('[PlanStore] getEventsAsync failed for calendar', cal.id, err);
    }
  }

  const nowIso = new Date().toISOString();

  return events
    .filter((event) => event && (!('status' in event) || (event as any).status !== 'cancelled'))
    .map((event) => {
      const startDate = new Date(event.startDate as any);
      const endDate = new Date(event.endDate as any);

      const startMin = startDate.getHours() * 60 + startDate.getMinutes();
      const endMin = endDate.getHours() * 60 + endDate.getMinutes();

      const title = (event.title || '').trim() || 'Calendar Event';
      const lower = title.toLowerCase();
      let type: ScheduleItem['type'] = 'meeting';
      if (/work(out|out)|exercise|gym|run|lift|training/.test(lower)) type = 'workout';
      else if (/commute|travel|drive|pickup|dropoff|uber|taxi/.test(lower)) type = 'commute';

      return {
        type,
        title,
        startISO: startDate.toISOString(),
        endISO: endDate.toISOString(),
        startMin,
        endMin,
        durationMin: Math.max(5, endMin - startMin),
        fixed: true,
        isFixedAnchor: true,
        isSystemAnchor: false,
        locked: false,
        deletable: true,
        source: 'system' as const,
        status: 'planned' as const,
        meta: {
          source: 'calendar',
          isImported: true,
          calendarId: (event as any).calendarId || (event as any).calendar || undefined,
          calendarTitle: (event as any)._calendarTitle || undefined,
          externalEventId: (event as any).id || (event as any).eventId || undefined,
          lastSyncedAt: nowIso,
        },
      } as Omit<ScheduleItem, 'id'>;
    });
}