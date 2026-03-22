import type { ScheduleItem, UserProfile } from '@physiology-engine/shared';
import { buildTimelinePlan } from '../src/utils/planGenerator';
import { groupEarlierAndCompletedToday } from '../src/utils/groupEarlierAndCompletedToday';

type Clock = { hour: number; minute: number; period: 'AM' | 'PM' };

function assertCheck(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function toClock(minutes: number): Clock {
  const normalized = ((Math.round(minutes) % (24 * 60)) + (24 * 60)) % (24 * 60);
  const hour24 = Math.floor(normalized / 60);
  const minute = normalized % 60;
  return {
    hour: (hour24 % 12) || 12,
    minute,
    period: hour24 >= 12 ? 'PM' : 'AM',
  };
}

function toISO(dateISO: string, minutes: number): string {
  const normalized = ((Math.round(minutes) % (24 * 60)) + (24 * 60)) % (24 * 60);
  const hh = String(Math.floor(normalized / 60)).padStart(2, '0');
  const mm = String(normalized % 60).padStart(2, '0');
  return `${dateISO}T${hh}:${mm}:00.000Z`;
}

function makeItem(
  dateISO: string,
  id: string,
  type: ScheduleItem['type'],
  title: string,
  startMin: number,
  endMin: number,
  source: ScheduleItem['source'],
  status: ScheduleItem['status'] = 'planned',
  extras?: Partial<ScheduleItem>
): ScheduleItem {
  const mergedExtras = extras || {};

  return {
    ...mergedExtras,
    id,
    type,
    title,
    startISO: toISO(dateISO, startMin),
    endISO: toISO(dateISO, endMin),
    startTime: toClock(startMin),
    endTime: toClock(endMin),
    startMin,
    endMin,
    durationMin: Math.max(5, endMin - startMin),
    isSystemAnchor: mergedExtras.isSystemAnchor ?? (type === 'wake' || type === 'sleep'),
    isFixedAnchor: mergedExtras.isFixedAnchor ?? false,
    fixed: type === 'wake' || type === 'sleep',
    locked: type === 'wake' || type === 'sleep',
    deletable: type !== 'wake' && type !== 'sleep',
    source,
    status,
  };
}

function classifyComingUpLater(items: ScheduleItem[], nowMinutes: number): { comingUp: ScheduleItem[]; laterToday: ScheduleItem[] } {
  const pending = items.filter(
    (item) => item.status !== 'actual' && item.origin !== 'actual' && item.status !== 'skipped'
  );

  const liveNow =
    pending.find((item) => {
      const start = item.startMin || 0;
      const end = item.endMin || start + (item.durationMin || 5);
      return start <= nowMinutes && nowMinutes <= end;
    }) || null;

  const futureItems = pending.filter((item) => (item.startMin || 0) > nowMinutes);
  const nowItem = liveNow || futureItems[0] || null;
  const futureAfterNow = futureItems.filter((item) => !nowItem || item.id !== nowItem.id);

  return {
    comingUp: futureAfterNow.slice(0, 4),
    laterToday: futureAfterNow.slice(4),
  };
}

const profile: UserProfile = {
  wakeTime: '07:00',
  sleepTime: '23:00',
  preferredFastingHours: 14,
  caffeineToleranceLow: false,
  stressBaseline: 5,
  defaultDayMode: 'flex',
  mealSequencePreference: 'balanced',
  fitnessGoal: 'MAINTENANCE',
  workStartTime: '09:00',
  workEndTime: '17:00',
  lunchTime: '12:30',
  dietFoundation: 'BALANCED',
  allowComfortWindow: true,
  useLearnedRhythm: true,
  useWeekendSchedule: false,
};

async function run() {
  const now = new Date();
  const dateISO = now.toISOString().slice(0, 10);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const wakeStart = Math.max(0, nowMinutes - 600);
  const wakeEnd = wakeStart + 5;
  const sleepStart = Math.min(1435, nowMinutes + 600);
  const sleepEnd = Math.min(1439, sleepStart + 5);

  const editedFutureStart = Math.min(1380, nowMinutes + 120);
  const insertedWalkStart = Math.min(1390, nowMinutes + 90);

  const baseItems: ScheduleItem[] = [
    makeItem(dateISO, 'wake-1', 'wake', 'Wake', wakeStart, wakeEnd, 'settings'),
    makeItem(dateISO, 'focus-edited', 'focus', 'Edited Focus Block', editedFutureStart, editedFutureStart + 45, 'user', 'planned'),
    makeItem(dateISO, 'insert-walk', 'walk', 'Inserted Walk', insertedWalkStart, insertedWalkStart + 10, 'user', 'planned'),
    makeItem(dateISO, 'sleep-1', 'sleep', 'Sleep', sleepStart, sleepEnd, 'settings'),
  ];

  // Scenario A + C + Refresh preservation guarantees
  const recomputed = buildTimelinePlan({
    dateISO,
    settings: profile,
    todayEntries: baseItems,
    mutationIntent: 'RECOMPUTE_FROM_NOW',
    baseItems,
  });

  const walkAfterRefresh = recomputed.items.find((item) => item.id === 'insert-walk');
  assertCheck(Boolean(walkAfterRefresh), 'Scenario A: future Insert Walk was removed by Refresh From Now');

  const classifications = classifyComingUpLater(recomputed.items, nowMinutes);
  const walkInUpcoming = [...classifications.comingUp, ...classifications.laterToday].some((item) => item.id === 'insert-walk');
  assertCheck(walkInUpcoming, 'Scenario A: Insert Walk is not in Coming Up or Later Today');

  const editedAfterRefresh = recomputed.items.find((item) => item.id === 'focus-edited');
  assertCheck(Boolean(editedAfterRefresh), 'Scenario C: edited future item missing after Refresh From Now');
  assertCheck(
    (editedAfterRefresh?.startMin || 0) === editedFutureStart,
    `Scenario C: edited time reverted (expected ${editedFutureStart}, got ${editedAfterRefresh?.startMin})`
  );

  // Scenario B: Log Actual appears in Completed & Earlier Today even if future clock time
  const loggedActualFuture = makeItem(
    dateISO,
    'logged-actual-future',
    'meal',
    'Logged Actual Meal',
    Math.min(1410, nowMinutes + 180),
    Math.min(1425, nowMinutes + 195),
    'user',
    'actual',
    { origin: 'actual' }
  );

  const groupedB = groupEarlierAndCompletedToday([...recomputed.items, loggedActualFuture], nowMinutes, dateISO);
  assertCheck(
    groupedB.items.some((item) => item.id === 'logged-actual-future'),
    'Scenario B: logged actual item not shown in Completed & Earlier Today'
  );

  // Scenario D: mark done remains visible in Completed & Earlier Today
  const markedDone = makeItem(
    dateISO,
    'marked-done',
    'custom',
    'Marked Done Item',
    Math.min(1400, nowMinutes + 60),
    Math.min(1410, nowMinutes + 70),
    'user',
    'actual',
    { origin: 'actual', completedAt: now.toISOString() }
  );

  const groupedD = groupEarlierAndCompletedToday([...recomputed.items, markedDone], nowMinutes, dateISO);
  assertCheck(
    groupedD.items.some((item) => item.id === 'marked-done'),
    'Scenario D: marked-done item not visible in Completed & Earlier Today'
  );

  // Explicit recompute-preservation guarantees requested in FIX 6
  const hardAnchorsPreserved = recomputed.items.some((item) => item.id === 'wake-1') && recomputed.items.some((item) => item.id === 'sleep-1');
  assertCheck(hardAnchorsPreserved, 'Preservation: hard anchors were not preserved');

  console.log('Scenario A: PASS');
  console.log('Scenario B: PASS');
  console.log('Scenario C: PASS');
  console.log('Scenario D: PASS');
  console.log('Refresh From Now preservation guarantees: PASS');
}

run().catch((error) => {
  console.error('Scenario validation failed:', error);
  process.exit(1);
});
