import type { ScheduleItem } from '@physiology-engine/shared';
import { getAnchorTier, isHardAnchorTier } from '../utils/getAnchorTier';

export interface AnchorRecommendationAction {
  id: string;
  title: string;
  description: string;
  actionType: 'move' | 'shorten' | 'insert' | 'remove';
  payload:
    | { kind: 'move'; itemId: string; startMin: number; endMin: number }
    | { kind: 'shorten'; itemId: string; endMin: number; durationMin: number }
    | { kind: 'insert'; item: Omit<ScheduleItem, 'id'> }
    | { kind: 'remove'; itemId: string };
}

export interface AnchorOptimizationResult {
  items: ScheduleItem[];
  displacedFlexible: ScheduleItem[];
}

export function stableSortTimeline(items: ScheduleItem[]): ScheduleItem[] {
  return [...(items || [])].sort((a, b) => {
    const aStart = typeof a.startMin === 'number' ? a.startMin : 0;
    const bStart = typeof b.startMin === 'number' ? b.startMin : 0;
    if (aStart !== bStart) return aStart - bStart;
    return String(a.id || '').localeCompare(String(b.id || ''));
  });
}

function toInterval(item: ScheduleItem): { start: number; end: number } {
  const start = typeof item.startMin === 'number' ? item.startMin : 0;
  const duration = Math.max(5, item.durationMin || ((item.endMin || start + 5) - start));
  const end = typeof item.endMin === 'number' ? Math.max(item.endMin, start + 5) : start + duration;
  return { start, end };
}

function overlaps(a: { start: number; end: number }, b: { start: number; end: number }): boolean {
  return a.start < b.end && b.start < a.end;
}

function resolveWindowBoundaries(
  hardAnchors: ScheduleItem[],
  itemStart: number,
  fallbackStart: number,
  fallbackEnd: number
): { windowStart: number; windowEnd: number } {
  const sorted = stableSortTimeline(hardAnchors);
  let previousHardEnd = fallbackStart;
  let nextHardStart = fallbackEnd;

  for (const anchor of sorted) {
    const interval = toInterval(anchor);
    if (interval.start <= itemStart) {
      previousHardEnd = Math.max(previousHardEnd, interval.end);
      continue;
    }
    nextHardStart = interval.start;
    break;
  }

  return { windowStart: previousHardEnd, windowEnd: nextHardStart };
}

function findGap(
  occupied: Array<{ start: number; end: number }>,
  preferredStart: number,
  duration: number,
  windowStart: number,
  windowEnd: number
): number | null {
  if (windowEnd - windowStart < duration) return null;

  const sortedOccupied = [...occupied]
    .filter((slot) => slot.end > windowStart && slot.start < windowEnd)
    .sort((a, b) => a.start - b.start);

  const clampedPreferred = Math.max(windowStart, Math.min(preferredStart, windowEnd - duration));
  const preferredInterval = { start: clampedPreferred, end: clampedPreferred + duration };

  if (!sortedOccupied.some((slot) => overlaps(slot, preferredInterval))) {
    return clampedPreferred;
  }

  let cursor = windowStart;
  for (const slot of sortedOccupied) {
    if (cursor + duration <= slot.start) return cursor;
    cursor = Math.max(cursor, slot.end);
  }

  if (cursor + duration <= windowEnd) return cursor;
  return null;
}

export function optimizeAroundAnchors(items: ScheduleItem[]): AnchorOptimizationResult {
  const sorted = stableSortTimeline(items || []);

  const hardAnchors = sorted.filter((item) => isHardAnchorTier(getAnchorTier(item)));
  const protectedItems = sorted.filter((item) => {
    const tier = getAnchorTier(item);
    return tier === 'tier3' || tier === 'tier4';
  });
  const flexibleItems = sorted.filter((item) => getAnchorTier(item) === 'tier5');

  const wake = sorted.find((item) => item.type === 'wake');
  const sleep = sorted.find((item) => item.type === 'sleep');
  const dayStart = typeof wake?.startMin === 'number' ? wake.startMin : 0;
  const dayEnd = typeof sleep?.startMin === 'number' ? sleep.startMin : 24 * 60;

  const placed: ScheduleItem[] = [...hardAnchors, ...protectedItems];
  const occupied = placed.map(toInterval);
  const displacedFlexible: ScheduleItem[] = [];

  for (const flex of flexibleItems) {
    const interval = toInterval(flex);
    const { windowStart, windowEnd } = resolveWindowBoundaries(
      hardAnchors,
      interval.start,
      dayStart,
      dayEnd
    );

    const gapStart = findGap(occupied, interval.start, interval.end - interval.start, windowStart, windowEnd);
    if (gapStart === null) {
      displacedFlexible.push(flex);
      continue;
    }

    const duration = Math.max(5, interval.end - interval.start);
    const updated: ScheduleItem = {
      ...flex,
      startMin: gapStart,
      endMin: gapStart + duration,
      durationMin: duration,
      status: flex.status === 'planned' ? 'adjusted' : flex.status,
    };

    placed.push(updated);
    occupied.push({ start: gapStart, end: gapStart + duration });
  }

  return {
    items: stableSortTimeline(placed),
    displacedFlexible: stableSortTimeline(displacedFlexible),
  };
}

function createSuggestionId(prefix: string, itemId: string): string {
  return `${prefix}-${itemId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export function buildAnchorConflictRecommendations(
  beforeItems: ScheduleItem[],
  anchorItem: ScheduleItem
): AnchorRecommendationAction[] {
  const anchorInterval = toInterval(anchorItem);
  const anchorTier = getAnchorTier(anchorItem);
  if (!isHardAnchorTier(anchorTier)) return [];

  const conflictingFlex = stableSortTimeline(beforeItems).filter((item) => {
    if (item.id === anchorItem.id) return false;
    if (getAnchorTier(item) !== 'tier5') return false;
    return overlaps(toInterval(item), anchorInterval);
  });

  return conflictingFlex.map((item, index) => {
    const interval = toInterval(item);
    const duration = Math.max(5, interval.end - interval.start);

    if (item.type === 'meal' || item.type === 'lunch') {
      const shiftedStart = Math.max(0, interval.start - 30);
      return {
        id: createSuggestionId('shift-lunch', item.id),
        title: 'Shift lunch earlier by 30 min',
        description: `Move \"${item.title}\" earlier to avoid overlap with ${anchorItem.title}.`,
        actionType: 'move',
        payload: {
          kind: 'move',
          itemId: item.id,
          startMin: shiftedStart,
          endMin: shiftedStart + duration,
        },
      };
    }

    if (item.type === 'focus') {
      const shortenedDuration = Math.max(15, duration - 15);
      return {
        id: createSuggestionId('shorten-focus', item.id),
        title: 'Shorten focus block by 15 min',
        description: `Shorten \"${item.title}\" to preserve your new fixed anchor.`,
        actionType: 'shorten',
        payload: {
          kind: 'shorten',
          itemId: item.id,
          endMin: interval.start + shortenedDuration,
          durationMin: shortenedDuration,
        },
      };
    }

    if (item.type === 'walk') {
      const walkStart = anchorInterval.end + 8;
      return {
        id: createSuggestionId('insert-walk', item.id),
        title: 'Insert 8-min walk after meeting',
        description: `Add a short reset walk after ${anchorItem.title}.`,
        actionType: 'insert',
        payload: {
          kind: 'insert',
            item: {
            type: 'walk',
            title: '8min Walk (post-anchor reset)',
            startISO: item.startISO,
            endISO: item.endISO,
            startMin: walkStart,
            endMin: walkStart + 8,
            durationMin: 8,
            isSystemAnchor: false,
            isFixedAnchor: false,
            fixed: false,
            locked: false,
            deletable: true,
              source: 'advisor',
            status: 'planned',
            notes: `Recommended after ${anchorItem.title}`,
          },
        },
      };
    }

    if (item.type === 'workout') {
      const movedStart = anchorInterval.end + 45;
      return {
        id: createSuggestionId('move-workout', item.id),
        title: 'Move workout later',
        description: `Move \"${item.title}\" to ${movedStart} min to protect your fixed anchor.`,
        actionType: 'move',
        payload: {
          kind: 'move',
          itemId: item.id,
          startMin: movedStart,
          endMin: movedStart + duration,
        },
      };
    }

    return {
      id: createSuggestionId('remove-flex', item.id),
      title: 'Remove low-priority flexible block',
      description: `Remove \"${item.title}\" to keep anchor stability without overlap.`,
      actionType: 'remove',
      payload: {
        kind: 'remove',
        itemId: item.id,
      },
    };
  });
}
