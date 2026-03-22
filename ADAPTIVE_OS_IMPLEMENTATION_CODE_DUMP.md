# Adaptive OS Implementation Full Code Dump

## apps/mobile/src/types/mutationIntent.ts

~~~ts
export type MutationIntent =
  | 'ADD'
  | 'EDIT'
  | 'DELETE'
  | 'REGENERATE'
  | 'DELETE_VALIDATE_ONLY'
  | 'RECOMPUTE'
  | 'RECOMPUTE_FROM_NOW'
  | 'SELF_HEAL'
  | 'ADVISOR_INSERT'
  | 'COPY_TODAY_STRUCTURE'
  | 'GENERATE_TOMORROW';
~~~

## apps/mobile/src/utils/planGenerator.ts

~~~ts
import { generateDayPlan } from '@physiology-engine/engine';
import type {
  ConstraintBlock,
  DayPlan,
  MealEvent,
  ScheduleItem,
  UserProfile,
  WorkoutEvent,
} from '@physiology-engine/shared';
import { buildDaySchedule } from '../engine/buildDaySchedule';
import { validateSchedule } from '../engine/validateSchedule';
import { addMinutes as addClockMinutes, parseClockTime, toISOWithClockTime } from './clockTime';
import type { MutationIntent } from '../types/mutationIntent';
import { dedupeBehaviorBlocks } from './dedupeBehaviorBlocks';
import { getAnchorTier } from './getAnchorTier';
import { getCircadianPhaseWindows } from './getCircadianPhaseWindows';

interface BuildTimelineParams {
  dateISO: string;
  settings: UserProfile;
  todayEntries: ScheduleItem[];
  constraints?: ConstraintBlock[];
  plannedWorkouts?: WorkoutEvent[];
  plannedMeals?: MealEvent[];
  mutationIntent?: MutationIntent;
  baseItems?: ScheduleItem[];
}

function itemDateISO(item: Pick<ScheduleItem, 'startISO'>, fallbackDateISO: string): string {
  if (typeof item.startISO === 'string' && item.startISO.includes('T')) {
    return item.startISO.split('T')[0];
  }
  return fallbackDateISO;
}

function filterItemsForDate(items: ScheduleItem[], dateISO: string): ScheduleItem[] {
  return items.filter((item) => itemDateISO(item, dateISO) === dateISO);
}

function suppressionKeyForItem(item: Pick<ScheduleItem, 'type' | 'title' | 'startMin' | 'startISO' | 'startTime'>): string {
  const normalizedTitle = (item.title || '').trim().toLowerCase();
  return `${item.type}|${normalizedTitle}`;
}

function suppressionExactKeyForItem(item: Pick<ScheduleItem, 'type' | 'title' | 'startMin' | 'startISO' | 'startTime'>): string {
  const normalizedTitle = (item.title || '').trim().toLowerCase();
  const minuteFromIso =
    typeof item.startISO === 'string' && item.startISO.includes('T')
      ? Number.parseInt(item.startISO.slice(11, 13), 10) * 60 + Number.parseInt(item.startISO.slice(14, 16), 10)
      : undefined;
  const minuteFromTime = item.startTime
    ? (((item.startTime.period === 'PM' ? (item.startTime.hour % 12) + 12 : item.startTime.hour % 12) * 60) +
        item.startTime.minute)
    : undefined;
  const startMinute = item.startMin ?? minuteFromIso ?? minuteFromTime ?? 0;
  return `${item.type}|${normalizedTitle}|${startMinute}`;
}

function sortByStart(items: ScheduleItem[]): ScheduleItem[] {
  return [...items].sort((left, right) => {
    const leftDate = itemDateISO(left, '');
    const rightDate = itemDateISO(right, '');
    if (leftDate && rightDate && leftDate !== rightDate) {
      return leftDate.localeCompare(rightDate);
    }
    return (left.startMin || 0) - (right.startMin || 0);
  });
}

function minuteToClock(minutesFromMidnight: number): { hour: number; minute: number; period: 'AM' | 'PM' } {
  const normalized = ((Math.round(minutesFromMidnight) % (24 * 60)) + (24 * 60)) % (24 * 60);
  const hour24 = Math.floor(normalized / 60);
  const minute = normalized % 60;
  return {
    hour: (hour24 % 12) || 12,
    minute,
    period: hour24 >= 12 ? 'PM' : 'AM',
  };
}

function dedupeItems(items: ScheduleItem[], dateISO: string): ScheduleItem[] {
  const map = new Map<string, ScheduleItem>();

  for (const item of sortByStart(filterItemsForDate(items, dateISO))) {
    const key = `${itemDateISO(item, dateISO)}|${suppressionExactKeyForItem(item)}|${item.status || 'planned'}|${item.source || 'system'}`;
    const existing = map.get(key);

    if (!existing) {
      map.set(key, item);
      continue;
    }

    const existingPriority = existing.status === 'actual' || existing.origin === 'actual' ? 3 : existing.source === 'user' ? 2 : 1;
    const incomingPriority = item.status === 'actual' || item.origin === 'actual' ? 3 : item.source === 'user' ? 2 : 1;

    if (incomingPriority >= existingPriority) {
      map.set(key, item);
    }
  }

  return sortByStart(Array.from(map.values()));
}

function sameDayUserVisibleEntries(items: ScheduleItem[], dateISO: string): ScheduleItem[] {
  return dedupeBehaviorBlocks(
    dedupeItems(
      filterItemsForDate(items, dateISO).filter((item) => item.notes !== 'deleted-marker'),
      dateISO
    ),
    { dateISO }
  );
}

function inferCircadianTarget(item: ScheduleItem): 'activation' | 'cognitivePeak' | 'metabolicStabilization' | 'physicalOpportunity' | 'windDown' | null {
  const title = (item.title || '').trim().toLowerCase();
  if (title.includes('light') || title.includes('morning mobility') || title.includes('mobility')) return 'activation';
  if (item.type === 'focus' || title.includes('deep work') || title.includes('focus')) return 'cognitivePeak';
  if (item.type === 'meal' || item.type === 'lunch' || item.type === 'snack') return 'metabolicStabilization';
  if (item.type === 'workout' || item.type === 'walk') return 'physicalOpportunity';
  if (title.includes('wind') || title.includes('stretch')) return 'windDown';
  return null;
}

function applyCircadianPlacement(items: ScheduleItem[], params: BuildTimelineParams): ScheduleItem[] {
  const wake = params.settings.wakeClockTime || parseClockTime(params.settings.wakeTime) || undefined;
  const sleep = params.settings.sleepClockTime || parseClockTime(params.settings.sleepTime) || undefined;
  const windows = getCircadianPhaseWindows(wake, sleep);
  const byKey = new Map(windows.map((window) => [window.key, window]));

  return items.map((item) => {
    if (item.status === 'actual' || item.origin === 'actual') return item;
    if (item.source === 'user') return item;
    if (getAnchorTier(item) !== 'flex') return item;

    const targetKey = inferCircadianTarget(item);
    if (!targetKey) return item;
    const targetWindow = byKey.get(targetKey);
    if (!targetWindow) return item;

    const currentStart = item.startMin || 0;
    const duration = Math.max(5, item.durationMin || ((item.endMin || currentStart + 5) - currentStart));
    const clampedStart = Math.max(
      targetWindow.startMin,
      Math.min(currentStart, Math.max(targetWindow.startMin, targetWindow.endMin - duration))
    );

    if (Math.abs(clampedStart - currentStart) < 6) return item;

    const startClock = minuteToClock(clampedStart);
    const endClock = addClockMinutes(startClock, duration);

    return {
      ...item,
      startMin: clampedStart,
      endMin: clampedStart + duration,
      durationMin: duration,
      startTime: startClock,
      endTime: endClock,
      startISO: toISOWithClockTime(`${params.dateISO}T00:00:00.000Z`, startClock),
      endISO: toISOWithClockTime(`${params.dateISO}T00:00:00.000Z`, endClock),
      status: item.status === 'planned' ? 'adjusted' : item.status,
    };
  });
}

export function buildTimelinePlan(params: BuildTimelineParams): DayPlan {
  const mutationIntent = params.mutationIntent || 'REGENERATE';
  const isFullRegenerate = mutationIntent === 'REGENERATE';

  const suppressedIds = new Set(
    params.todayEntries
      .map((item) => item.meta?.suppressedId as string | undefined)
      .filter((value): value is string => Boolean(value))
  );

  const suppressedKeys = new Set(
    params.todayEntries
      .map((item) => item.meta?.suppressedKey as string | undefined)
      .filter((value): value is string => Boolean(value))
  );

  const suppressedExactKeys = new Set(
    params.todayEntries
      .map((item) => item.meta?.suppressedExactKey as string | undefined)
      .filter((value): value is string => Boolean(value))
  );

  const userVisibleEntries = sameDayUserVisibleEntries(params.todayEntries, params.dateISO);

  const wake =
    params.settings.wakeClockTime ||
    parseClockTime(params.settings.wakeTime) ||
    { hour: 7, minute: 0, period: 'AM' as const };

  const sleep =
    params.settings.sleepClockTime ||
    parseClockTime(params.settings.sleepTime) ||
    { hour: 11, minute: 0, period: 'PM' as const };

  if (isFullRegenerate) {
    const rawPlan = generateDayPlan({
      dateISO: params.dateISO,
      settings: params.settings,
      todayEntries: userVisibleEntries,
      constraints: params.constraints,
      plannedWorkouts: params.plannedWorkouts,
      plannedMeals: params.plannedMeals,
    });

    const filteredGeneratedItems = filterItemsForDate(rawPlan.items || [], params.dateISO).filter(
      (item) =>
        !suppressedIds.has(item.id) &&
        !suppressedKeys.has(suppressionKeyForItem(item)) &&
        !suppressedExactKeys.has(suppressionExactKeyForItem(item))
    );

    const circadianAligned = applyCircadianPlacement(filteredGeneratedItems, params);

    const validated = validateSchedule({
      items: dedupeBehaviorBlocks(dedupeItems(circadianAligned, params.dateISO), { dateISO: params.dateISO }),
      wakeTime: wake,
      sleepTime: sleep,
      dateISO: params.dateISO,
    });

    return {
      ...rawPlan,
      dateISO: params.dateISO,
      items: validated.items,
      summary: validated.valid
        ? rawPlan.summary
        : `Timeline repaired: ${validated.issues.join('; ')}`,
    };
  }

  if (mutationIntent === 'RECOMPUTE_FROM_NOW') {
    const baseItems = dedupeBehaviorBlocks(
      dedupeItems(filterItemsForDate(params.baseItems || userVisibleEntries, params.dateISO), params.dateISO),
      { dateISO: params.dateISO }
    );

    const todayISO = new Date().toISOString().slice(0, 10);
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const isCurrentDay = params.dateISO === todayISO;

    const preserved = baseItems.filter((item) => {
      if (getAnchorTier(item) === 'hard') return true;
      if (item.status === 'actual' || item.origin === 'actual') return true;
      if (item.status === 'skipped') return true;
      if (!isCurrentDay) return false;
      const endMin = item.endMin ?? ((item.startMin || 0) + (item.durationMin || 5));
      return endMin <= nowMinutes;
    });

    const generatedFuturePlan = generateDayPlan({
      dateISO: params.dateISO,
      settings: params.settings,
      todayEntries: preserved,
      constraints: params.constraints,
      plannedWorkouts: params.plannedWorkouts,
      plannedMeals: params.plannedMeals,
    });

    const preservedSignature = new Set(
      preserved.map((item) => `${item.type}|${(item.title || '').trim().toLowerCase()}|${item.startMin || 0}`)
    );

    const futureOnly = filterItemsForDate(generatedFuturePlan.items || [], params.dateISO).filter((item) => {
      const start = item.startMin || 0;
      if (item.type === 'wake' || item.type === 'sleep') return false;
      if (isCurrentDay && start <= nowMinutes) return false;

      const signature = `${item.type}|${(item.title || '').trim().toLowerCase()}|${item.startMin || 0}`;
      return !preservedSignature.has(signature);
    });

    const combined = dedupeBehaviorBlocks(
      dedupeItems(applyCircadianPlacement([...preserved, ...futureOnly], params), params.dateISO),
      { dateISO: params.dateISO }
    );

    const validated = validateSchedule({
      items: combined,
      wakeTime: wake,
      sleepTime: sleep,
      dateISO: params.dateISO,
    });

    return {
      dateISO: params.dateISO,
      items: validated.items,
      summary: validated.valid
        ? 'Recomputed remaining day from current time'
        : `Recomputed remaining day with repairs: ${validated.issues.join('; ')}`,
      recommendations: generatedFuturePlan.recommendations || [],
    };
  }

  const sameDayBaseItems = dedupeBehaviorBlocks(
    dedupeItems(filterItemsForDate(params.baseItems || userVisibleEntries, params.dateISO), params.dateISO),
    { dateISO: params.dateISO }
  );

  const timelineItems = buildDaySchedule({
    dateISO: params.dateISO,
    settings: params.settings,
    existingItems: sameDayBaseItems,
    intent: mutationIntent,
    validateOnly: true,
  });

  const validation = validateSchedule({
    items: dedupeBehaviorBlocks(timelineItems, { dateISO: params.dateISO }),
    wakeTime: wake,
    sleepTime: sleep,
    dateISO: params.dateISO,
  });

  return {
    dateISO: params.dateISO,
    items: validation.items,
    summary: validation.valid
      ? `${mutationIntent} applied`
      : `${mutationIntent} applied with repairs: ${validation.issues.join('; ')}`,
    recommendations: [],
  };
}
~~~

## apps/mobile/src/engine/buildDaySchedule.ts

~~~ts
import type { ScheduleItem, UserProfile } from '@physiology-engine/shared';
import type { ClockTime } from '@physiology-engine/shared';
import { addMinutes, parseClockTime, toISOWithClockTime } from '../utils/clockTime';
import { normalizeAndValidateTimeline } from './normalizeTimeline';
import type { MutationIntent } from '../types/mutationIntent';
import { getAnchorTier } from '../utils/getAnchorTier';
import { dedupeBehaviorBlocks } from '../utils/dedupeBehaviorBlocks';

interface BuildDayScheduleInput {
  settings: UserProfile;
  workSchedule?: {
    start?: ClockTime | null;
    end?: ClockTime | null;
    lunch?: ClockTime | null;
  };
  existingItems?: ScheduleItem[];
  advisorInsertions?: ScheduleItem[];
  actualEvents?: ScheduleItem[];
  dateISO?: string;
  suppressedIds?: string[];
  intent?: MutationIntent;
  validateOnly?: boolean;
}

function createAnchorItem(
  type: ScheduleItem['type'],
  title: string,
  time: ClockTime,
  dateISO: string,
  idSuffix: string
): ScheduleItem {
  return {
    id: `${type}-${dateISO}-${idSuffix}`,
    type,
    title,
    startTime: time,
    endTime: addMinutes(time, 5),
    durationMin: 5,
    startISO: toISOWithClockTime(`${dateISO}T00:00:00.000Z`, time),
    endISO: toISOWithClockTime(`${dateISO}T00:00:00.000Z`, addMinutes(time, 5)),
    status: 'planned',
    source: 'system',
    fixed: type === 'wake' || type === 'sleep',
    locked: type === 'wake' || type === 'sleep',
    deletable: type !== 'wake' && type !== 'sleep',
    meta: {
      anchorTier: getAnchorTier({ type, title }),
    },
  };
}

function dedupeById(items: ScheduleItem[]): ScheduleItem[] {
  const byId = new Map<string, ScheduleItem>();
  for (const item of items) {
    byId.set(item.id, item);
  }
  return Array.from(byId.values());
}

export function buildDaySchedule(input: BuildDayScheduleInput): ScheduleItem[] {
  const dateISO = input.dateISO || new Date().toISOString().slice(0, 10);
  const suppressedIds = new Set(input.suppressedIds || []);
  const intent = input.intent || 'REGENERATE';
  const isDeleteIntent = intent === 'DELETE' || intent === 'DELETE_VALIDATE_ONLY';
  const validateOnly = input.validateOnly === true || isDeleteIntent;

  const wake =
    input.settings.wakeClockTime ||
    parseClockTime(input.settings.wakeTime) ||
    ({ hour: 7, minute: 0, period: 'AM' } as ClockTime);

  const sleep =
    input.settings.sleepClockTime ||
    parseClockTime(input.settings.sleepTime) ||
    ({ hour: 11, minute: 0, period: 'PM' } as ClockTime);

  const workStart =
    input.workSchedule?.start ||
    input.settings.workStartClockTime ||
    parseClockTime(input.settings.workStartTime || undefined);

  const workEnd =
    input.workSchedule?.end ||
    input.settings.workEndClockTime ||
    parseClockTime(input.settings.workEndTime || undefined);

  const lunchTime =
    input.workSchedule?.lunch ||
    input.settings.lunchClockTime ||
    parseClockTime(input.settings.lunchTime || undefined);

  const baseExistingItems = (input.existingItems || [])
    .filter((item) => !suppressedIds.has(item.id))
    .filter((item) => item.notes !== 'deleted-marker');

  let candidate: ScheduleItem[];

  if (validateOnly) {
    const hasWake = baseExistingItems.some((item) => item.type === 'wake');
    const hasSleep = baseExistingItems.some((item) => item.type === 'sleep');
    const requiredAnchors: ScheduleItem[] = [];

    if (!hasWake) {
      requiredAnchors.push(createAnchorItem('wake', 'Wake / Start Day', wake, dateISO, 'anchor'));
    }
    if (!hasSleep) {
      requiredAnchors.push(createAnchorItem('sleep', 'Sleep', sleep, dateISO, 'anchor'));
    }

    candidate = dedupeById([...baseExistingItems, ...requiredAnchors]);
  } else {
    const anchors: ScheduleItem[] = [
      createAnchorItem('wake', 'Wake / Start Day', wake, dateISO, 'anchor'),
      createAnchorItem('sleep', 'Sleep', sleep, dateISO, 'anchor'),
    ];

    if (workStart) anchors.push(createAnchorItem('work', 'Work Start', workStart, dateISO, 'start'));
    if (workEnd) anchors.push(createAnchorItem('work', 'Work End', workEnd, dateISO, 'end'));
    if (lunchTime) anchors.push(createAnchorItem('lunch', 'Lunch', lunchTime, dateISO, 'anchor'));

    const filteredAnchors = anchors.filter((item) => !suppressedIds.has(item.id));

    const merged = [
      ...baseExistingItems,
      ...(input.advisorInsertions || []),
      ...(input.actualEvents || []),
    ]
      .filter((item) => !suppressedIds.has(item.id))
      .filter((item) => item.notes !== 'deleted-marker');

    candidate = dedupeById([...filteredAnchors, ...merged]);
  }

  const normalized = normalizeAndValidateTimeline(dedupeBehaviorBlocks(candidate, { dateISO }), {
    ...input.settings,
    wakeClockTime: wake,
    sleepClockTime: sleep,
    workStartClockTime: workStart || input.settings.workStartClockTime,
    workEndClockTime: workEnd || input.settings.workEndClockTime,
    lunchClockTime: lunchTime || input.settings.lunchClockTime,
  }, {
    dateISO,
  });

  return dedupeBehaviorBlocks(normalized.items, { dateISO });
}
~~~

## apps/mobile/src/engine/normalizeTimeline.ts

~~~ts
import type { ClockTime, ScheduleItem, UserProfile } from '@physiology-engine/shared';
import {
  compareClockTime,
  parseClockTime,
  clockTimeFromISO,
  toSortableMinutes,
  addMinutes,
  toISOWithClockTime,
} from '../utils/clockTime';
import { getAnchorTier } from '../utils/getAnchorTier';
import { dedupeBehaviorBlocks } from '../utils/dedupeBehaviorBlocks';

export interface NormalizeTimelineResult {
  items: ScheduleItem[];
  valid: boolean;
  issues: string[];
}

interface NormalizeTimelineOptions {
  dateISO?: string;
}

export function canDeleteScheduleItem(item: Pick<ScheduleItem, 'type'> | null | undefined): boolean {
  if (!item) return false;
  return item.type !== 'wake' && item.type !== 'sleep';
}

interface EnrichedItem extends ScheduleItem {
  __startMin: number;
  __endMin: number;
  __priority: number;
  __sourceClass: 'actual' | 'user' | 'generated';
}

const MIN_DURATION = 5;
const MINUTES_PER_DAY = 24 * 60;

function normalizeMinute(value: number): number {
  const rounded = Math.round(value);
  return ((rounded % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
}

function getClockFromItem(item: ScheduleItem): ClockTime | null {
  if (item.startTime) {
    const parsed = parseClockTime(item.startTime);
    if (parsed) return parsed;
  }
  return clockTimeFromISO(item.startISO);
}

function getEndClockFromItem(item: ScheduleItem): ClockTime | null {
  if (item.endTime) {
    const parsed = parseClockTime(item.endTime);
    if (parsed) return parsed;
  }
  return clockTimeFromISO(item.endISO);
}

function deriveSourceClass(item: ScheduleItem): 'actual' | 'user' | 'generated' {
  if (item.status === 'actual' || item.origin === 'actual') return 'actual';
  if (item.source === 'user' || item.source === 'advisor') return 'user';
  return 'generated';
}

function derivePriority(item: ScheduleItem): number {
  const tier = getAnchorTier(item);
  if (tier === 'hard') return 100;
  if (tier === 'soft') return 70;
  if (item.status === 'actual' || item.origin === 'actual') return 80;
  if (item.source === 'user' || item.source === 'advisor') return 60;
  if (item.locked || item.fixed) return 50;
  return 30;
}

function keyForDedupe(item: EnrichedItem): string {
  const title = (item.title || '').trim().toLowerCase();
  const sameTime = `${item.__startMin}`;
  const src = item.__sourceClass;
  const status = item.status || 'planned';
  return `${item.type}|${title}|${sameTime}|${src}|${status}`;
}

function isOrphan(item: ScheduleItem): boolean {
  if (!item.title || !item.title.trim()) return true;
  if (!item.type) return true;
  return false;
}

function choosePreferred(existing: EnrichedItem, incoming: EnrichedItem): EnrichedItem {
  if (incoming.__priority !== existing.__priority) {
    return incoming.__priority > existing.__priority ? incoming : existing;
  }
  return incoming.updatedAt && existing.updatedAt && incoming.updatedAt > existing.updatedAt ? incoming : existing;
}

function getWakeSleep(settings: UserProfile, items: ScheduleItem[]): { wake: ClockTime; sleep: ClockTime } {
  const wakeFromSettings = settings.wakeClockTime || parseClockTime(settings.wakeTime);
  const sleepFromSettings = settings.sleepClockTime || parseClockTime(settings.sleepTime);

  const wakeFromItems = items.find((item) => item.type === 'wake');
  const sleepFromItems = items.find((item) => item.type === 'sleep');

  const wake = wakeFromSettings || (wakeFromItems ? getClockFromItem(wakeFromItems) : null) || { hour: 7, minute: 0, period: 'AM' as const };
  const sleep = sleepFromSettings || (sleepFromItems ? getClockFromItem(sleepFromItems) : null) || { hour: 11, minute: 0, period: 'PM' as const };

  return { wake, sleep };
}

function shiftFlexibleIntoWindow(item: EnrichedItem, dayStart: number, dayEnd: number): EnrichedItem | null {
  const duration = Math.max(MIN_DURATION, item.__endMin - item.__startMin);
  if (item.__priority >= 60) {
    const clampedStart = Math.max(dayStart, Math.min(item.__startMin, dayEnd - duration));
    if (clampedStart > dayEnd - MIN_DURATION) return null;
    return { ...item, __startMin: clampedStart, __endMin: clampedStart + duration };
  }

  if (item.__startMin < dayStart) {
    const shiftedStart = dayStart;
    if (shiftedStart + duration > dayEnd) return null;
    return { ...item, __startMin: shiftedStart, __endMin: shiftedStart + duration };
  }

  if (item.__endMin > dayEnd) {
    const shiftedStart = dayEnd - duration;
    if (shiftedStart < dayStart) return null;
    return { ...item, __startMin: shiftedStart, __endMin: shiftedStart + duration };
  }

  return item;
}

function resolveOverlaps(items: EnrichedItem[], dayStart: number, dayEnd: number, issues: string[]): EnrichedItem[] {
  const sorted = [...items].sort((a, b) => a.__startMin - b.__startMin || b.__priority - a.__priority);
  const result: EnrichedItem[] = [];

  for (const item of sorted) {
    if (result.length === 0) {
      result.push(item);
      continue;
    }

    const prev = result[result.length - 1];
    if (item.__startMin >= prev.__endMin) {
      result.push(item);
      continue;
    }

    const keepPrev = prev.__priority >= item.__priority;
    const flexible = keepPrev ? item : prev;
    const anchor = keepPrev ? prev : item;

    if (flexible.__priority >= 60) {
      issues.push(`Dropped overlapping protected item: ${flexible.title}`);
      if (!keepPrev) {
        result[result.length - 1] = item;
      }
      continue;
    }

    const duration = Math.max(MIN_DURATION, flexible.__endMin - flexible.__startMin);
    const shiftedStart = anchor.__endMin;
    if (shiftedStart + duration > dayEnd) {
      issues.push(`Dropped overlapping item outside day window: ${flexible.title}`);
      if (!keepPrev) {
        result[result.length - 1] = item;
      }
      continue;
    }

    const shifted = { ...flexible, __startMin: shiftedStart, __endMin: shiftedStart + duration };
    issues.push(`Shifted overlapping item: ${flexible.title}`);

    if (keepPrev) {
      result.push(shifted);
    } else {
      result[result.length - 1] = item;
      result.push(shifted);
    }
  }

  return result;
}

function toScheduleItem(item: EnrichedItem, dateISO: string): ScheduleItem {
  const start = addMinutes({ hour: 12, minute: 0, period: 'AM' }, item.__startMin);
  const end = addMinutes({ hour: 12, minute: 0, period: 'AM' }, item.__endMin);

  return {
    ...item,
    startTime: start,
    endTime: end,
    startMin: normalizeMinute(item.__startMin),
    endMin: normalizeMinute(item.__endMin),
    durationMin: Math.max(MIN_DURATION, item.__endMin - item.__startMin),
    startISO: toISOWithClockTime(`${dateISO}T00:00:00.000Z`, start),
    endISO: toISOWithClockTime(`${dateISO}T00:00:00.000Z`, end),
    locked: item.type === 'wake' || item.type === 'sleep',
    deletable: canDeleteScheduleItem(item),
    meta: {
      ...(item.meta || {}),
      anchorTier: getAnchorTier(item),
    },
  };
}

export function normalizeAndValidateTimeline(
  items: ScheduleItem[],
  settings: UserProfile,
  options?: NormalizeTimelineOptions
): NormalizeTimelineResult {
  const issues: string[] = [];
  const inferredDateISO = items.find((item) => typeof item.startISO === 'string' && item.startISO.includes('T'))?.startISO?.split('T')[0];
  const dateISO = options?.dateISO || inferredDateISO || new Date().toISOString().slice(0, 10);
  const { wake, sleep } = getWakeSleep(settings, items);
  const dayStart = toSortableMinutes(wake);
  const dayEnd = toSortableMinutes(sleep);

  const enriched: EnrichedItem[] = [];

  for (const item of items) {
    if (isOrphan(item)) {
      issues.push(`Removed orphaned item: ${item.id}`);
      continue;
    }

    const startClock = getClockFromItem(item);
    if (!startClock) {
      issues.push(`Removed item with invalid start time: ${item.title}`);
      continue;
    }

    const startMin = toSortableMinutes(startClock);
    const endClock = getEndClockFromItem(item);
    const computedEndMin = endClock
      ? Math.max(toSortableMinutes(endClock), startMin + MIN_DURATION)
      : startMin + Math.max(MIN_DURATION, item.durationMin || MIN_DURATION);

    enriched.push({
      ...item,
      __startMin: startMin,
      __endMin: computedEndMin,
      __priority: derivePriority(item),
      __sourceClass: deriveSourceClass(item),
    });
  }

  const dedupedMap = new Map<string, EnrichedItem>();
  for (const item of enriched) {
    const key = keyForDedupe(item);
    const existing = dedupedMap.get(key);
    if (!existing) {
      dedupedMap.set(key, item);
      continue;
    }

    const keepBothAsPlannedAndActual =
      existing.type === item.type &&
      existing.title.trim().toLowerCase() === item.title.trim().toLowerCase() &&
      existing.__startMin === item.__startMin &&
      ((existing.__sourceClass === 'actual' && item.__sourceClass !== 'actual') ||
        (item.__sourceClass === 'actual' && existing.__sourceClass !== 'actual'));

    if (keepBothAsPlannedAndActual) {
      dedupedMap.set(`${key}|${item.__sourceClass}`, item);
      continue;
    }

    const preferred = choosePreferred(existing, item);
    dedupedMap.set(key, preferred);
    issues.push(`Removed duplicate item: ${existing.id === preferred.id ? item.title : existing.title}`);
  }

  const dayWindowItems: EnrichedItem[] = [];
  for (const item of dedupedMap.values()) {
    if (item.type === 'wake' || item.type === 'sleep') {
      dayWindowItems.push(item);
      continue;
    }

    const shifted = shiftFlexibleIntoWindow(item, dayStart, dayEnd);
    if (!shifted) {
      issues.push(`Dropped illegal out-of-window item: ${item.title}`);
      continue;
    }
    dayWindowItems.push(shifted);
  }

  const wakeItem = dayWindowItems
    .filter((item) => item.type === 'wake')
    .sort((a, b) => b.__priority - a.__priority)[0] || {
    id: `wake-${dateISO}`,
    type: 'wake',
    title: 'Wake / Start Day',
    startISO: toISOWithClockTime(`${dateISO}T00:00:00.000Z`, wake),
    endISO: toISOWithClockTime(`${dateISO}T00:00:00.000Z`, addMinutes(wake, MIN_DURATION)),
    status: 'planned',
    source: 'system',
    fixed: true,
    locked: true,
    deletable: false,
    __startMin: dayStart,
    __endMin: dayStart + MIN_DURATION,
    __priority: 100,
    __sourceClass: 'generated' as const,
  } as EnrichedItem;

  const sleepItem = dayWindowItems
    .filter((item) => item.type === 'sleep')
    .sort((a, b) => b.__priority - a.__priority)[0] || {
    id: `sleep-${dateISO}`,
    type: 'sleep',
    title: 'Sleep',
    startISO: toISOWithClockTime(`${dateISO}T00:00:00.000Z`, sleep),
    endISO: toISOWithClockTime(`${dateISO}T00:00:00.000Z`, addMinutes(sleep, MIN_DURATION)),
    status: 'planned',
    source: 'system',
    fixed: true,
    locked: true,
    deletable: false,
    __startMin: dayEnd,
    __endMin: dayEnd + MIN_DURATION,
    __priority: 100,
    __sourceClass: 'generated' as const,
  } as EnrichedItem;

  wakeItem.__startMin = dayStart;
  wakeItem.__endMin = Math.max(dayStart + MIN_DURATION, wakeItem.__endMin);
  sleepItem.__startMin = dayEnd;
  sleepItem.__endMin = Math.max(dayEnd + MIN_DURATION, sleepItem.__endMin);

  const betweenAnchors = dayWindowItems.filter((item) => item.type !== 'wake' && item.type !== 'sleep');
  const resolvedBetween = resolveOverlaps(betweenAnchors, dayStart, dayEnd, issues)
    .filter((item) => item.__startMin >= dayStart && item.__endMin <= dayEnd)
    .sort((a, b) => a.__startMin - b.__startMin);

  const finalItems = dedupeBehaviorBlocks(
    [wakeItem, ...resolvedBetween, sleepItem].map((item) => toScheduleItem(item, dateISO)),
    { dateISO }
  );

  return {
    items: finalItems,
    valid: issues.length === 0,
    issues,
  };
}
~~~

## apps/mobile/src/store/planStore.ts

~~~ts
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
import { canDeleteScheduleItem } from '../engine/normalizeTimeline';
import { clockTimeFromISO, parseClockTime, toISOWithClockTime } from '../utils/clockTime';
import type { MutationIntent } from '../types/mutationIntent';
import {
  compareByStartMin,
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
  todayPlanSettingsFingerprint: string | null;
  initialized: boolean;

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

  syncToAPI: () => Promise<void>;
  enableAutoRefresh: () => void;
  disableAutoRefresh: () => void;
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

    return {
      ...normalizedTime,
      startTime: startTime || undefined,
      endTime: endTime || undefined,
      startISO: startTime ? toISOWithClockTime(`${dateISO}T00:00:00.000Z`, startTime) : entry.startISO,
      endISO: endTime ? toISOWithClockTime(`${dateISO}T00:00:00.000Z`, endTime) : entry.endISO,
      status,
      source,
      locked: entry.type === 'wake' || entry.type === 'sleep',
      deletable: canDeleteScheduleItem(entry),
      createdAt: entry.createdAt || new Date().toISOString(),
      updatedAt: entry.updatedAt || new Date().toISOString(),
    } as ScheduleItem;
  });

  const sorted = [...normalizedEntries].sort(compareByStartMin);

  const applyMinutesToIso = (baseISO: string, minutesFromMidnight: number): string => {
    const datePart = (baseISO || new Date().toISOString()).split('T')[0];
    const normalized = ((Math.round(minutesFromMidnight) % (24 * 60)) + (24 * 60)) % (24 * 60);
    const hours = String(Math.floor(normalized / 60)).padStart(2, '0');
    const minutes = String(normalized % 60).padStart(2, '0');
    return `${datePart}T${hours}:${minutes}:00.000Z`;
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

function signatureForDeleteGuard(item: Pick<ScheduleItem, 'type' | 'title' | 'startMin' | 'startISO' | 'startTime'>): string {
  const normalizedTitle = (item.title || '').trim().toLowerCase();
  const minuteFromIso =
    typeof item.startISO === 'string' && item.startISO.includes('T')
      ? Number.parseInt(item.startISO.slice(11, 13), 10) * 60 + Number.parseInt(item.startISO.slice(14, 16), 10)
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
    if (item.type === 'wake' || item.type === 'sleep') return false;
    if (deletedItemId && item.id === deletedItemId) return true;
    return !beforeSignatures.has(signatureForDeleteGuard(item));
  });

  if (!unexpectedInserted.length) {
    return { items: afterItems, insertedCount: 0, blockedCount: 0 };
  }

  const unexpectedSignatures = new Set(unexpectedInserted.map((item) => signatureForDeleteGuard(item)));
  const blockedItems = afterItems.filter((item) => {
    if (item.type === 'wake' || item.type === 'sleep') return false;
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
  if (fullDayPlan?.items?.length) {
    return normalizeScheduleEntries(fullDayPlan.items);
  }
  return normalizeScheduleEntries(todayEntries);
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
      if (fullDayPlan?.items?.length) {
        todayEntries = normalizeScheduleEntries(fullDayPlan.items);
      } else {
        const todayEntriesJson = await AsyncStorage.getItem(`todayEntries_${dateKey}`);
        if (todayEntriesJson) {
          todayEntries = normalizeScheduleEntries(JSON.parse(todayEntriesJson));
        }
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
      });

      if (profile && dayState && !fullDayPlan) {
        await get().generatePlan(true);
        await get().generateFullDayPlan();
      }
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
    await get().generateFullDayPlan();
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
    const { profile, fullDayPlan } = get();
    if (!profile || !fullDayPlan) return;

    await get().generateFullDayPlan({
      intent: 'RECOMPUTE_FROM_NOW',
      baseItems: normalizeScheduleEntries(fullDayPlan.items),
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

      const intent = options?.intent ?? (fullDayPlan ? 'EDIT' : 'REGENERATE');
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
        builtPlan = isDeleteIntent
          ? {
              dateISO,
              items: buildDaySchedule({
                dateISO,
                settings: profile,
                existingItems: canonicalBaseItems,
                intent: 'DELETE',
                validateOnly: true,
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

      const finalPlan: DayPlan = isDeleteIntent
        ? {
            ...builtPlan,
            items: dedupeBehaviorBlocks(normalizeScheduleEntries(guardedItems.items), { dateISO }),
            recommendations: [],
          }
        : {
            ...builtPlan,
            items: dedupeBehaviorBlocks(normalizeScheduleEntries(builtPlan.items), { dateISO }),
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

      const alignedEntries = normalizeScheduleEntries(finalPlan.items);
      await AsyncStorage.setItem(`todayEntries_${dateISO}`, JSON.stringify(alignedEntries));

      set({
        fullDayPlan: finalPlan,
        todayEntries: alignedEntries,
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

    const newEntry: ScheduleItem = {
      ...entry,
      id: generateUUID(),
      status: entry.status || (entry.origin === 'actual' ? 'actual' : 'planned'),
      source: entry.source === 'advisor' ? 'advisor' : 'user',
      locked: entry.type === 'wake' || entry.type === 'sleep',
      deletable: canDeleteScheduleItem(entry),
      createdAt: entry.createdAt || nowISO,
      updatedAt: nowISO,
    };

    const updated = applyScheduleMutation({
      currentItems: workingSchedule,
      mutation: { kind: 'add', item: newEntry },
      settings: profile,
      intent: 'ADD',
      dateISO,
    });

    set({ todayEntries: updated });
    await AsyncStorage.setItem(`todayEntries_${dateISO}`, JSON.stringify(updated));

    await get().generateFullDayPlan({
      intent: 'ADD',
      baseItems: updated,
    });

    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
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
        const freshBase = getWorkingSchedule(state.fullDayPlan, state.todayEntries);
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

    const normalized = normalizeScheduleEntries(entries);
    set({ todayEntries: normalized });

    const dateISO = format(new Date(), 'yyyy-MM-dd');
    await AsyncStorage.setItem(`todayEntries_${dateISO}`, JSON.stringify(normalized));

    await get().generateFullDayPlan({
      intent: 'EDIT',
      baseItems: normalized,
    });
  },

  updateTodayEntry: async (id: string, updates: Partial<ScheduleItem>) => {
    const { profile, todayEntries, fullDayPlan } = get();
    if (!profile) return;

    const dateISO = format(new Date(), 'yyyy-MM-dd');
    const workingSchedule = getWorkingSchedule(fullDayPlan, todayEntries);
    const previousItem = workingSchedule.find((item) => item.id === id) || null;

    const updated = applyScheduleMutation({
      currentItems: workingSchedule,
      mutation: { kind: 'edit', id, updates },
      settings: profile,
      intent: 'EDIT',
      dateISO,
    });

    set({ todayEntries: updated });
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
        const freshBase = getWorkingSchedule(state.fullDayPlan, state.todayEntries);
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

    const updated = applyScheduleMutation({
      currentItems: workingSchedule,
      mutation: { kind: 'delete', id },
      settings: profile,
      intent: 'DELETE',
      dateISO,
    });

    set({ todayEntries: updated });
    await AsyncStorage.setItem(`todayEntries_${dateISO}`, JSON.stringify(updated));

    await get().generateFullDayPlan({
      intent: 'DELETE_VALIDATE_ONLY',
      baseItems: updated,
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
~~~

## apps/mobile/src/engine/predictiveDay.ts

~~~ts
import type { UserProfile } from '@physiology-engine/shared';
import type { UserRhythmProfile } from './rhythmIntelligence';

interface PredictiveWorkSchedule {
  start?: string;
  end?: string;
}

interface PredictiveMealTimes {
  firstMeal?: string;
  lunch?: string;
  dinner?: string;
}

export interface PredictiveDayInput {
  wakeTime: string;
  sleepTime: string;
  workSchedule?: PredictiveWorkSchedule;
  mealTimes?: PredictiveMealTimes;
  rhythmProfile?: UserRhythmProfile | null;
  momentumScore?: number;
  stressLevel?: number;
  sleepScore?: number;
  fitnessGoal?: UserProfile['fitnessGoal'];
  dayMode?: UserProfile['defaultDayMode'];
  dietFoundation?: UserProfile['dietFoundation'];
  mealSequence?: UserProfile['mealSequencePreference'];
  completionRate?: number;
  skippedItems?: number;
  fastingHours?: number;
  mealTimingConsistency?: number;
  rhythmStability?: number;
}

export interface PredictiveDayOutput {
  predictedDayMode: string;
  bestFocusWindow: string;
  likelyDipWindow: string;
  bestOpportunityWindow: string;
  topRisk: string;
  bestMove: string;
  estimatedEnergyCurve?: number[];
}

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const parseTimeToMinutes = (value?: string, fallback = 0): number => {
  if (!value) return fallback;
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return fallback;
  const hour = Number.parseInt(match[1], 10);
  const minute = Number.parseInt(match[2], 10);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return fallback;
  return clamp(hour * 60 + minute, 0, 1439);
};

const minutesToWindow = (startMin: number, durationMin: number): string => {
  const endMin = startMin + durationMin;
  const toLabel = (minutes: number) => {
    const normalized = ((minutes % 1440) + 1440) % 1440;
    const hour24 = Math.floor(normalized / 60);
    const minute = normalized % 60;
    const period = hour24 >= 12 ? 'PM' : 'AM';
    const hour12 = (hour24 % 12) || 12;
    return `${hour12}:${String(minute).padStart(2, '0')} ${period}`;
  };
  return `${toLabel(startMin)}-${toLabel(endMin)}`;
};

const minutesToSingle = (minutes: number): string => {
  const normalized = ((minutes % 1440) + 1440) % 1440;
  const hour24 = Math.floor(normalized / 60);
  const minute = normalized % 60;
  const period = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = (hour24 % 12) || 12;
  return `${hour12}:${String(minute).padStart(2, '0')} ${period}`;
};

export function generatePredictiveDay(input: PredictiveDayInput): PredictiveDayOutput {
  const wakeMin = parseTimeToMinutes(input.wakeTime, 7 * 60);
  const sleepMin = parseTimeToMinutes(input.sleepTime, 23 * 60);
  const workStartMin = parseTimeToMinutes(input.workSchedule?.start, wakeMin + 120);
  const lunchMin = parseTimeToMinutes(input.mealTimes?.lunch, wakeMin + 330);

  const rhythmFocusStart = input.rhythmProfile?.focusPeakWindow?.split('-')[0];
  const rhythmCrashStart = input.rhythmProfile?.energyCrashWindow?.split('-')[0];
  const rhythmWalk = input.rhythmProfile?.preferredWalkTime;

  const focusAnchor = rhythmFocusStart ? parseTimeToMinutes(rhythmFocusStart, wakeMin + 90) : wakeMin + 90;
  const dipAnchor = rhythmCrashStart ? parseTimeToMinutes(rhythmCrashStart, lunchMin + 90) : lunchMin + 90;
  const opportunityAnchor = rhythmWalk ? parseTimeToMinutes(rhythmWalk, dipAnchor + 150) : dipAnchor + 150;

  const momentum = clamp(Math.round(input.momentumScore ?? 72), 0, 100);
  const stress = clamp(input.stressLevel ?? 5, 1, 10);
  const sleepScore = clamp(input.sleepScore ?? 7, 1, 10);
  const completionRate = clamp(input.completionRate ?? 0.72, 0, 1);
  const skippedItems = clamp(input.skippedItems ?? 0, 0, 12);
  const fastingHours = clamp(input.fastingHours ?? 14, 10, 18);
  const mealTimingConsistency = clamp(input.mealTimingConsistency ?? 0.72, 0, 1);
  const rhythmStability = clamp(input.rhythmStability ?? input.rhythmProfile?.wakeConsistency ?? 0.72, 0, 1);

  let predictedDayMode = 'High Output Day';
  const tightConstraintSignal = Boolean(input.workSchedule?.start && input.workSchedule?.end) && skippedItems >= 2;
  if (stress >= 8 || sleepScore <= 5 || completionRate < 0.45 || rhythmStability < 0.45) {
    predictedDayMode = 'Recovery-Sensitive Day';
  } else if (tightConstraintSignal) {
    predictedDayMode = 'Tight Constraint Day';
  } else if (stress >= 7 || sleepScore <= 6 || momentum <= 60 || completionRate < 0.62) {
    predictedDayMode = 'Balanced Execution Day';
  }

  const focusDuration = momentum >= 70 ? 90 : 75;
  const focusStart = clamp(
    Math.max(wakeMin + 45, Math.min(focusAnchor, workStartMin + 120)),
    wakeMin + 30,
    Math.max(wakeMin + 30, sleepMin - 240)
  );

  const dipStart = clamp(dipAnchor, wakeMin + 240, Math.max(wakeMin + 240, sleepMin - 180));
  const opportunityStart = clamp(opportunityAnchor, dipStart + 90, Math.max(dipStart + 90, sleepMin - 120));

  const topRisk = (() => {
    if (stress >= 8) return 'High stress may fragment focus blocks and increase plan drift.';
    if (sleepScore <= 5) return 'Low recovery raises midday crash probability and late-day variability.';
    if (mealTimingConsistency < 0.55) return 'Meal timing inconsistency can destabilize midday and late-afternoon energy.';
    if (completionRate < 0.6 || skippedItems >= 3) return 'Lower completion with repeated skips raises schedule drift risk.';
    if (momentum <= 45) return 'Momentum instability can cause skipped anchors and reactive decisions.';
    return 'Lunch timing drift remains the primary risk to afternoon energy stability.';
  })();

  const bestMove = (() => {
    if (predictedDayMode === 'Recovery-Sensitive Day') {
      return 'Protect lunch timing and add a 10-minute post-meal walk to flatten the dip.';
    }
    if (predictedDayMode === 'Tight Constraint Day') {
      return 'Protect hard anchors and keep flexible blocks short to reduce context-switch drift.';
    }
    if (input.fitnessGoal === 'FAT_LOSS' || input.fitnessGoal === 'WEIGHT_LOSS') {
      return 'Keep meal sequence protein-first and lock a short walk within 45 minutes after lunch.';
    }
    if (input.dayMode === 'tight') {
      return 'Front-load one deep work block before noon and keep hydration + movement anchors fixed.';
    }
    return 'Keep lunch on time and add a short post-meal walk to preserve afternoon output.';
  })();

  const baseCurve = [72, 80, 78, 68, 74, 64];
  const energyPenalty = Math.round((10 - sleepScore) * 2 + stress * 1.2 + skippedItems * 1.5);
  const energyLift = Math.round(momentum * 0.08 + completionRate * 10 + mealTimingConsistency * 8 + rhythmStability * 8 + (fastingHours >= 13 && fastingHours <= 16 ? 4 : 0));
  const estimatedEnergyCurve = baseCurve.map((value, index) => {
    const phaseAdjust = index <= 1 ? energyLift * 0.35 : index === 2 ? energyLift * 0.25 : index === 3 ? -energyPenalty * 0.2 : energyLift * 0.15 - energyPenalty * 0.15;
    return clamp(Math.round(value + phaseAdjust), 20, 95);
  });

  return {
    predictedDayMode,
    bestFocusWindow: minutesToWindow(focusStart, focusDuration),
    likelyDipWindow: `${minutesToSingle(dipStart)}-${minutesToSingle(dipStart + 60)}`,
    bestOpportunityWindow: `${minutesToSingle(opportunityStart)} walk or workout`,
    topRisk,
    bestMove,
    estimatedEnergyCurve,
  };
}
~~~

## apps/mobile/src/screens/TimelineScreen.tsx

~~~ts
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { addMinutes, differenceInMinutes, format } from 'date-fns';
import type { ScheduleItem } from '@physiology-engine/shared';
import { usePlanStore } from '../store/planStore';
import EditScheduleItemModal from '../components/EditScheduleItemModal';
import LogActualEventModal, { type ActualLogInput } from '../components/LogActualEventModal';
import TooltipModal from '../components/help/TooltipModal';
import WhyThisModal from '../components/help/WhyThisModal';
import { canDeleteScheduleItem } from '../engine/normalizeTimeline';
import { clockTimeFromISO, formatClockTime, parseClockTime } from '../utils/clockTime';
import { useTodayEntryState } from '../hooks/useTodayEntryState';
import { useFeatureDiscovery } from '../hooks/useFeatureDiscovery';
import { useTheme, Card, Pill, IconButton, PrimaryButton, AppIcon } from '@physiology-engine/ui';
import { safeRenderTimeline } from '../utils/safeRenderTimeline';
import { groupEarlierAndCompletedToday } from '../utils/groupEarlierAndCompletedToday';
import { detectScheduleDrift } from '../utils/detectScheduleDrift';

const iconByType: Record<string, any> = {
  wake: 'sunrise',
  sleep: 'sleep',
  work: 'work',
  meal: 'meal',
  lunch: 'meal',
  snack: 'snack',
  workout: 'workout',
  walk: 'walk',
  focus: 'focus',
  break: 'break',
  meeting: 'meeting',
  hydration: 'water',
  stretch: 'stretch',
  winddown: 'winddown',
  custom: 'calendar',
};

function itemDateISO(item: Pick<ScheduleItem, 'startISO'>, fallbackDateISO: string): string {
  if (typeof item.startISO === 'string' && item.startISO.includes('T')) {
    return item.startISO.split('T')[0];
  }
  return fallbackDateISO;
}

function categoryForItem(item: ScheduleItem): 'movement' | 'focus' | 'meals' | 'recovery' | 'work' | 'sleep' | 'other' {
  if (item.type === 'walk' || item.type === 'workout') return 'movement';
  if (item.type === 'focus') return 'focus';
  if (item.type === 'meal' || item.type === 'lunch' || item.type === 'snack') return 'meals';
  if (item.type === 'break' || item.type === 'stretch' || (item.title || '').toLowerCase().includes('recovery')) return 'recovery';
  if (item.type === 'work' || item.type === 'meeting') return 'work';
  if (item.type === 'wake' || item.type === 'sleep') return 'sleep';
  return 'other';
}

export default function TimelineScreen({ navigation }: any) {
  const { colors, typography, spacing, radius } = useTheme();
  const {
    profile,
    dayState,
    fullDayPlan,
    todayPlanSettingsFingerprint,
    checkStaleness,
    generateFullDayPlan,
    refreshFromNow,
    updateTodayEntry,
    deleteTodayEntry,
    addTodayEntry,
    setTodayEntries,
    autoRefreshEnabled,
  } = usePlanStore();

  const [editingItem, setEditingItem] = useState<ScheduleItem | null>(null);
  const [showLogModal, setShowLogModal] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [dismissRefreshPrompt, setDismissRefreshPrompt] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [showWhyThis, setShowWhyThis] = useState(false);
  const [showCompletedSection, setShowCompletedSection] = useState(false);
  const lastAutoRealignAtRef = useRef(0);

  const discovery = useFeatureDiscovery('timeline-actions', 3);

  const todayISO = format(new Date(), 'yyyy-MM-dd');
  const yesterdayISO = format(addMinutes(new Date(), -24 * 60), 'yyyy-MM-dd');

  const staleness = checkStaleness();
  const entryState = useTodayEntryState({
    fullDayPlan,
    profile,
    settingsFingerprint: todayPlanSettingsFingerprint,
    staleness,
  });

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const todayItems = useMemo(() => {
    if (!fullDayPlan || !profile) return [] as ScheduleItem[];

    const wakeTime = profile.wakeClockTime || parseClockTime(profile.wakeTime) || { hour: 7, minute: 0, period: 'AM' as const };
    const sleepTime = profile.sleepClockTime || parseClockTime(profile.sleepTime) || { hour: 11, minute: 0, period: 'PM' as const };

    const safeItems = safeRenderTimeline(fullDayPlan.items, wakeTime, sleepTime, todayISO);
    return safeItems
      .filter((item) => itemDateISO(item, todayISO) === todayISO)
      .sort((left, right) => (left.startMin || 0) - (right.startMin || 0));
  }, [fullDayPlan, profile, todayISO]);

  const pendingItems = todayItems.filter(
    (item) =>
      item.status !== 'actual' &&
      item.origin !== 'actual' &&
      item.status !== 'skipped'
  );

  const liveNow =
    pendingItems.find((item) => {
      const start = item.startMin || 0;
      const end = item.endMin || start + (item.durationMin || 5);
      return start <= nowMinutes && nowMinutes <= end;
    }) || null;

  const futureItems = pendingItems.filter((item) => (item.startMin || 0) > nowMinutes);
  const nowItem = liveNow || futureItems[0] || null;
  const futureAfterNow = futureItems.filter((item) => !nowItem || item.id !== nowItem.id);
  const comingUp = futureAfterNow.slice(0, 4);
  const laterToday = futureAfterNow.slice(4);

  const completedAndEarlier = useMemo(
    () => groupEarlierAndCompletedToday(todayItems, nowMinutes, todayISO),
    [todayItems, nowMinutes, todayISO]
  );

  const drift = useMemo(() => detectScheduleDrift(now, todayItems), [now, todayItems]);

  useEffect(() => {
    if (!drift.hasDrift || !autoRefreshEnabled) return;

    const elapsed = Date.now() - lastAutoRealignAtRef.current;
    if (elapsed < 10 * 60 * 1000) return;

    lastAutoRealignAtRef.current = Date.now();
    refreshFromNow().catch((error) => {
      console.warn('[Timeline] Auto re-align failed', error);
    });
  }, [drift.hasDrift, autoRefreshEnabled]);

  const updatedAtMinutesAgo = useMemo(() => {
    const updatedAt = todayItems
      .map((item) => item.updatedAt)
      .filter(Boolean)
      .map((iso) => new Date(iso as string))
      .filter((date) => !Number.isNaN(date.getTime()))
      .sort((a, b) => b.getTime() - a.getTime())[0];

    if (!updatedAt) return null;
    return Math.max(0, differenceInMinutes(new Date(), updatedAt));
  }, [todayItems]);

  const refreshToday = async () => {
    setIsBusy(true);
    try {
      await generateFullDayPlan();
      setDismissRefreshPrompt(false);
    } finally {
      setIsBusy(false);
    }
  };

  const handleRefreshFromNow = async () => {
    setIsBusy(true);
    try {
      await refreshFromNow();
    } finally {
      setIsBusy(false);
    }
  };

  const handleSaveItem = async (item: ScheduleItem) => {
    setIsBusy(true);
    try {
      await updateTodayEntry(item.id, item);
      setEditingItem(null);
    } finally {
      setIsBusy(false);
    }
  };

  const handleDeleteSpecificItem = async (item: ScheduleItem) => {
    if (!canDeleteScheduleItem(item)) {
      Alert.alert('Cannot delete', 'Wake and sleep anchors cannot be deleted.');
      return;
    }

    setIsBusy(true);
    try {
      await deleteTodayEntry(item.id);
      if (editingItem?.id === item.id) {
        setEditingItem(null);
      }
    } finally {
      setIsBusy(false);
    }
  };

  const handleDeleteItem = async () => {
    if (!editingItem) return;
    await handleDeleteSpecificItem(editingItem);
  };

  const handleLogActual = async (input: ActualLogInput) => {
    const start = new Date(input.time);
    const duration =
      input.durationMin ||
      (input.type === 'walk'
        ? 20
        : input.type === 'workout'
          ? 35
          : input.type === 'meal'
            ? 30
            : input.type === 'snack'
              ? 15
              : 15);

    const startMin = start.getHours() * 60 + start.getMinutes();

    setIsBusy(true);
    try {
      await addTodayEntry({
        type: input.type === 'caffeine' ? 'custom' : input.type,
        title:
          input.type === 'meal'
            ? `Meal (${input.mealType || 'lean-protein'})`
            : input.type === 'snack'
              ? 'Snack'
              : input.type === 'walk'
                ? 'Walk'
                : input.type === 'workout'
                  ? 'Workout'
                  : 'Caffeine',
        startISO: start.toISOString(),
        endISO: addMinutes(start, duration).toISOString(),
        startMin,
        endMin: startMin + duration,
        durationMin: duration,
        fixed: false,
        locked: false,
        deletable: true,
        source: 'user',
        status: 'actual',
      });
      setShowLogModal(false);
    } finally {
      setIsBusy(false);
    }
  };

  const markDone = async (item: ScheduleItem) => {
    setIsBusy(true);
    try {
      await updateTodayEntry(item.id, {
        status: 'actual',
        origin: 'actual',
        completedAt: new Date().toISOString(),
      });
    } finally {
      setIsBusy(false);
    }
  };

  const addWalkNow = async () => {
    const startMin = now.getHours() * 60 + now.getMinutes();
    setIsBusy(true);
    try {
      await addTodayEntry({
        type: 'walk',
        title: '10min Walk',
        startISO: now.toISOString(),
        endISO: addMinutes(now, 10).toISOString(),
        startMin,
        endMin: startMin + 10,
        durationMin: 10,
        fixed: false,
        locked: false,
        deletable: true,
        source: 'user',
        status: 'planned',
      });
    } finally {
      setIsBusy(false);
    }
  };

  const buildToday = async () => {
    setIsBusy(true);
    try {
      await setTodayEntries([]);
      await generateFullDayPlan();
    } finally {
      setIsBusy(false);
    }
  };

  const nowProgress = useMemo(() => {
    if (!nowItem) return null;
    const start = nowItem.startMin || 0;
    const end = nowItem.endMin || start + (nowItem.durationMin || 5);
    const duration = Math.max(5, end - start);
    const elapsed = Math.max(0, Math.min(duration, nowMinutes - start));
    return {
      elapsed,
      duration,
      ratio: Math.max(0, Math.min(1, elapsed / duration)),
    };
  }, [nowItem, nowMinutes]);

  const accentColorForItem = (item: ScheduleItem) => {
    const category = categoryForItem(item);
    if (category === 'movement') return colors.success;
    if (category === 'focus') return colors.accentPrimary;
    if (category === 'meals') return colors.warning || colors.accentPrimary;
    if (category === 'recovery') return colors.textSecondary;
    if (category === 'work') return colors.textPrimary;
    if (category === 'sleep') return colors.textMuted;
    return colors.borderSubtle;
  };

  const renderTimelineItem = (item: ScheduleItem) => {
    const startClock = item.startTime || clockTimeFromISO(item.startISO);
    const timeLabel = startClock ? formatClockTime(startClock) : '12:00 AM';

    const statusLabel =
      item.status === 'actual' || item.origin === 'actual'
        ? 'Completed'
        : item.status === 'adjusted'
          ? 'Adjusted'
          : item.status === 'skipped'
            ? 'Skipped'
            : 'Scheduled';

    return (
      <TouchableOpacity
        key={item.id}
        onPress={() => setEditingItem(item)}
        onLongPress={() =>
          Alert.alert(item.title, 'Choose an action', [
            { text: 'Mark Done', onPress: () => void markDone(item) },
            ...(canDeleteScheduleItem(item)
              ? [
                  {
                    text: 'Delete',
                    style: 'destructive' as const,
                    onPress: () => void handleDeleteSpecificItem(item),
                  },
                ]
              : []),
            { text: 'Cancel', style: 'cancel' },
          ])
        }
        style={[
          styles.itemRow,
          {
            borderColor: colors.borderSubtle,
            borderLeftColor: accentColorForItem(item),
            borderLeftWidth: 3,
            backgroundColor: colors.surfaceElevated,
          },
        ]}
      >
        <View style={styles.timeCol}>
          <Text style={[typography.caption, { color: colors.textMuted }]}>{timeLabel}</Text>
        </View>

        <View style={styles.bodyCol}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <AppIcon name={iconByType[item.type] || 'calendar'} size={14} color={colors.textSecondary} />
            <Text
              style={[
                typography.bodyM,
                {
                  color: colors.textPrimary,
                  marginLeft: spacing.xs,
                  fontWeight: '600',
                },
              ]}
            >
              {item.title}
            </Text>
          </View>

          <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]} numberOfLines={1}>
            {statusLabel}
          </Text>
        </View>

        {item.status === 'actual' || item.origin === 'actual' ? (
          <AppIcon name="checkCircle" size={18} color={colors.success} />
        ) : item.status === 'skipped' ? (
          <AppIcon name="close" size={18} color={colors.textMuted} />
        ) : (
          <TouchableOpacity onPress={() => void markDone(item)}>
            <AppIcon name="check" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  if (!profile) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.centered}>
          <Text style={[typography.bodyM, { color: colors.textSecondary }]}>Set up your profile first.</Text>
          <PrimaryButton onPress={() => navigation.navigate('Onboarding')} style={{ marginTop: spacing.lg }}>
            Set Up Profile
          </PrimaryButton>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View style={styles.headerTop}>
          <View>
            <Text style={[typography.titleL, { color: colors.textPrimary }]}>Today</Text>
            <Text style={[typography.caption, { color: colors.textMuted }]}>{format(new Date(), 'EEEE, MMM d')}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <IconButton icon="chart" onPress={() => navigation.navigate('Insights')} variant="subtle" />
            <IconButton icon="settings" onPress={() => navigation.navigate('Settings')} variant="subtle" />
          </View>
        </View>

        <View style={styles.rowWrap}>
          <Pill label={dayState?.dayMode || profile.defaultDayMode || 'flex'} variant="accent" style={{ marginRight: spacing.xs, marginBottom: spacing.xs }} />
          <Pill label={`Sleep ${dayState?.sleepQuality || 7}/10`} variant="muted" style={{ marginRight: spacing.xs, marginBottom: spacing.xs }} />
          <Pill label={`Stress ${dayState?.stressLevel || 5}/10`} variant="muted" style={{ marginRight: spacing.xs, marginBottom: spacing.xs }} />
          <Pill label={`Fast ${profile.preferredFastingHours || 14}h`} variant="muted" style={{ marginRight: spacing.xs, marginBottom: spacing.xs }} />
          <Pill label={`Momentum ${staleness}`} variant="muted" style={{ marginBottom: spacing.xs }} />
        </View>

        <View style={styles.rowWrap}>
          <TouchableOpacity onPress={() => navigation.navigate('History', { dateISO: yesterdayISO })} style={{ marginRight: spacing.xs }}>
            <Pill label="Yesterday" variant="muted" />
          </TouchableOpacity>
          <Pill label="Today" variant="accent" style={{ marginRight: spacing.xs }} />
          <TouchableOpacity onPress={() => navigation.navigate('Tomorrow')}>
            <Pill label="Tomorrow" variant="muted" />
          </TouchableOpacity>
        </View>

        {updatedAtMinutesAgo !== null && (
          <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs }]}>Updated {updatedAtMinutesAgo} min ago</Text>
        )}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: spacing['2xl'] }}>
        {discovery.shouldShow(1) ? (
          <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
            <Card>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>Tip: Use “Refresh from now” after delays to re-align the rest of your day.</Text>
              <TouchableOpacity onPress={() => void discovery.advanceLevel()} style={{ marginTop: spacing.xs }}>
                <Text style={[typography.caption, { color: colors.accentPrimary }]}>Dismiss</Text>
              </TouchableOpacity>
            </Card>
          </View>
        ) : null}

        {entryState === 'NO_PLAN' ? (
          <View style={{ padding: spacing.lg }}>
            <Card>
              <Text style={[typography.bodyM, { color: colors.textPrimary, fontWeight: '700' }]}>Build Today</Text>
              <Text style={[typography.caption, { color: colors.textSecondary, marginTop: spacing.xs }]}>No active plan found for today. Build once, then adapt continuously.</Text>
              <PrimaryButton onPress={() => void buildToday()} style={{ marginTop: spacing.md }}>
                {isBusy ? 'Building...' : 'Build Today'}
              </PrimaryButton>
              <TouchableOpacity onPress={() => navigation.navigate('TodaySetup')} style={{ marginTop: spacing.sm }}>
                <Text style={[typography.caption, { color: colors.accentPrimary }]}>Open Morning Briefing setup</Text>
              </TouchableOpacity>
            </Card>
          </View>
        ) : (
          <>
            {drift.hasDrift ? (
              <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
                <Card>
                  <Text style={[typography.bodyM, { color: colors.textPrimary, fontWeight: '700' }]}>Your day drifted slightly</Text>
                  <Text style={[typography.caption, { color: colors.textSecondary, marginTop: spacing.xs }]}>{drift.reason || 'Schedule drift detected.'}</Text>
                  <TouchableOpacity
                    style={{
                      borderWidth: 1,
                      borderColor: colors.accentPrimary,
                      borderRadius: radius.md,
                      paddingHorizontal: spacing.md,
                      paddingVertical: spacing.sm,
                      marginTop: spacing.sm,
                      alignSelf: 'flex-start',
                    }}
                    onPress={() => void handleRefreshFromNow()}
                  >
                    <Text style={[typography.caption, { color: colors.accentPrimary }]}>Re-align day</Text>
                  </TouchableOpacity>
                </Card>
              </View>
            ) : null}

            {entryState === 'HAS_PLAN_BUT_INPUTS_CHANGED' && !dismissRefreshPrompt && (
              <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
                <Card>
                  <Text style={[typography.bodyM, { color: colors.textPrimary, fontWeight: '700' }]}>Your schedule inputs changed. Refresh today’s plan?</Text>
                  <View style={{ flexDirection: 'row', marginTop: spacing.md }}>
                    <TouchableOpacity
                      style={{
                        borderWidth: 1,
                        borderColor: colors.accentPrimary,
                        backgroundColor: colors.accentSoft,
                        borderRadius: radius.md,
                        paddingHorizontal: spacing.md,
                        paddingVertical: spacing.sm,
                        marginRight: spacing.sm,
                      }}
                      onPress={() => void refreshToday()}
                    >
                      <Text style={[typography.caption, { color: colors.accentPrimary }]}>Refresh Plan</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={{
                        borderWidth: 1,
                        borderColor: colors.borderSubtle,
                        borderRadius: radius.md,
                        paddingHorizontal: spacing.md,
                        paddingVertical: spacing.sm,
                      }}
                      onPress={() => setDismissRefreshPrompt(true)}
                    >
                      <Text style={[typography.caption, { color: colors.textSecondary }]}>Keep Current Plan</Text>
                    </TouchableOpacity>
                  </View>
                </Card>
              </View>
            )}

            {(entryState === 'NEEDS_REFRESH_FROM_NOW' || entryState === 'HAS_VALID_PLAN') && (
              <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
                <Card>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={[typography.bodyM, { color: colors.textPrimary, fontWeight: '700' }]}>Now</Text>
                      <TouchableOpacity onPress={() => setShowTooltip(true)} style={{ marginLeft: spacing.xs }}>
                        <Text style={[typography.caption, { color: colors.accentPrimary, fontWeight: '700' }]}>?</Text>
                      </TouchableOpacity>
                    </View>
                    <TouchableOpacity onPress={() => void handleRefreshFromNow()}>
                      <Text style={[typography.caption, { color: colors.accentPrimary }]}>{isBusy ? 'Refreshing...' : 'Refresh from now'}</Text>
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity onPress={() => setShowWhyThis(true)} style={{ alignSelf: 'flex-end', marginTop: spacing.xs }}>
                    <Text style={[typography.caption, { color: colors.accentPrimary }]}>Why this?</Text>
                  </TouchableOpacity>

                  {nowItem ? (
                    <>
                      {renderTimelineItem(nowItem)}
                      {nowProgress ? (
                        <View style={{ marginTop: spacing.xs }}>
                          <View style={{ height: 6, borderRadius: 999, backgroundColor: colors.borderSubtle, overflow: 'hidden' }}>
                            <View
                              style={{
                                width: `${Math.round(nowProgress.ratio * 100)}%`,
                                height: 6,
                                backgroundColor: colors.accentPrimary,
                              }}
                            />
                          </View>
                          <Text style={[typography.caption, { color: colors.textMuted, marginTop: 4 }]}>
                            {nowProgress.elapsed}m / {nowProgress.duration}m
                          </Text>
                        </View>
                      ) : null}
                      {comingUp[0] ? (
                        <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs }]}>Up next: {comingUp[0].title}</Text>
                      ) : null}
                    </>
                  ) : (
                    <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs }]}>No active block right now.</Text>
                  )}

                  <View style={{ flexDirection: 'row', marginTop: spacing.sm }}>
                    <TouchableOpacity
                      onPress={() => setShowLogModal(true)}
                      style={{
                        borderWidth: 1,
                        borderColor: colors.borderSubtle,
                        borderRadius: radius.md,
                        paddingHorizontal: spacing.sm,
                        paddingVertical: spacing.xs,
                        marginRight: spacing.xs,
                      }}
                    >
                      <Text style={[typography.caption, { color: colors.textSecondary }]}>Log Actual</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => void addWalkNow()}
                      style={{
                        borderWidth: 1,
                        borderColor: colors.borderSubtle,
                        borderRadius: radius.md,
                        paddingHorizontal: spacing.sm,
                        paddingVertical: spacing.xs,
                      }}
                    >
                      <Text style={[typography.caption, { color: colors.textSecondary }]}>Insert Walk</Text>
                    </TouchableOpacity>
                  </View>
                </Card>
              </View>
            )}

            <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
              <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.xs }]}>COMING UP</Text>
              {comingUp.length === 0 ? (
                <Card><Text style={[typography.caption, { color: colors.textMuted }]}>No upcoming items.</Text></Card>
              ) : (
                comingUp.map(renderTimelineItem)
              )}
            </View>

            <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
              <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.xs }]}>LATER TODAY</Text>
              {laterToday.length === 0 ? (
                <Card><Text style={[typography.caption, { color: colors.textMuted }]}>No later items.</Text></Card>
              ) : (
                laterToday.map(renderTimelineItem)
              )}
            </View>

            <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
              <TouchableOpacity
                onPress={() => setShowCompletedSection((prev) => !prev)}
                style={{
                  borderWidth: 1,
                  borderColor: colors.borderSubtle,
                  borderRadius: radius.md,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                  backgroundColor: colors.surface,
                }}
              >
                <Text style={[typography.caption, { color: colors.textSecondary }]}>
                  Completed & Earlier Today ({completedAndEarlier.summaryCount}) {showCompletedSection ? '▲' : '▼'}
                </Text>
              </TouchableOpacity>

              {showCompletedSection ? (
                <View style={{ marginTop: spacing.sm }}>
                  {completedAndEarlier.items.length === 0 ? (
                    <Card><Text style={[typography.caption, { color: colors.textMuted }]}>Nothing to show yet.</Text></Card>
                  ) : (
                    completedAndEarlier.items.map(renderTimelineItem)
                  )}
                </View>
              ) : null}
            </View>
          </>
        )}
      </ScrollView>

      <EditScheduleItemModal
        visible={!!editingItem}
        item={editingItem}
        onSave={handleSaveItem}
        onDelete={handleDeleteItem}
        onClose={() => setEditingItem(null)}
        isSaving={isBusy}
      />

      <LogActualEventModal
        visible={showLogModal}
        onClose={() => setShowLogModal(false)}
        onSave={handleLogActual}
        isSaving={isBusy}
      />

      <TooltipModal
        visible={showTooltip}
        onClose={() => setShowTooltip(false)}
        title="Timeline actions"
        description="These controls adapt your live schedule while preserving completed items and stable anchors."
      />

      <WhyThisModal
        visible={showWhyThis}
        onClose={() => setShowWhyThis(false)}
        title="Refresh from now"
        explanation="This preserves completed and earlier items, keeps anchors stable, then recomputes only the remaining portion of today."
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  rowWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  scroll: { flex: 1 },
  itemRow: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  timeCol: {
    width: 72,
    paddingRight: 8,
  },
  bodyCol: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
});
~~~

## apps/mobile/src/screens/TomorrowPreviewScreen.tsx

~~~ts
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DayPlan, ScheduleItem, UserProfile } from '@physiology-engine/shared';
import { addDays, format } from 'date-fns';
import { usePlanStore } from '../store/planStore';
import { getApiBaseUrl } from '../utils/apiBaseUrl';
import { minutesTo12h, minutesToHHmm, parseTimeToMinutes } from '../utils/time';
import { buildTimelinePlan } from '../utils/planGenerator';
import { toISOWithClockTime } from '../utils/clockTime';
import { loadRhythmProfile, type UserRhythmProfile } from '../engine/rhythmIntelligence';
import { generatePredictiveDay, type PredictiveDayOutput } from '../engine/predictiveDay';
import { buildRecommendationContext } from '../utils/recommendationContext';
import { generateRecommendationsFromContext } from '../utils/recommendationEngine';
import { useTheme, Card, PrimaryButton, SecondaryButton, AppIcon } from '@physiology-engine/ui';
import TooltipModal from '../components/help/TooltipModal';
import WhyThisModal from '../components/help/WhyThisModal';
import { useFeatureDiscovery } from '../hooks/useFeatureDiscovery';
import { groupTomorrowItemsBySection } from '../utils/groupTomorrowItemsBySection';
import { calculateScheduleConfidence } from '../utils/calculateScheduleConfidence';
import { dedupeBehaviorBlocks } from '../utils/dedupeBehaviorBlocks';

interface TomorrowPayload {
  dateKey?: string;
  dateISO?: string;
  wakeTime: string;
  sleepTime: string;
  workStartTime?: string;
  workEndTime?: string;
  anchors: Array<{ title: string; time: string }>;
  suggestions?: string[];
  items?: ScheduleItem[];
  predictive?: PredictiveDayOutput;
}

function itemDateISO(item: Pick<ScheduleItem, 'startISO'>, fallbackDateISO: string): string {
  if (typeof item.startISO === 'string' && item.startISO.includes('T')) {
    return item.startISO.split('T')[0];
  }
  return fallbackDateISO;
}

function sortByStart(items: ScheduleItem[]): ScheduleItem[] {
  return [...items].sort((left, right) => (left.startMin || 0) - (right.startMin || 0));
}

function dedupeTomorrowItems(items: ScheduleItem[], dateISO: string): ScheduleItem[] {
  const dayItems = items.filter((i) => itemDateISO(i, dateISO) === dateISO);
  return dedupeBehaviorBlocks(sortByStart(dayItems), { dateISO });
}

function sanitizePreviewPayload(payload: TomorrowPayload, dateISO: string): TomorrowPayload {
  const sanitizedItems = dedupeTomorrowItems(payload.items || [], dateISO);

  const anchors = sanitizedItems
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
    .map((item) => ({
      title: item.title,
      time: minutesToHHmm(item.startMin || 0),
    }));

  return {
    ...payload,
    dateISO,
    items: sanitizedItems,
    anchors,
  };
}

const hasFunctionalPreviewData = (payload: TomorrowPayload | null | undefined, dateISO: string): payload is TomorrowPayload => {
  return !!payload && Array.isArray(payload.items) && payload.items.filter((item) => itemDateISO(item, dateISO) === dateISO).length > 0;
};

function inferMomentumScoreFromToday(plan: DayPlan | null): number {
  if (!plan?.items?.length) return 72;
  const actionable = plan.items.filter((item) => item.type !== 'wake' && item.type !== 'sleep');
  if (!actionable.length) return 72;
  const completed = actionable.filter((item) => item.status === 'actual' || item.origin === 'actual').length;
  const skipped = actionable.filter((item) => item.status === 'skipped').length;
  const raw = 75 + completed * 4 - skipped * 6;
  return Math.max(25, Math.min(95, raw));
}

function inferMealConsistencyFromToday(plan: DayPlan | null): number {
  if (!plan?.items?.length) return 0.7;
  const meals = plan.items.filter((item) => item.type === 'meal' || item.type === 'lunch' || item.type === 'snack');
  if (meals.length < 2) return 0.7;
  const sorted = [...meals].sort((a, b) => (a.startMin || 0) - (b.startMin || 0));
  const gaps: number[] = [];
  for (let index = 1; index < sorted.length; index++) {
    gaps.push((sorted[index].startMin || 0) - (sorted[index - 1].startMin || 0));
  }
  const avgGap = gaps.reduce((sum, value) => sum + value, 0) / gaps.length;
  const spread = gaps.reduce((sum, value) => sum + Math.abs(value - avgGap), 0) / gaps.length;
  return Math.max(0.2, Math.min(1, 1 - spread / 180));
}

function mapPlanToPreviewWithContext(
  plan: DayPlan,
  profile: UserProfile,
  context: {
    dayState?: { dayMode?: string; stressLevel?: number; sleepQuality?: number } | null;
    rhythmProfile?: UserRhythmProfile | null;
    momentumScore?: number;
    todayPlan?: DayPlan | null;
  }
): TomorrowPayload {
  const recommendationContext = buildRecommendationContext({
    dateISO: plan.dateISO,
    profile,
    dayState: null,
    plan,
    todayEntries: plan.items,
  });

  const recommendationOutput = generateRecommendationsFromContext(recommendationContext);
  const tomorrowOnlyItems = dedupeTomorrowItems(plan.items || [], plan.dateISO);

  const anchors = tomorrowOnlyItems
    .filter(
      (item) =>
        item.type === 'wake' ||
        item.type === 'work' ||
        item.type === 'lunch' ||
        item.type === 'meal' ||
        item.type === 'snack' ||
        item.type === 'workout' ||
        item.type === 'walk' ||
        item.type === 'sleep'
    )
    .slice(0, 10)
    .map((item) => ({
      title: item.title,
      time: minutesToHHmm(item.startMin || 0),
    }));

  const mealAnchors = anchors.filter((anchor) => /meal|lunch|snack/i.test(anchor.title));
  const todayItems = context.todayPlan?.items || [];
  const todayActionable = todayItems.filter((item) => item.type !== 'wake' && item.type !== 'sleep');
  const completed = todayActionable.filter((item) => item.status === 'actual' || item.origin === 'actual').length;
  const skipped = todayActionable.filter((item) => item.status === 'skipped').length;
  const completionRate = todayActionable.length ? completed / todayActionable.length : 0.72;

  const predictive = generatePredictiveDay({
    wakeTime: profile.wakeTime,
    sleepTime: profile.sleepTime,
    workSchedule: {
      start: profile.workStartTime,
      end: profile.workEndTime,
    },
    mealTimes: {
      firstMeal: mealAnchors[0]?.time,
      lunch: mealAnchors.find((anchor) => /lunch/i.test(anchor.title))?.time || mealAnchors[1]?.time,
      dinner: mealAnchors[2]?.time,
    },
    rhythmProfile: context.rhythmProfile,
    momentumScore: context.momentumScore,
    stressLevel: context.dayState?.stressLevel,
    sleepScore: context.dayState?.sleepQuality,
    fitnessGoal: profile.fitnessGoal,
    dayMode: (context.dayState?.dayMode as UserProfile['defaultDayMode']) || profile.defaultDayMode,
    dietFoundation: profile.dietFoundation,
    mealSequence: profile.mealSequencePreference,
    completionRate,
    skippedItems: skipped,
    fastingHours: profile.preferredFastingHours,
    mealTimingConsistency: inferMealConsistencyFromToday(context.todayPlan || null),
    rhythmStability: context.rhythmProfile?.wakeConsistency,
  });

  return {
    dateISO: plan.dateISO,
    wakeTime: profile.wakeTime,
    sleepTime: profile.sleepTime,
    workStartTime: profile.workStartTime,
    workEndTime: profile.workEndTime,
    anchors,
    suggestions: recommendationOutput.cards.length ? recommendationOutput.cards : plan.recommendations || [],
    items: tomorrowOnlyItems,
    predictive,
  };
}

function mapPlanToPreview(
  plan: DayPlan,
  profile: UserProfile,
  context?: {
    dayState?: { dayMode?: string; stressLevel?: number; sleepQuality?: number } | null;
    rhythmProfile?: UserRhythmProfile | null;
    momentumScore?: number;
    todayPlan?: DayPlan | null;
  }
): TomorrowPayload {
  return mapPlanToPreviewWithContext(plan, profile, context || {});
}

function withPredictive(
  payload: TomorrowPayload,
  profile: UserProfile,
  context: {
    dayState?: { dayMode?: string; stressLevel?: number; sleepQuality?: number } | null;
    rhythmProfile?: UserRhythmProfile | null;
    momentumScore?: number;
    todayPlan?: DayPlan | null;
  }
): TomorrowPayload {
  if (payload.predictive) return payload;

  const pseudoPlan: DayPlan = {
    dateISO: payload.dateISO || format(addDays(new Date(), 1), 'yyyy-MM-dd'),
    items: dedupeTomorrowItems(payload.items || [], payload.dateISO || format(addDays(new Date(), 1), 'yyyy-MM-dd')),
    recommendations: payload.suggestions || [],
    summary: 'Tomorrow preview',
  } as DayPlan;

  return mapPlanToPreviewWithContext(pseudoPlan, profile, context);
}

export default function TomorrowPreviewScreen() {
  const { colors, typography, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const { getTomorrowPreview, deviceId, profile, fullDayPlan, dayState } = usePlanStore();
  const API_BASE_URL = getApiBaseUrl();

  const [preview, setPreview] = useState<TomorrowPayload | null>(null);
  const [rhythmProfile, setRhythmProfile] = useState<UserRhythmProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [showWhyThis, setShowWhyThis] = useState(false);
  const discovery = useFeatureDiscovery('predictive-day', 3);

  const tomorrowDateISO = format(addDays(new Date(), 1), 'yyyy-MM-dd');
  const tomorrowStorageKey = `tomorrowPreview_${tomorrowDateISO}`;

  const toDisplayTime = (value?: string) => {
    const parsed = parseTimeToMinutes(value);
    if (parsed === null) return value || '';
    return minutesTo12h(parsed);
  };

  const sections = useMemo(
    () => groupTomorrowItemsBySection(preview?.items || [], tomorrowDateISO),
    [preview?.items, tomorrowDateISO]
  );

  const confidence = useMemo(() => {
    const items = preview?.items || [];
    if (!items.length) {
      return calculateScheduleConfidence({
        anchorStability: 0.72,
        sleepConsistency: rhythmProfile?.wakeConsistency ?? 0.7,
        mealConsistency: 0.7,
        scheduleDensity: 0.6,
        overlapCount: 0,
        driftRisk: 0.35,
      });
    }

    const actionable = items.filter((item) => item.type !== 'wake' && item.type !== 'sleep');
    let overlapCount = 0;
    const sorted = [...items].sort((a, b) => (a.startMin || 0) - (b.startMin || 0));
    for (let i = 1; i < sorted.length; i++) {
      const prevEnd = sorted[i - 1].endMin || ((sorted[i - 1].startMin || 0) + (sorted[i - 1].durationMin || 5));
      const currentStart = sorted[i].startMin || 0;
      if (currentStart < prevEnd) overlapCount += 1;
    }

    const mealConsistency = inferMealConsistencyFromToday(fullDayPlan);
    const density = Math.min(1, actionable.length / 10);
    const driftRisk = Math.min(1, ((dayState?.stressLevel || 5) / 10) * 0.5 + (1 - mealConsistency) * 0.5);

    return calculateScheduleConfidence({
      anchorStability: 0.8,
      sleepConsistency: rhythmProfile?.wakeConsistency ?? 0.72,
      mealConsistency,
      scheduleDensity: density,
      overlapCount,
      driftRisk,
    });
  }, [preview?.items, rhythmProfile?.wakeConsistency, fullDayPlan, dayState?.stressLevel]);

  const getFallbackPreview = async () => {
    if (!profile) {
      const fallback = await getTomorrowPreview();
      setPreview(sanitizePreviewPayload(fallback, tomorrowDateISO));
      return;
    }

    const generated = buildTimelinePlan({
      dateISO: tomorrowDateISO,
      settings: profile,
      todayEntries: [],
      constraints: dayState?.constraints,
      plannedMeals: dayState?.plannedMeals,
      plannedWorkouts: dayState?.plannedWorkouts,
      mutationIntent: 'GENERATE_TOMORROW',
      baseItems: [],
    });

    const fallback = mapPlanToPreview(generated, profile, {
      dayState,
      rhythmProfile,
      momentumScore: inferMomentumScoreFromToday(fullDayPlan),
      todayPlan: fullDayPlan,
    });

    setPreview(sanitizePreviewPayload(fallback, tomorrowDateISO));
  };

  const fetchWithTimeout = async (url: string, init?: RequestInit, timeoutMs = 5000) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timeoutId);
    }
  };

  const syncPreviewToApi = async (payload: TomorrowPayload) => {
    if (!deviceId) return;
    await fetchWithTimeout(`${API_BASE_URL}/day/${deviceId}/tomorrow/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile, preview: payload }),
    });
  };

  const loadPreview = async () => {
    setIsLoading(true);
    try {
      const localRhythm = await loadRhythmProfile(deviceId);
      setRhythmProfile(localRhythm);

      const localSaved = await AsyncStorage.getItem(tomorrowStorageKey);
      if (localSaved) {
        const payload = sanitizePreviewPayload(JSON.parse(localSaved) as TomorrowPayload, tomorrowDateISO);
        if (!payload.predictive && profile) {
          const refreshed = withPredictive(payload, profile, {
            dayState,
            rhythmProfile: localRhythm,
            momentumScore: inferMomentumScoreFromToday(fullDayPlan),
            todayPlan: fullDayPlan,
          });
          const sanitized = sanitizePreviewPayload(refreshed, tomorrowDateISO);
          setPreview(sanitized);
          await AsyncStorage.setItem(tomorrowStorageKey, JSON.stringify(sanitized));
        } else {
          setPreview(payload);
        }
        return;
      }

      if (deviceId) {
        const response = await fetchWithTimeout(`${API_BASE_URL}/day/${deviceId}/tomorrow`);
        if (response.ok) {
          const payload = sanitizePreviewPayload((await response.json()) as TomorrowPayload, tomorrowDateISO);
          if (hasFunctionalPreviewData(payload, tomorrowDateISO)) {
            const hydrated = profile
              ? withPredictive(payload, profile, {
                  dayState,
                  rhythmProfile: localRhythm,
                  momentumScore: inferMomentumScoreFromToday(fullDayPlan),
                  todayPlan: fullDayPlan,
                })
              : payload;
            const sanitized = sanitizePreviewPayload(hydrated, tomorrowDateISO);
            setPreview(sanitized);
            await AsyncStorage.setItem(tomorrowStorageKey, JSON.stringify(sanitized));
            return;
          }
        }
      }

      await getFallbackPreview();
    } catch (error) {
      console.warn('[TomorrowPreview] Failed to load API preview, using local fallback', error);
      await getFallbackPreview();
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateTomorrow = async () => {
    if (!profile) {
      await getFallbackPreview();
      return;
    }

    setIsLoading(true);
    try {
      const generatedPlan = buildTimelinePlan({
        dateISO: tomorrowDateISO,
        settings: profile,
        todayEntries: [],
        constraints: dayState?.constraints,
        plannedMeals: dayState?.plannedMeals,
        plannedWorkouts: dayState?.plannedWorkouts,
        mutationIntent: 'GENERATE_TOMORROW',
        baseItems: [],
      });

      const localPayload = sanitizePreviewPayload(
        mapPlanToPreview(generatedPlan, profile, {
          dayState,
          rhythmProfile,
          momentumScore: inferMomentumScoreFromToday(fullDayPlan),
          todayPlan: fullDayPlan,
        }),
        tomorrowDateISO
      );

      setPreview(localPayload);
      await AsyncStorage.setItem(tomorrowStorageKey, JSON.stringify(localPayload));

      if (deviceId) {
        await syncPreviewToApi(localPayload);
      }
    } catch (error) {
      console.warn('[TomorrowPreview] Generate API unavailable, using local fallback', error);
      await getFallbackPreview();
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyTodayStructure = async () => {
    if (!profile || !fullDayPlan) return;

    const wakeMin = parseTimeToMinutes(profile.wakeTime) ?? 420;
    const sleepMin = parseTimeToMinutes(profile.sleepTime) ?? 1380;
    const todayWakeMin = fullDayPlan.items.find((item) => item.type === 'wake')?.startMin ?? wakeMin;
    const offsetFromTodayWake = wakeMin - todayWakeMin;

    const copyable = fullDayPlan.items.filter((item) => {
      const itemDay = itemDateISO(item, fullDayPlan.dateISO || format(new Date(), 'yyyy-MM-dd'));
      return itemDay === (fullDayPlan.dateISO || format(new Date(), 'yyyy-MM-dd')) && item.type !== 'wake' && item.type !== 'sleep';
    });

    const copiedEntries: ScheduleItem[] = copyable.map((item) => {
      const rawStart = (item.startMin ?? wakeMin) + offsetFromTodayWake;
      const duration = Math.max(5, item.durationMin || ((item.endMin ?? rawStart + 5) - rawStart));
      const clampedStart = Math.max(wakeMin + 5, Math.min(rawStart, sleepMin - duration - 5));
      const clampedEnd = clampedStart + duration;

      const startHour24 = Math.floor(clampedStart / 60);
      const startMinute = clampedStart % 60;
      const endHour24 = Math.floor(clampedEnd / 60);
      const endMinute = clampedEnd % 60;

      const startClock = {
        hour: (startHour24 % 12) || 12,
        minute: startMinute,
        period: (startHour24 >= 12 ? 'PM' : 'AM') as 'AM' | 'PM',
      };
      const endClock = {
        hour: (endHour24 % 12) || 12,
        minute: endMinute,
        period: (endHour24 >= 12 ? 'PM' : 'AM') as 'AM' | 'PM',
      };

      return {
        ...item,
        id: `tomorrow-copy-${item.id}`,
        startMin: clampedStart,
        endMin: clampedEnd,
        durationMin: duration,
        startTime: startClock,
        endTime: endClock,
        startISO: toISOWithClockTime(`${tomorrowDateISO}T00:00:00.000Z`, startClock),
        endISO: toISOWithClockTime(`${tomorrowDateISO}T00:00:00.000Z`, endClock),
        source: 'user',
        status: 'planned',
        fixed: false,
        locked: false,
        deletable: item.type !== 'wake' && item.type !== 'sleep',
      } as ScheduleItem;
    });

    const generatedPlan = buildTimelinePlan({
      dateISO: tomorrowDateISO,
      settings: profile,
      todayEntries: [],
      constraints: dayState?.constraints,
      plannedMeals: dayState?.plannedMeals,
      plannedWorkouts: dayState?.plannedWorkouts,
      mutationIntent: 'COPY_TODAY_STRUCTURE',
      baseItems: copiedEntries,
    });

    const localPayload = sanitizePreviewPayload(
      mapPlanToPreview(generatedPlan, profile, {
        dayState,
        rhythmProfile,
        momentumScore: inferMomentumScoreFromToday(fullDayPlan),
        todayPlan: fullDayPlan,
      }),
      tomorrowDateISO
    );

    setPreview(localPayload);
    await AsyncStorage.setItem(tomorrowStorageKey, JSON.stringify(localPayload));

    if (deviceId) {
      try {
        await syncPreviewToApi(localPayload);
      } catch (error) {
        console.warn('[TomorrowPreview] Failed to sync copied structure to API; local preview is saved', error);
      }
    }
  };

  useEffect(() => {
    void loadPreview();
  }, []);

  const renderSection = (title: string, items: ScheduleItem[]) => {
    if (!items.length) return null;

    return (
      <View style={{ marginTop: spacing.md }}>
        <Text style={[typography.bodyM, { color: colors.textSecondary, fontWeight: '600', marginBottom: spacing.xs }]}>{title}</Text>
        {items.map((item) => (
          <Text key={item.id} style={[typography.bodyM, { color: colors.textMuted, marginBottom: 4 }]}>
            • {minutesTo12h(item.startMin || 0)} {item.title}
          </Text>
        ))}
      </View>
    );
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}
    >
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
          <AppIcon name="calendar" size={18} color={colors.textPrimary} />
          <Text style={[typography.titleM, { color: colors.textPrimary, marginLeft: spacing.sm }]}>Tomorrow Preview</Text>
          <Text onPress={() => setShowTooltip(true)} style={[typography.caption, { color: colors.accentPrimary, marginLeft: spacing.sm }]}>?</Text>
        </View>

        {discovery.shouldShow(1) ? (
          <Card>
            <Text style={[typography.caption, { color: colors.textSecondary }]}>
              Predictive Day estimates your best windows tomorrow based on today’s completion, rhythm stability, and anchors.
            </Text>
            <Text
              onPress={() => void discovery.advanceLevel()}
              style={[typography.caption, { color: colors.accentPrimary, marginTop: spacing.xs }]}
            >
              Dismiss
            </Text>
          </Card>
        ) : null}

        {preview ? (
          <>
            <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.sm }]}>Predicted Day</Text>

            <View style={styles.predictiveGrid}>
              <View style={[styles.predictiveCell, { borderColor: colors.borderSubtle, backgroundColor: colors.surface }]}>
                <Text style={[typography.caption, { color: colors.textMuted }]}>Predicted Day Mode</Text>
                <Text style={[typography.bodyM, { color: colors.textPrimary, fontWeight: '700', marginTop: 2 }]}>
                  {preview.predictive?.predictedDayMode || 'Balanced Execution Day'}
                </Text>
              </View>
              <View style={[styles.predictiveCell, { borderColor: colors.borderSubtle, backgroundColor: colors.surface }]}>
                <Text style={[typography.caption, { color: colors.textMuted }]}>Tomorrow Plan Confidence</Text>
                <Text style={[typography.bodyM, { color: colors.textPrimary, fontWeight: '700', marginTop: 2 }]}>
                  {confidence.score}/100 · {confidence.label}
                </Text>
              </View>
              <View style={[styles.predictiveCell, { borderColor: colors.borderSubtle, backgroundColor: colors.surface }]}>
                <Text style={[typography.caption, { color: colors.textMuted }]}>Best Focus Window</Text>
                <Text style={[typography.bodyM, { color: colors.textPrimary, fontWeight: '700', marginTop: 2 }]}>
                  {preview.predictive?.bestFocusWindow || '7:00 AM-8:30 AM'}
                </Text>
              </View>
              <View style={[styles.predictiveCell, { borderColor: colors.borderSubtle, backgroundColor: colors.surface }]}>
                <Text style={[typography.caption, { color: colors.textMuted }]}>Likely Dip</Text>
                <Text style={[typography.bodyM, { color: colors.textPrimary, fontWeight: '700', marginTop: 2 }]}>
                  {preview.predictive?.likelyDipWindow || '1:00 PM'}
                </Text>
              </View>
            </View>

            {preview.predictive?.estimatedEnergyCurve?.length ? (
              <View style={[styles.bestMoveCard, { borderColor: colors.borderSubtle, backgroundColor: colors.surface }]}>
                <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.xs }]}>Estimated Energy Curve</Text>
                <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
                  {preview.predictive.estimatedEnergyCurve.map((value, index) => (
                    <View
                      key={`energy-${index}`}
                      style={{
                        flex: 1,
                        marginRight: index === preview.predictive!.estimatedEnergyCurve!.length - 1 ? 0 : 4,
                        height: 6 + Math.round((value / 100) * 34),
                        borderRadius: 6,
                        backgroundColor: colors.accentPrimary,
                        opacity: 0.25 + value / 150,
                      }}
                    />
                  ))}
                </View>
              </View>
            ) : null}

            <View style={[styles.bestMoveCard, { borderColor: colors.borderSubtle, backgroundColor: colors.surface }]}>
              <Text style={[typography.caption, { color: colors.textMuted }]}>Best Move</Text>
              <Text style={[typography.bodyM, { color: colors.textPrimary, marginTop: 4 }]}>
                {preview.predictive?.bestMove || 'Keep lunch on time and add a short post-meal walk'}
              </Text>
              <Text onPress={() => setShowWhyThis(true)} style={[typography.caption, { color: colors.accentPrimary, marginTop: 6 }]}>
                Why this?
              </Text>
              {preview.predictive?.topRisk ? (
                <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 6 }]}>
                  {preview.predictive.topRisk}
                </Text>
              ) : null}
            </View>

            <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.md, marginBottom: spacing.xs }]}>Tomorrow Anchors</Text>
            <Text style={[typography.bodyM, { color: colors.textSecondary, marginBottom: spacing.xs }]}>Wake: {toDisplayTime(preview.wakeTime)}</Text>
            <Text style={[typography.bodyM, { color: colors.textSecondary, marginBottom: spacing.sm }]}>Sleep: {toDisplayTime(preview.sleepTime)}</Text>
            {preview.workStartTime && preview.workEndTime ? (
              <Text style={[typography.bodyM, { color: colors.textSecondary, marginBottom: spacing.sm }]}>
                Work: {toDisplayTime(preview.workStartTime)} - {toDisplayTime(preview.workEndTime)}
              </Text>
            ) : null}

            {preview.anchors.slice(0, 8).map((anchor, index) => (
              <Text
                key={`${anchor.title}-${index}`}
                style={[typography.bodyM, { color: colors.textMuted, marginBottom: 4 }]}
              >
                • {toDisplayTime(anchor.time)} {anchor.title}
              </Text>
            ))}

            {renderSection('Morning', sections.morning)}
            {renderSection('Midday', sections.midday)}
            {renderSection('Afternoon', sections.afternoon)}
            {renderSection('Evening', sections.evening)}

            {preview.suggestions?.length ? (
              <View style={{ marginTop: spacing.md }}>
                <Text style={[typography.bodyM, { color: colors.textSecondary, fontWeight: '600', marginBottom: spacing.xs }]}>Tomorrow suggestions</Text>
                {preview.suggestions.slice(0, 4).map((suggestion, index) => (
                  <Text key={`${suggestion}-${index}`} style={[typography.bodyM, { color: colors.textMuted, marginBottom: 4 }]}>• {suggestion}</Text>
                ))}
              </View>
            ) : null}
          </>
        ) : (
          <Text style={[typography.bodyM, { color: colors.textMuted }]}>Loading preview...</Text>
        )}

        <PrimaryButton onPress={handleGenerateTomorrow} style={{ marginTop: spacing.lg }}>
          {isLoading ? 'Generating...' : 'Generate Tomorrow Plan'}
        </PrimaryButton>
        <SecondaryButton onPress={handleCopyTodayStructure} style={{ marginTop: spacing.sm }}>
          Copy Today Structure
        </SecondaryButton>
      </Card>

      <TooltipModal
        visible={showTooltip}
        onClose={() => setShowTooltip(false)}
        title="Predictive Day"
        description="This section projects likely day mode, focus windows, confidence, and dip risk for tomorrow from your rhythm and completion patterns."
      />

      <WhyThisModal
        visible={showWhyThis}
        onClose={() => setShowWhyThis(false)}
        title="Best Move explanation"
        explanation="Best Move is selected from forecasted risk windows and opportunity windows where a small action has high impact on tomorrow’s stability."
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  predictiveGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  predictiveCell: {
    width: '48%',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  bestMoveCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
  },
});
~~~

## apps/mobile/src/utils/getAnchorTier.ts

~~~ts
import type { ScheduleItem } from '@physiology-engine/shared';

export type AnchorTier = 'hard' | 'soft' | 'flex';

const SOFT_TYPES = new Set<ScheduleItem['type']>(['meal', 'lunch', 'workout']);
const FLEX_TYPES = new Set<ScheduleItem['type']>(['focus', 'walk', 'break', 'custom', 'stretch']);

function normalizedTitle(item: Pick<ScheduleItem, 'title'>): string {
  return (item.title || '').trim().toLowerCase();
}

export function getAnchorTier(item: Pick<ScheduleItem, 'type' | 'title'>): AnchorTier {
  if (item.type === 'wake' || item.type === 'sleep') return 'hard';

  if (item.type === 'work') {
    const title = normalizedTitle(item);
    if (title.includes('start') || title.includes('end')) return 'hard';
    return 'flex';
  }

  if (SOFT_TYPES.has(item.type)) return 'soft';

  const title = normalizedTitle(item);
  if (title.includes('first meal') || title === 'lunch' || title === 'dinner') return 'soft';

  if (FLEX_TYPES.has(item.type)) return 'flex';
  if (title.includes('mobility') || title.includes('recovery') || title.includes('admin')) return 'flex';

  return 'flex';
}
~~~

## apps/mobile/src/utils/dedupeBehaviorBlocks.ts

~~~ts
import type { ScheduleItem } from '@physiology-engine/shared';

interface DedupeOptions {
  dateISO?: string;
  nearMinutes?: number;
}

function itemDateISO(item: Pick<ScheduleItem, 'startISO'>, fallbackDateISO: string): string {
  if (typeof item.startISO === 'string' && item.startISO.includes('T')) {
    return item.startISO.split('T')[0];
  }
  return fallbackDateISO;
}

function normalizedTitle(item: Pick<ScheduleItem, 'title'>): string {
  return (item.title || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function approxMinute(item: Pick<ScheduleItem, 'startMin'>): number {
  return Math.max(0, item.startMin || 0);
}

export function dedupeBehaviorBlocks(items: ScheduleItem[], options?: DedupeOptions): ScheduleItem[] {
  const nearMinutes = options?.nearMinutes ?? 15;
  const fallbackDateISO = options?.dateISO || new Date().toISOString().slice(0, 10);

  const sorted = [...items].sort((a, b) => (a.startMin || 0) - (b.startMin || 0));
  const deduped: ScheduleItem[] = [];

  for (const item of sorted) {
    const dayKey = itemDateISO(item, fallbackDateISO);
    const titleKey = normalizedTitle(item);
    const start = approxMinute(item);
    const source = item.source || 'system';

    const existingIndex = deduped.findIndex((existing) => {
      const existingDay = itemDateISO(existing, fallbackDateISO);
      if (existingDay !== dayKey) return false;
      if (existing.type !== item.type) return false;
      if (normalizedTitle(existing) !== titleKey) return false;

      const existingStart = approxMinute(existing);
      return Math.abs(existingStart - start) <= nearMinutes;
    });

    if (existingIndex === -1) {
      deduped.push(item);
      continue;
    }

    const existing = deduped[existingIndex];
    const existingUserCreated = existing.source === 'user';
    const incomingUserCreated = source === 'user';

    if (existingUserCreated && incomingUserCreated) {
      deduped.push(item);
      continue;
    }

    if (!existingUserCreated && !incomingUserCreated) {
      const existingActual = existing.status === 'actual' || existing.origin === 'actual';
      const incomingActual = item.status === 'actual' || item.origin === 'actual';
      if (incomingActual && !existingActual) {
        deduped[existingIndex] = item;
      }
      continue;
    }

    if (incomingUserCreated && !existingUserCreated) {
      deduped[existingIndex] = item;
    }
  }

  return deduped;
}
~~~

## apps/mobile/src/utils/getCircadianPhaseWindows.ts

~~~ts
import type { ClockTime } from '@physiology-engine/shared';
import { parseClockTime, toSortableMinutes } from './clockTime';

export interface CircadianPhaseWindow {
  key: 'activation' | 'cognitivePeak' | 'metabolicStabilization' | 'physicalOpportunity' | 'windDown';
  label: string;
  startMin: number;
  endMin: number;
}

function toMinutes(input: ClockTime | string | undefined, fallbackMin: number): number {
  if (!input) return fallbackMin;
  if (typeof input === 'string') {
    const parsed = parseClockTime(input);
    return parsed ? toSortableMinutes(parsed) : fallbackMin;
  }
  return toSortableMinutes(input);
}

function clampRange(startMin: number, endMin: number, floor: number, ceil: number): { startMin: number; endMin: number } {
  const safeStart = Math.max(floor, Math.min(startMin, ceil));
  const safeEnd = Math.max(safeStart + 5, Math.min(endMin, ceil));
  return { startMin: safeStart, endMin: safeEnd };
}

export function getCircadianPhaseWindows(wakeTime: ClockTime | string | undefined, sleepTime: ClockTime | string | undefined): CircadianPhaseWindow[] {
  const wakeMin = toMinutes(wakeTime, 7 * 60);
  const sleepMinRaw = toMinutes(sleepTime, 23 * 60);
  const sleepMin = sleepMinRaw <= wakeMin ? wakeMin + 16 * 60 : sleepMinRaw;

  const dayStart = wakeMin;
  const dayEnd = sleepMin;

  const activation = clampRange(wakeMin, wakeMin + 120, dayStart, dayEnd);
  const cognitivePeak = clampRange(wakeMin + 120, wakeMin + 360, dayStart, dayEnd);
  const metabolic = clampRange(wakeMin + 360, wakeMin + 540, dayStart, dayEnd);
  const physical = clampRange(wakeMin + 540, wakeMin + 720, dayStart, dayEnd);
  const windDown = clampRange(sleepMin - 180, sleepMin, dayStart, dayEnd);

  return [
    { key: 'activation', label: 'Activation Window', ...activation },
    { key: 'cognitivePeak', label: 'Cognitive Peak', ...cognitivePeak },
    { key: 'metabolicStabilization', label: 'Metabolic Stabilization', ...metabolic },
    { key: 'physicalOpportunity', label: 'Physical Opportunity', ...physical },
    { key: 'windDown', label: 'Wind-Down', ...windDown },
  ];
}
~~~

## apps/mobile/src/utils/detectScheduleDrift.ts

~~~ts
import type { ScheduleItem } from '@physiology-engine/shared';

export interface ScheduleDriftResult {
  hasDrift: boolean;
  reason?: string;
  behindCurrentBlockByMin?: number;
  missedMealByMin?: number;
}

function isActual(item: ScheduleItem): boolean {
  return item.status === 'actual' || item.origin === 'actual';
}

export function detectScheduleDrift(currentTime: Date, activePlan: ScheduleItem[]): ScheduleDriftResult {
  if (!activePlan.length) return { hasDrift: false };

  const nowMin = currentTime.getHours() * 60 + currentTime.getMinutes();
  const sorted = [...activePlan].sort((a, b) => (a.startMin || 0) - (b.startMin || 0));

  const current = sorted.find((item) => {
    const start = item.startMin || 0;
    const end = item.endMin || start + (item.durationMin || 5);
    return start <= nowMin && nowMin <= end;
  });

  if (current && !isActual(current)) {
    const behindBy = nowMin - (current.startMin || nowMin);
    if (behindBy > 20) {
      return {
        hasDrift: true,
        reason: 'Current block is running behind schedule',
        behindCurrentBlockByMin: behindBy,
      };
    }
  }

  const keyMeal = sorted.find((item) => (item.type === 'meal' || item.type === 'lunch') && !isActual(item));
  if (keyMeal) {
    const missedBy = nowMin - (keyMeal.startMin || nowMin);
    if (missedBy > 45) {
      return {
        hasDrift: true,
        reason: 'Key meal timing drift detected',
        missedMealByMin: missedBy,
      };
    }
  }

  const overdueImportant = sorted.find((item) => {
    if (isActual(item)) return false;
    if (!(item.type === 'focus' || item.type === 'workout' || item.type === 'work')) return false;
    const end = item.endMin || (item.startMin || 0) + (item.durationMin || 5);
    return end + 25 < nowMin;
  });

  if (overdueImportant) {
    return {
      hasDrift: true,
      reason: `${overdueImportant.title} is significantly overdue`,
    };
  }

  return { hasDrift: false };
}
~~~

## apps/mobile/src/utils/calculateScheduleConfidence.ts

~~~ts
export interface ScheduleConfidenceInput {
  anchorStability: number;
  sleepConsistency: number;
  mealConsistency: number;
  scheduleDensity: number;
  overlapCount: number;
  driftRisk: number;
}

export interface ScheduleConfidenceOutput {
  score: number;
  label: 'High confidence' | 'Moderate confidence' | 'Fragile plan';
}

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

export function calculateScheduleConfidence(input: ScheduleConfidenceInput): ScheduleConfidenceOutput {
  const anchor = clamp(input.anchorStability, 0, 1);
  const sleep = clamp(input.sleepConsistency, 0, 1);
  const meal = clamp(input.mealConsistency, 0, 1);
  const density = clamp(input.scheduleDensity, 0, 1);
  const overlapPenalty = clamp(input.overlapCount / 6, 0, 1);
  const driftPenalty = clamp(input.driftRisk, 0, 1);

  const weighted =
    anchor * 0.28 +
    sleep * 0.2 +
    meal * 0.2 +
    density * 0.12 +
    (1 - overlapPenalty) * 0.1 +
    (1 - driftPenalty) * 0.1;

  const score = Math.round(clamp(weighted * 100, 0, 100));

  if (score >= 75) return { score, label: 'High confidence' };
  if (score >= 50) return { score, label: 'Moderate confidence' };
  return { score, label: 'Fragile plan' };
}
~~~

## apps/mobile/src/utils/groupTomorrowItemsBySection.ts

~~~ts
import type { ScheduleItem } from '@physiology-engine/shared';

export interface TomorrowSections {
  morning: ScheduleItem[];
  midday: ScheduleItem[];
  afternoon: ScheduleItem[];
  evening: ScheduleItem[];
}

function itemDateISO(item: Pick<ScheduleItem, 'startISO'>, fallbackDateISO: string): string {
  if (typeof item.startISO === 'string' && item.startISO.includes('T')) {
    return item.startISO.split('T')[0];
  }
  return fallbackDateISO;
}

export function groupTomorrowItemsBySection(items: ScheduleItem[], dateISO: string): TomorrowSections {
  const sections: TomorrowSections = {
    morning: [],
    midday: [],
    afternoon: [],
    evening: [],
  };

  const tomorrowItems = items
    .filter((item) => itemDateISO(item, dateISO) === dateISO)
    .sort((a, b) => (a.startMin || 0) - (b.startMin || 0));

  for (const item of tomorrowItems) {
    const start = item.startMin || 0;
    if (start < 12 * 60) {
      sections.morning.push(item);
    } else if (start < 15 * 60) {
      sections.midday.push(item);
    } else if (start < 18 * 60) {
      sections.afternoon.push(item);
    } else {
      sections.evening.push(item);
    }
  }

  return sections;
}
~~~

## apps/mobile/src/utils/groupEarlierAndCompletedToday.ts

~~~ts
import type { ScheduleItem } from '@physiology-engine/shared';

function itemDateISO(item: Pick<ScheduleItem, 'startISO'>, fallbackDateISO: string): string {
  if (typeof item.startISO === 'string' && item.startISO.includes('T')) {
    return item.startISO.split('T')[0];
  }
  return fallbackDateISO;
}

function isCompleted(item: ScheduleItem): boolean {
  return item.status === 'actual' || item.origin === 'actual';
}

function isSkipped(item: ScheduleItem): boolean {
  return item.status === 'skipped';
}

export function groupEarlierAndCompletedToday(
  items: ScheduleItem[],
  nowMinutes: number,
  todayISO: string
): { summaryCount: number; items: ScheduleItem[] } {
  const todayItems = items
    .filter((item) => itemDateISO(item, todayISO) === todayISO)
    .sort((a, b) => (a.startMin || 0) - (b.startMin || 0));

  const grouped = todayItems.filter((item) => {
    if (item.type === 'wake' || item.type === 'sleep') return false;
    if (isCompleted(item) || isSkipped(item)) return true;
    const endMin = item.endMin ?? ((item.startMin || 0) + (item.durationMin || 5));
    return endMin < nowMinutes;
  });

  return {
    summaryCount: grouped.length,
    items: grouped,
  };
}
~~~

## apps/mobile/src/utils/shouldAutoRecomputeFromNow.ts

~~~ts
import type { ScheduleItem } from '@physiology-engine/shared';
import type { MutationIntent } from '../types/mutationIntent';

export interface AutoRecomputeChangeContext {
  action: 'mark-actual' | 'mark-skipped' | 'log-meal' | 'log-walk' | 'log-workout' | 'edit-future-time' | 'drift-detected' | 'other';
  nowMinutes: number;
  affectedItem?: Pick<ScheduleItem, 'type' | 'startMin' | 'status' | 'origin'> | null;
  intent?: MutationIntent;
}

export function shouldAutoRecomputeFromNow(context: AutoRecomputeChangeContext): boolean {
  if (context.intent === 'DELETE' || context.intent === 'DELETE_VALIDATE_ONLY') return false;
  if (context.intent === 'GENERATE_TOMORROW' || context.intent === 'COPY_TODAY_STRUCTURE') return false;

  if (context.action === 'drift-detected') return true;
  if (context.action === 'mark-actual' || context.action === 'mark-skipped') return true;
  if (context.action === 'log-meal' || context.action === 'log-walk' || context.action === 'log-workout') return true;

  if (context.action === 'edit-future-time') {
    const start = context.affectedItem?.startMin ?? 0;
    return start > context.nowMinutes;
  }

  return false;
}
~~~

## apps/mobile/src/utils/safeRenderTimeline.ts

~~~ts
import type { ClockTime, ScheduleItem } from '@physiology-engine/shared';
import { validateSchedule } from '../engine/validateSchedule';

export function safeRenderTimeline(
  items: ScheduleItem[],
  wakeTime: ClockTime,
  sleepTime: ClockTime,
  dateISO: string
): ScheduleItem[] {
  try {
    const validation = validateSchedule({
      items,
      wakeTime,
      sleepTime,
      dateISO,
    });

    return [...validation.items].sort((a, b) => (a.startMin || 0) - (b.startMin || 0));
  } catch (error) {
    console.warn('[safeRenderTimeline] Timeline validation failed, recovering with fallback sort', error);
    return [...items]
      .filter((item) => item && item.type && item.title)
      .sort((a, b) => (a.startMin || 0) - (b.startMin || 0));
  }
}
~~~
