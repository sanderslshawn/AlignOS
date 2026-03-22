import type { ScheduleItem, UserProfile } from '@physiology-engine/shared';
import type { ClockTime } from '@physiology-engine/shared';
import { addMinutes, parseClockTime, toISOWithClockTime } from '../utils/clockTime';
import { normalizeAndValidateTimeline } from './normalizeTimeline';
import type { MutationIntent } from '../types/mutationIntent';
import { getAnchorTier } from '../utils/getAnchorTier';
import { dedupeBehaviorBlocks } from '../utils/dedupeBehaviorBlocks';
import { optimizeAroundAnchors } from './anchorPlanning';

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
  suppressedKeys?: string[];
  suppressedExactKeys?: string[];
  intent?: MutationIntent;
  validateOnly?: boolean;
}

function createSystemAnchorItem(
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
    isSystemAnchor: true,
    isFixedAnchor: true,
    fixed: true,
    locked: true,
    deletable: false,
    meta: {
      isAnchor: true,
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
  const suppressedKeys = new Set((input.suppressedKeys || []).map((s) => String(s)));
  const suppressedExactKeys = new Set((input.suppressedExactKeys || []).map((s) => String(s)));
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
      const key = `wake|${'wake / start day'.trim().toLowerCase()}`;
      if (!suppressedKeys.has(key)) {
        requiredAnchors.push(createSystemAnchorItem('wake', 'Wake / Start Day', wake, dateISO, 'anchor'));
      }
    }
    if (!hasSleep) {
      const key = `sleep|${'sleep'.trim().toLowerCase()}`;
      if (!suppressedKeys.has(key)) {
        requiredAnchors.push(createSystemAnchorItem('sleep', 'Sleep', sleep, dateISO, 'anchor'));
      }
    }

    candidate = dedupeById([...baseExistingItems, ...requiredAnchors]);
  } else {
    const anchors: ScheduleItem[] = [
      createSystemAnchorItem('wake', 'Wake / Start Day', wake, dateISO, 'anchor'),
      createSystemAnchorItem('sleep', 'Sleep', sleep, dateISO, 'anchor'),
    ];

    if (workStart) {
      const key = `work|${'work start'.trim().toLowerCase()}`;
      if (!suppressedKeys.has(key)) anchors.push(createSystemAnchorItem('work', 'Work Start', workStart, dateISO, 'start'));
    }
    if (workEnd) {
      const key = `work|${'work end'.trim().toLowerCase()}`;
      if (!suppressedKeys.has(key)) anchors.push(createSystemAnchorItem('work', 'Work End', workEnd, dateISO, 'end'));
    }
    

    const filteredAnchors = anchors.filter((item) => {
      if (suppressedIds.has(item.id)) return false;
      const key = `${item.type}|${(item.title || '').trim().toLowerCase()}`;
      if (suppressedKeys.has(key)) return false;
      return true;
    });

    const merged = [
      ...baseExistingItems,
      ...(input.advisorInsertions || []),
      ...(input.actualEvents || []),
    ]
      .filter((item) => !suppressedIds.has(item.id))
      .filter((item) => item.notes !== 'deleted-marker')
      .filter((item) => {
        const key = `${item.type}|${(item.title || '').trim().toLowerCase()}`;
        const exact = `${item.type}|${(item.title || '').trim().toLowerCase()}|${item.startMin || 0}`;
        if (suppressedKeys.has(key)) return false;
        if (suppressedExactKeys.has(exact)) return false;
        return true;
      });

    candidate = dedupeById([...filteredAnchors, ...merged]);
  }

  const optimized = optimizeAroundAnchors(dedupeBehaviorBlocks(candidate, { dateISO }));

  const normalized = normalizeAndValidateTimeline(optimized.items, {
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
