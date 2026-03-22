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

export function canDeleteScheduleItem(
  item:
    | (Pick<ScheduleItem, 'type'> & Partial<Pick<ScheduleItem, 'isSystemAnchor'>>)
    | null
    | undefined
): boolean {
  if (!item) return false;
  // Allow deleting meals (e.g., lunch) even when they are marked as system anchors.
  if (item.type === 'wake' || item.type === 'sleep') return false;
  if (item.isSystemAnchor && item.type !== 'meal') return false;
  return true;
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
  if (tier === 'tier1') return 120;
  if (tier === 'tier2') return 110;
  if (tier === 'tier4') return 105;
  if (tier === 'tier3') return 95;
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

  const legacyIsAnchor = Boolean(item.meta && (item.meta as any).isAnchor);
  const isSystemAnchor = Boolean(item.isSystemAnchor || item.type === 'wake' || item.type === 'sleep');
  const isFixedAnchor = Boolean(item.isFixedAnchor || item.fixed || legacyIsAnchor);

  return {
    ...item,
    startTime: start,
    endTime: end,
    startMin: normalizeMinute(item.__startMin),
    endMin: normalizeMinute(item.__endMin),
    durationMin: Math.max(MIN_DURATION, item.__endMin - item.__startMin),
    startISO: toISOWithClockTime(`${dateISO}T00:00:00.000Z`, start),
    endISO: toISOWithClockTime(`${dateISO}T00:00:00.000Z`, end),
    isSystemAnchor,
    isFixedAnchor,
    fixed: isFixedAnchor,
    locked: isSystemAnchor ? true : Boolean(item.locked),
    deletable: canDeleteScheduleItem(item),
    meta: {
      ...(item.meta || {}),
      isAnchor: isSystemAnchor,
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
    isSystemAnchor: true,
    isFixedAnchor: true,
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
    isSystemAnchor: true,
    isFixedAnchor: true,
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
