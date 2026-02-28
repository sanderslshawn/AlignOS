/**
 * PLAN STATE MANAGER
 * Single source of truth for plan generation, event mutations, and sync.
 * Handles local offline computation and API sync when available.
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  UserProfile,
  DayState,
  PlanStep,
  Event,
  MealEvent,
  WalkEvent,
  ConstraintBlock,
  EngineInput,
  EngineOutput,
  ScheduleItem,
  DayPlan,
} from '@physiology-engine/shared';
import { generatePlan, generateDayPlan } from '@physiology-engine/engine';
import { format, addMinutes } from 'date-fns';

// Simple UUID generator (fallback if expo-crypto not available)
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export type SyncStatus = 'offline' | 'syncing' | 'synced' | 'error';

interface PlanState {
  // Core state
  deviceId: string | null;
  profile: UserProfile | null;
  dayState: DayState | null;
  computedPlan: EngineOutput | null;
  
  // Full-day plan (new)
  todayEntries: ScheduleItem[];
  fullDayPlan: DayPlan | null;
  
  // Sync status
  syncStatus: SyncStatus;
  lastSyncAt: Date | null;
  syncError: string | null;
  
  // Auto-refresh
  autoRefreshEnabled: boolean;
  autoRefreshIntervalMs: number;
  
  // Actions: Initialization
  initialize: () => Promise<void>;
  loadProfile: () => Promise<UserProfile | null>;
  saveProfile: (profile: UserProfile) => Promise<void>;
  
  // Actions: Plan Generation
  generatePlan: (forceRecompute?: boolean) => Promise<void>;
  generateFullDayPlan: () => Promise<void>;
  checkStaleness: () => 'FRESH' | 'AGING' | 'STALE' | 'CRITICAL';
  setupToday: (dayState: Partial<DayState>) => Promise<void>;
  
  // Actions: Today Entries (new)
  addTodayEntry: (entry: Omit<ScheduleItem, 'id'>) => Promise<void>;
  updateTodayEntry: (id: string, updates: Partial<ScheduleItem>) => Promise<void>;
  deleteTodayEntry: (id: string) => Promise<void>;
  
  // Actions: Event Mutations
  addEvent: (event: Event) => Promise<void>;
  updateEvent: (eventId: string, updates: Partial<Event>) => Promise<void>;
  markDone: (eventId: string) => Promise<void>;
  markSkipped: (eventId: string) => Promise<void>;
  deleteEvent: (eventId: string) => Promise<void>;
  
  // Actions: Quick Updates
  delayMeal: (mealId: string, minutes: number) => Promise<void>;
  addComfortMeal: (time: Date) => Promise<void>;
  addMeetingBlock: (start: Date, end: Date, description?: string) => Promise<void>;
  shortenWalk: (walkId: string, newDuration: number) => Promise<void>;
  setStress: (level: number) => Promise<void>;
  setSleep: (level: number) => Promise<void>;
  
  // Actions: Sync
  syncToAPI: () => Promise<void>;
  enableAutoRefresh: () => void;
  disableAutoRefresh: () => void;
}

// API configuration
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
const API_TIMEOUT = 5000; // 5 seconds

export const usePlanStore = create<PlanState>((set, get) => ({
  deviceId: null,
  profile: null,
  dayState: null,
  computedPlan: null,
  todayEntries: [],
  fullDayPlan: null,
  syncStatus: 'offline',
  lastSyncAt: null,
  syncError: null,
  autoRefreshEnabled: true,
  autoRefreshIntervalMs: 60000, // 60 seconds
  
  // Initialize store
  initialize: async () => {
    try {
      // Get or create device ID
      let deviceId = await AsyncStorage.getItem('deviceId');
      if (!deviceId) {
        deviceId = generateUUID();
        await AsyncStorage.setItem('deviceId', deviceId);
      }
      
      // Load profile from planStore location
      let profile = await get().loadProfile();
      
      // MIGRATION: If no profile in new location, check old appStore location
      if (!profile) {
        const oldAppState = await AsyncStorage.getItem('appState');
        if (oldAppState) {
          const parsed = JSON.parse(oldAppState);
          if (parsed.userProfile) {
            profile = parsed.userProfile;
            // Migrate to new location
            await AsyncStorage.setItem('userProfile', JSON.stringify(profile));
          }
        }
      }
      
      // Load today's day state
      const dateKey = format(new Date(), 'yyyy-MM-dd');
      let dayState: DayState | null = null;
      
      // Try new location first
      const dayStateJson = await AsyncStorage.getItem(`dayState_${dateKey}`);
      if (dayStateJson) {
        dayState = JSON.parse(dayStateJson, (key, value) => {
          // Revive Date objects
          if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
            return new Date(value);
          }
          return value;
        });
      }
      
      // MIGRATION: Check old appStore location
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
              deviceId: deviceId,
              dateKey: dateKey,
              events: parsed.dayState.events || [],
              computedPlan: parsed.dayState.computedPlan || [],
            };
          }
        }
      }
      
      // Load today's entries
      const todayEntriesJson = await AsyncStorage.getItem(`todayEntries_${dateKey}`);
      let todayEntries: ScheduleItem[] = [];
      if (todayEntriesJson) {
        todayEntries = JSON.parse(todayEntriesJson);
      }
      
      // Load full day plan
      const fullDayPlanJson = await AsyncStorage.getItem(`fullDayPlan_${dateKey}`);
      let fullDayPlan: DayPlan | null = null;
      if (fullDayPlanJson) {
        fullDayPlan = JSON.parse(fullDayPlanJson);
      }
      
      set({ deviceId, profile, dayState, todayEntries, fullDayPlan });
      
      // Generate initial plan if we have profile and dayState
      if (profile && dayState) {
        await get().generatePlan(true);
      }
    } catch (error) {
      console.error('[PlanStore] Initialize error:', error);
      set({ syncStatus: 'error', syncError: String(error) });
    }
  },
  
  loadProfile: async () => {
    const profileJson = await AsyncStorage.getItem('userProfile');
    if (profileJson) {
      return JSON.parse(profileJson);
    }
    return null;
  },
  
  saveProfile: async (profile: UserProfile) => {
    await AsyncStorage.setItem('userProfile', JSON.stringify(profile));
    set({ profile });
    
    // Regenerate plan with new profile
    await get().generatePlan(true);
  },
  
  // Setup today's day state
  setupToday: async (dayStateInput: Partial<DayState>) => {
    const { deviceId, profile } = get();
    
    if (!profile) {
      console.error('[PlanStore] Cannot setup day without profile');
      return;
    }
    
    const now = new Date();
    const dateKey = format(now, 'yyyy-MM-dd');
    
    // Create complete day state with required fields
    const dayState: DayState = {
      deviceId: deviceId || 'unknown',
      dateKey,
      date: now,
      dayMode: dayStateInput.dayMode || profile.defaultDayMode || 'flex',
      currentTime: now,
      sleepQuality: dayStateInput.sleepQuality || 7,
      stressLevel: dayStateInput.stressLevel || profile.stressBaseline || 5,
      isHungry: dayStateInput.isHungry || false,
      isCraving: dayStateInput.isCraving || false,
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
    
    // Save to storage
    await AsyncStorage.setItem(`dayState_${dateKey}`, JSON.stringify(dayState));
    
    // Update state
    set({ dayState });
    
    // Generate plan (legacy)
    await get().generatePlan(true);
    
    // Generate full day plan (new)
    await get().generateFullDayPlan();
  },
  
  // Generate plan using core engine
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
      // Call core engine (local compute)
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
      
      // Update day state with computed plan
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
      
      // Save to local storage
      const dateKey = format(new Date(), 'yyyy-MM-dd');
      await AsyncStorage.setItem(`dayState_${dateKey}`, JSON.stringify(updatedDayState));
      
      set({
        dayState: updatedDayState,
        computedPlan: output,
        syncStatus: 'synced',
      });
      
      // Attempt API sync (non-blocking)
      syncToAPI().catch(err => {
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
  
  // Generate Full Day Plan (new comprehensive planner)
  generateFullDayPlan: async () => {
    const { profile, todayEntries, dayState } = get();
    
    if (!profile) {
      console.warn('[PlanStore] Cannot generate full day plan without profile');
      return;
    }
    
    try {
      const dateISO = format(new Date(), 'yyyy-MM-dd');
      
      const fullPlan = generateDayPlan({
        dateISO,
        settings: profile,
        todayEntries,
        constraints: dayState?.constraints,
        plannedWorkouts: dayState?.plannedWorkouts,
        plannedMeals: dayState?.plannedMeals,
      });
      
      // Save to storage
      await AsyncStorage.setItem(`fullDayPlan_${dateISO}`, JSON.stringify(fullPlan));
      
      set({ fullDayPlan: fullPlan });
      
      console.log('[PlanStore] Full day plan generated:', fullPlan.summary);
    } catch (error) {
      console.error('[PlanStore] Generate full day plan error:', error);
      set({ syncError: String(error) });
    }
  },
  
  // Add today entry
  addTodayEntry: async (entry: Omit<ScheduleItem, 'id'>) => {
    const { todayEntries } = get();
    
    const newEntry: ScheduleItem = {
      ...entry,
      id: generateUUID(),
    };
    
    const updated = [...todayEntries, newEntry];
    set({ todayEntries: updated });
    
    // Save to storage
    const dateISO = format(new Date(), 'yyyy-MM-dd');
    await AsyncStorage.setItem(`todayEntries_${dateISO}`, JSON.stringify(updated));
    
    // Regenerate plan
    await get().generateFullDayPlan();
  },
  
  // Update today entry
  updateTodayEntry: async (id: string, updates: Partial<ScheduleItem>) => {
    const { todayEntries, fullDayPlan } = get();
    
    // Check if item exists in todayEntries
    const existingIndex = todayEntries.findIndex(entry => entry.id === id);
    
    let updated: ScheduleItem[];
    
    if (existingIndex >= 0) {
      // Update existing user entry
      updated = todayEntries.map(entry =>
        entry.id === id ? { ...entry, ...updates, source: 'user' } : entry
      );
    } else {
      // Item is from settings or engine - convert to user entry
      // Find the original item from fullDayPlan
      const originalItem = fullDayPlan?.items.find(item => item.id === id);
      
      if (originalItem) {
        // Add as new user entry with updates
        const newUserEntry: ScheduleItem = {
          ...originalItem,
          ...updates,
          source: 'user',
          // Preserve the fixed value from updates, or default to false for user entries
          fixed: updates.fixed !== undefined ? updates.fixed : false,
        };
        updated = [...todayEntries, newUserEntry];
      } else {
        console.warn('[PlanStore] Could not find item to update:', id);
        return;
      }
    }
    
    set({ todayEntries: updated });
    
    // Save to storage
    const dateISO = format(new Date(), 'yyyy-MM-dd');
    await AsyncStorage.setItem(`todayEntries_${dateISO}`, JSON.stringify(updated));
    
    // Regenerate plan
    await get().generateFullDayPlan();
  },
  
  // Delete today entry
  deleteTodayEntry: async (id: string) => {
    const { todayEntries, fullDayPlan } = get();
    
    // Check if this is a user entry in todayEntries
    const isInTodayEntries = todayEntries.some(entry => entry.id === id);
    
    if (isInTodayEntries) {
      // Remove from todayEntries
      const updated = todayEntries.filter(entry => entry.id !== id);
      set({ todayEntries: updated });
      
      // Save to storage
      const dateISO = format(new Date(), 'yyyy-MM-dd');
      await AsyncStorage.setItem(`todayEntries_${dateISO}`, JSON.stringify(updated));
    } else {
      // Item is from settings/engine - mark it as deleted by adding a "removal" entry
      // This prevents it from being regenerated
      const itemToRemove = fullDayPlan?.items.find(item => item.id === id);
      if (itemToRemove) {
        // Add a special "deleted" marker with same ID but different type
        const deletionMarker: ScheduleItem = {
          id: id,
          type: 'custom',
          title: 'DELETED',
          startISO: itemToRemove.startISO,
          endISO: itemToRemove.startISO, // Zero duration
          fixed: false,
          source: 'user',
          notes: 'deleted-marker',
        };
        
        const updated = [...todayEntries, deletionMarker];
        set({ todayEntries: updated });
        
        const dateISO = format(new Date(), 'yyyy-MM-dd');
        await AsyncStorage.setItem(`todayEntries_${dateISO}`, JSON.stringify(updated));
      }
    }
    
    // Regenerate plan
    await get().generateFullDayPlan();
  },
  
  // Add event (generic)
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
  
  // Update event
  updateEvent: async (eventId: string, updates: Partial<Event>) => {
    const { dayState } = get();
    if (!dayState) return;
    
    const updatedEvents = dayState.events.map(e => {
      // Match by time and type (simple strategy)
      const timeMatch = updates.time && e.time.getTime() === updates.time.getTime();
      const typeMatch = e.type === updates.type;
      return (timeMatch && typeMatch) ? { ...e, ...updates } as Event : e;
    });
    
    const updatedState: DayState = {
      ...dayState,
      events: updatedEvents,
    };
    
    set({ dayState: updatedState });
    await get().generatePlan(true);
  },
  
  // Mark event as done
  markDone: async (eventId: string) => {
    const { dayState, computedPlan } = get();
    if (!dayState || !computedPlan) return;
    
    // Find event in computed plan
    const step = computedPlan.scheduleItems.find(s => s.id === eventId);
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
  
  // Mark event as skipped
  markSkipped: async (eventId: string) => {
    const { dayState, computedPlan } = get();
    if (!dayState || !computedPlan) return;
    
    const step = computedPlan.scheduleItems.find(s => s.id === eventId);
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
  
  // Delete event
  deleteEvent: async (eventId: string) => {
    const { dayState } = get();
    if (!dayState) return;
    
    // Add to removedStepIds
    const updatedState: DayState = {
      ...dayState,
      removedStepIds: [...dayState.removedStepIds, eventId],
    };
    
    set({ dayState: updatedState });
    await get().generatePlan(true);
  },
  
  // Delay meal
  delayMeal: async (mealId: string, minutes: number) => {
    const { dayState, computedPlan } = get();
    if (!dayState || !computedPlan) return;
    
    const step = computedPlan.scheduleItems.find(s => s.id === mealId);
    if (!step || step.event.type !== 'meal') return;
    
    const delayedEvent: MealEvent = {
      ...step.event as MealEvent,
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
  
  // Add comfort meal
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
  
  // Add meeting block
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
  
  // Shorten walk
  shortenWalk: async (walkId: string, newDuration: number) => {
    const { dayState, computedPlan } = get();
    if (!dayState || !computedPlan) return;
    
    const step = computedPlan.scheduleItems.find(s => s.id === walkId);
    if (!step || step.event.type !== 'walk') return;
    
    const updatedWalk: WalkEvent = {
      ...step.event as WalkEvent,
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
  
  // Set stress level
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
  
  // Set sleep level
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
  
  // Sync to API
  syncToAPI: async () => {
    const { deviceId, dayState, syncStatus } = get();
    
    if (!deviceId || !dayState) return;
    if (syncStatus === 'syncing') return; // Prevent concurrent syncs
    
    set({ syncStatus: 'syncing' });
    
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), API_TIMEOUT);
      
      const response = await fetch(`${API_BASE_URL}/day/${deviceId}/state`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dayState),
        signal: controller.signal,
      });
      
      clearTimeout(timeout);
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      set({ syncStatus: 'synced', lastSyncAt: new Date(), syncError: null });
    } catch (error: any) {
      console.warn('[PlanStore] API sync failed:', error.message);
      // Don't set error status for network errors (offline is acceptable)
      set({ syncStatus: 'offline', syncError: error.message });
    }
  },
  
  enableAutoRefresh: () => set({ autoRefreshEnabled: true }),
  disableAutoRefresh: () => set({ autoRefreshEnabled: false }),
}));

// Auto-refresh hook (call in root component)
let autoRefreshTimer: NodeJS.Timeout | null = null;

export function startAutoRefresh() {
  if (autoRefreshTimer) return;
  
  autoRefreshTimer = setInterval(() => {
    const state = usePlanStore.getState();
    
    if (!state.autoRefreshEnabled) return;
    
    const staleness = state.checkStaleness();
    
    if (staleness === 'STALE' || staleness === 'CRITICAL') {
      console.log('[PlanStore] Auto-refreshing stale plan');
      state.generatePlan(true).catch(err => {
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
