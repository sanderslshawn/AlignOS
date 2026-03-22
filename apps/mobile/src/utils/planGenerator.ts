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
import {
  addMinutes as addClockMinutes,
  parseClockTime,
  toISOWithClockTime,
} from './clockTime';
import type { MutationIntent } from '../types/mutationIntent';
import { dedupeBehaviorBlocks } from './dedupeBehaviorBlocks';
import { getAnchorTier, isHardAnchorTier } from './getAnchorTier';
import { getCircadianPhaseWindows } from './getCircadianPhaseWindows';
import { optimizeAroundAnchors, stableSortTimeline } from '../engine/anchorPlanning';

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

function suppressionKeyForItem(
  item: Pick<ScheduleItem, 'type' | 'title' | 'startMin' | 'startISO' | 'startTime'>
): string {
  const normalizedTitle = (item.title || '').trim().toLowerCase();
  return `${item.type}|${normalizedTitle}`;
}

function suppressionExactKeyForItem(
  item: Pick<ScheduleItem, 'type' | 'title' | 'startMin' | 'startISO' | 'startTime'>
): string {
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
    ? (((item.startTime.period === 'PM'
        ? (item.startTime.hour % 12) + 12
        : item.startTime.hour % 12) * 60) + item.startTime.minute)
    : undefined;

  const startMinute = item.startMin ?? minuteFromIso ?? minuteFromTime ?? 0;
  return `${item.type}|${normalizedTitle}|${startMinute}`;
}

function getSuppressionMarkers(items: ScheduleItem[], dateISO: string) {
  const normalized = normalizeAllItemsToDate(items || [], dateISO);

  const deletionMarkers = normalized.filter((item) => item.notes === 'deleted-marker');

  const suppressedIds = new Set(
    deletionMarkers
      .map((item) => item.meta?.suppressedId as string | undefined)
      .filter((value): value is string => Boolean(value))
  );

  const suppressedKeys = new Set(
    deletionMarkers
      .map((item) => item.meta?.suppressedKey as string | undefined)
      .filter((value): value is string => Boolean(value))
  );

  const suppressedExactKeys = new Set(
    deletionMarkers
      .map((item) => item.meta?.suppressedExactKey as string | undefined)
      .filter((value): value is string => Boolean(value))
  );

  return { suppressedIds, suppressedKeys, suppressedExactKeys };
}

function stripSettingsDerivedStructuralItems(items: ScheduleItem[]): ScheduleItem[] {
  return (items || []).filter((item) => {
    const isSettingsDerived =
      item.source === 'settings' ||
      item.source === 'engine' ||
      item.source === 'generated' ||
      item.source === 'system';

    const isStructuralGeneratedBlock =
      item.type === 'work' ||
      item.type === 'commute' ||
      item.type === 'lunch';

    return !(isSettingsDerived && isStructuralGeneratedBlock);
  });
}

function sortByStart(items: ScheduleItem[]): ScheduleItem[] {
  return stableSortTimeline(items);
}

function minuteToClock(
  minutesFromMidnight: number
): { hour: number; minute: number; period: 'AM' | 'PM' } {
  const normalized = ((Math.round(minutesFromMidnight) % (24 * 60)) + (24 * 60)) % (24 * 60);
  const hour24 = Math.floor(normalized / 60);
  const minute = normalized % 60;

  return {
    hour: (hour24 % 12) || 12,
    minute,
    period: hour24 >= 12 ? 'PM' : 'AM',
  };
}

function normalizeItemToDate(item: ScheduleItem, dateISO: string): ScheduleItem {
  const startMin = item.startMin || 0;
  const duration = Math.max(5, item.durationMin || ((item.endMin || startMin + 5) - startMin));
  const endMin = item.endMin ?? startMin + duration;

  const startClock =
    item.startTime || minuteToClock(startMin);

  const endClock =
    item.endTime || minuteToClock(endMin);

  return {
    ...item,
    startMin,
    endMin,
    durationMin: duration,
    startTime: startClock,
    endTime: endClock,
    startISO: toISOWithClockTime(dateISO, startClock),
    endISO: toISOWithClockTime(dateISO, endClock),
  };
}

function normalizeAllItemsToDate(items: ScheduleItem[], dateISO: string): ScheduleItem[] {
  return items.map((item) => normalizeItemToDate(item, dateISO));
}

function dedupeItems(items: ScheduleItem[], dateISO: string): ScheduleItem[] {
  const map = new Map<string, ScheduleItem>();

  for (const item of sortByStart(normalizeAllItemsToDate(items, dateISO))) {
    const key = `${suppressionExactKeyForItem(item)}|${item.status || 'planned'}|${item.source || 'system'}`;
    const existing = map.get(key);

    if (!existing) {
      map.set(key, item);
      continue;
    }

    const existingPriority =
      existing.status === 'actual' || existing.origin === 'actual'
        ? 3
        : existing.source === 'user'
          ? 2
          : 1;

    const incomingPriority =
      item.status === 'actual' || item.origin === 'actual'
        ? 3
        : item.source === 'user'
          ? 2
          : 1;

    if (incomingPriority >= existingPriority) {
      map.set(key, item);
    }
  }

  return sortByStart(Array.from(map.values()));
}

function sameDayUserVisibleEntries(items: ScheduleItem[], dateISO: string): ScheduleItem[] {
  return dedupeBehaviorBlocks(
    dedupeItems(
      normalizeAllItemsToDate(
        items.filter((item) => item.notes !== 'deleted-marker'),
        dateISO
      ),
      dateISO
    ),
    { dateISO }
  );
}

function inferCircadianTarget(
  item: ScheduleItem
): 'activation' | 'cognitivePeak' | 'metabolicStabilization' | 'physicalOpportunity' | 'windDown' | null {
  const title = (item.title || '').trim().toLowerCase();

  if (title.includes('light') || title.includes('morning mobility') || title.includes('mobility')) {
    return 'activation';
  }
  if (item.type === 'focus' || title.includes('deep work') || title.includes('focus')) {
    return 'cognitivePeak';
  }
  if (item.type === 'meal' || item.type === 'lunch' || item.type === 'snack') {
    return 'metabolicStabilization';
  }
  if (item.type === 'workout' || item.type === 'walk') {
    return 'physicalOpportunity';
  }
  if (title.includes('wind') || title.includes('stretch')) {
    return 'windDown';
  }

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
    if (getAnchorTier(item) !== 'tier5') return item;

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

function isGenerationIntent(intent: MutationIntent): boolean {
  return (
    intent === 'REGENERATE' ||
    intent === 'RECOMPUTE_FROM_NOW' ||
    intent === 'GENERATE_TOMORROW'
  );
}

export function buildTimelinePlan(params: BuildTimelineParams): DayPlan {
  const mutationIntent = params.mutationIntent || 'REGENERATE';
  const isGeneration = isGenerationIntent(mutationIntent);

  const userVisibleEntries = sameDayUserVisibleEntries(params.todayEntries, params.dateISO);
  const { suppressedIds, suppressedKeys, suppressedExactKeys } = getSuppressionMarkers(
    params.todayEntries,
    params.dateISO
  );

  const wake =
    params.settings.wakeClockTime ||
    parseClockTime(params.settings.wakeTime) ||
    { hour: 7, minute: 0, period: 'AM' as const };

  const sleep =
    params.settings.sleepClockTime ||
    parseClockTime(params.settings.sleepTime) ||
    { hour: 11, minute: 0, period: 'PM' as const };

  if (mutationIntent === 'RECOMPUTE_FROM_NOW') {
    const baseItems = dedupeBehaviorBlocks(
      dedupeItems(normalizeAllItemsToDate(params.baseItems || userVisibleEntries, params.dateISO), params.dateISO),
      { dateISO: params.dateISO }
    );

    const cleanedBaseItems = stripSettingsDerivedStructuralItems(baseItems);

    const todayISO = new Date().toISOString().slice(0, 10);
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const isCurrentDay = params.dateISO === todayISO;

    const preserved = cleanedBaseItems.filter((item) => {
      if (item.notes === 'deleted-marker') return true;
      if (isHardAnchorTier(getAnchorTier(item))) return true;
      if (item.status === 'actual' || item.origin === 'actual') return true;
      if (item.status === 'skipped') return true;
      if (item.source === 'user' || item.source === 'advisor') return true;
      if (item.isSystemAnchor || item.isFixedAnchor || item.fixed || item.locked) return true;

      if (!isCurrentDay) return false;
      const endMin = item.endMin ?? ((item.startMin || 0) + (item.durationMin || 5));
      return endMin <= nowMinutes;
    });

    const generatedFuturePlan = generateDayPlan({
      dateISO: params.dateISO,
      settings: params.settings,
      todayEntries: preserved.filter((item) => item.notes !== 'deleted-marker'),
      constraints: params.constraints,
      plannedWorkouts: params.plannedWorkouts,
      plannedMeals: params.plannedMeals,
    });

    const normalizedGeneratedFuture = normalizeAllItemsToDate(generatedFuturePlan.items || [], params.dateISO);

    const preservedSignature = new Set(
      preserved
        .filter((item) => item.notes !== 'deleted-marker')
        .map((item) => `${item.type}|${(item.title || '').trim().toLowerCase()}|${item.startMin || 0}`)
    );

    const futureOnly = normalizedGeneratedFuture.filter((item) => {
      const start = item.startMin || 0;
      if (item.type === 'wake' || item.type === 'sleep') return false;
      if (isCurrentDay && start <= nowMinutes) return false;
      if (suppressedIds.has(item.id)) return false;
      if (suppressedKeys.has(suppressionKeyForItem(item))) return false;
      if (suppressedExactKeys.has(suppressionExactKeyForItem(item))) return false;

      const signature = `${item.type}|${(item.title || '').trim().toLowerCase()}|${item.startMin || 0}`;
      return !preservedSignature.has(signature);
    });

    const combined = dedupeBehaviorBlocks(
      dedupeItems(
        applyCircadianPlacement(
          [
            ...preserved.filter((item) => item.notes !== 'deleted-marker'),
            ...futureOnly,
          ],
          params
        ),
        params.dateISO
      ),
      { dateISO: params.dateISO }
    );

    const optimizedCombined = optimizeAroundAnchors(combined).items;

    const validated = validateSchedule({
      items: optimizedCombined,
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

  if (isGeneration) {
    const cleanedUserVisibleEntries = stripSettingsDerivedStructuralItems(userVisibleEntries);

    const rawPlan = generateDayPlan({
      dateISO: params.dateISO,
      settings: params.settings,
      todayEntries: cleanedUserVisibleEntries,
      constraints: params.constraints,
      plannedWorkouts: params.plannedWorkouts,
      plannedMeals: params.plannedMeals,
    });

    const normalizedGenerated = normalizeAllItemsToDate(rawPlan.items || [], params.dateISO);

    const filteredGeneratedItems = normalizedGenerated.filter(
      (item) =>
        !suppressedIds.has(item.id) &&
        !suppressedKeys.has(suppressionKeyForItem(item)) &&
        !suppressedExactKeys.has(suppressionExactKeyForItem(item))
    );

    const circadianAligned = applyCircadianPlacement(filteredGeneratedItems, params);

    const optimizedGenerated = optimizeAroundAnchors(
      dedupeBehaviorBlocks(dedupeItems(circadianAligned, params.dateISO), { dateISO: params.dateISO })
    ).items;

    const validated = validateSchedule({
      items: optimizedGenerated,
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

  const sameDayBaseItems = dedupeBehaviorBlocks(
    dedupeItems(normalizeAllItemsToDate(params.baseItems || userVisibleEntries, params.dateISO), params.dateISO),
    { dateISO: params.dateISO }
  );

  const timelineItems = buildDaySchedule({
    dateISO: params.dateISO,
    settings: params.settings,
    existingItems: sameDayBaseItems,
    intent: mutationIntent,
    validateOnly: mutationIntent === 'DELETE_VALIDATE_ONLY',
  });

  const validation = validateSchedule({
    items: dedupeBehaviorBlocks(
      normalizeAllItemsToDate(timelineItems, params.dateISO),
      { dateISO: params.dateISO }
    ),
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