import type {
  UserProfile,
  ScheduleItem,
  DayPlan,
  FitnessGoal,
  ConstraintBlock,
  WorkoutEvent,
  MealEvent,
} from '@physiology-engine/shared';
import { generateId } from '@physiology-engine/shared';
import {
  parse,
  isWithinInterval,
  isBefore,
  isAfter,
  addHours,
  addMinutes,
} from 'date-fns';
import { toISOWithClockTime } from './utils/clockTime';

/**
 * FULL-DAY PLAN GENERATION ENGINE
 * Creates a comprehensive day schedule from wake to sleep with:
 * - Fixed blocks from settings (wake, sleep, work)
 * - User-created entries (preserved as-is)
 * - Today's schedule (meetings, obligations, workouts from TodaySetup)
 * - Physiologically-optimized meal timing
 * - Fitness and wellness activities based on fitness goal
 */

interface GenerateDayPlanInput {
  dateISO: string; // YYYY-MM-DD
  settings: UserProfile;
  todayEntries: ScheduleItem[];
  constraints?: ConstraintBlock[];
  plannedWorkouts?: WorkoutEvent[];
  plannedMeals?: MealEvent[];
}

function isoClockToMinutes(iso: string | undefined): number | undefined {
  if (!iso) return undefined;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return undefined;
  const hours = parsed.getHours();
  const minutes = parsed.getMinutes();
  return hours * 60 + minutes;
}

function withPlannedStatus(
  item: Partial<Omit<ScheduleItem, 'status'>> & { status?: ScheduleItem['status'] }
): ScheduleItem {
  const startMin = item.startMin ?? isoClockToMinutes(item.startISO) ?? 0;
  const endMin =
    item.endMin ??
    isoClockToMinutes(item.endISO) ??
    ((startMin + (item.durationMin || 5)) % 1440);
  const durationMin =
    item.durationMin ??
    Math.max(1, ((endMin - startMin) + 1440) % 1440 || 5);

  const isSystemAnchor = Boolean(item.isSystemAnchor);
  const isFixedAnchor = Boolean(item.isFixedAnchor);

  return {
    id: item.id || generateId(),
    type: (item.type as ScheduleItem['type']) || 'custom',
    title: item.title || '',
    startISO: item.startISO || new Date().toISOString(),
    endISO: item.endISO || new Date().toISOString(),
    startMin,
    endMin,
    durationMin,
    status: item.status ?? 'planned',
    source: (item.source as ScheduleItem['source']) || 'system',
    isSystemAnchor,
    isFixedAnchor,
    fixed: item.fixed ?? isFixedAnchor,
    locked: item.locked ?? isSystemAnchor,
    deletable: item.deletable ?? !isSystemAnchor,
    meta: item.meta || {},
    createdAt: item.createdAt || new Date().toISOString(),
    updatedAt: item.updatedAt || new Date().toISOString(),
    notes: item.notes,
    origin: item.origin,
    completedAt: item.completedAt,
    startTime: item.startTime,
    endTime: item.endTime,
  } as ScheduleItem;
}

function parseTimeOnDate(timeStr: string, date: Date): Date {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const result = new Date(date);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

function parseClockTimeOnDate(
  clock: { hour: number; minute: number; period: 'AM' | 'PM' },
  date: Date
): Date {
  const result = new Date(date);
  const hour24 =
    clock.period === 'PM'
      ? (clock.hour % 12) + 12
      : (clock.hour % 12);
  result.setHours(hour24, clock.minute, 0, 0);
  return result;
}

function localDateToTimelineISO(date: Date, dateISO: string): string {
  const hour24 = date.getHours();
  const minute = date.getMinutes();

  const [yearStr, monthStr, dayStr] = dateISO.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);

  // Construct a local Date using the provided Y-M-D and the intended local hour/minute,
  // then return its ISO (UTC) representation. This ensures the stored ISO maps back
  // to the same local clock time when parsed on the device.
  const local = new Date(year, month - 1, day, hour24, minute, 0, 0);
  return local.toISOString();
}

export function generateDayPlan(input: GenerateDayPlanInput): DayPlan {
  const {
    dateISO,
    settings,
    todayEntries,
    constraints = [],
    plannedWorkouts = [],
    plannedMeals = [],
  } = input;

  let items: ScheduleItem[] = [];
  const date = parse(dateISO, 'yyyy-MM-dd', new Date());

  const wakeTime = settings.wakeClockTime
    ? parseClockTimeOnDate(settings.wakeClockTime, date)
    : parseTimeOnDate(settings.wakeTime, date);

  const sleepTime = settings.sleepClockTime
    ? parseClockTimeOnDate(settings.sleepClockTime, date)
    : parseTimeOnDate(settings.sleepTime, date);

  if (isBefore(sleepTime, wakeTime)) {
    sleepTime.setDate(sleepTime.getDate() + 1);
  }

  items.push(
    withPlannedStatus({
      id: `wake-${dateISO}`,
      type: 'wake',
      title: 'Wake / Start Day',
      startISO: localDateToTimelineISO(wakeTime, dateISO),
      endISO: localDateToTimelineISO(addMinutes(wakeTime, 15), dateISO),
      fixed: true,
      isSystemAnchor: true,
      isFixedAnchor: true,
      locked: true,
      deletable: false,
      source: 'settings',
      notes: 'Morning start time from profile',
    })
  );

  items.push(
    withPlannedStatus({
      id: `sleep-${dateISO}`,
      type: 'sleep',
      title: 'Sleep',
      startISO: localDateToTimelineISO(sleepTime, dateISO),
      endISO: localDateToTimelineISO(addHours(sleepTime, 8), dateISO),
      fixed: true,
      isSystemAnchor: true,
      isFixedAnchor: true,
      locked: true,
      deletable: false,
      source: 'settings',
      notes: 'Target sleep time from profile',
    })
  );

  if (settings.workStartTime && settings.workEndTime) {
    const dayOfWeek = date.getDay();
    const isWorkday = dayOfWeek >= 1 && dayOfWeek <= 5;

    if (isWorkday) {
      const workStart = settings.workStartClockTime
        ? parseClockTimeOnDate(settings.workStartClockTime, date)
        : parseTimeOnDate(settings.workStartTime, date);

      const workEnd = settings.workEndClockTime
        ? parseClockTimeOnDate(settings.workEndClockTime, date)
        : parseTimeOnDate(settings.workEndTime, date);

      if (settings.commuteDuration) {
        const morningCommuteStart = addMinutes(workStart, -settings.commuteDuration);
        items.push(
          withPlannedStatus({
            id: `commute-morning-${dateISO}`,
            type: 'commute',
            title: 'Commute to Work',
            startISO: localDateToTimelineISO(morningCommuteStart, dateISO),
            endISO: localDateToTimelineISO(workStart, dateISO),
            fixed: true,
            isSystemAnchor: false,
            isFixedAnchor: true,
            locked: false,
            deletable: true,
            source: 'settings',
            notes: 'Commute duration from profile settings',
          })
        );

        const eveningCommuteEnd = addMinutes(workEnd, settings.commuteDuration);
        // debug logs removed — no-op
        items.push(
          withPlannedStatus({
            id: `commute-evening-${dateISO}`,
            type: 'commute',
            title: 'Commute Home',
            startISO: localDateToTimelineISO(workEnd, dateISO),
            endISO: localDateToTimelineISO(eveningCommuteEnd, dateISO),
            fixed: true,
            isSystemAnchor: false,
            isFixedAnchor: true,
            locked: false,
            deletable: true,
            source: 'settings',
            notes: 'Commute duration from profile settings',
          })
        );
      }

      items.push(
        withPlannedStatus({
          id: `work-${dateISO}`,
          type: 'work',
          title: 'Work',
          startISO: localDateToTimelineISO(workStart, dateISO),
          endISO: localDateToTimelineISO(workEnd, dateISO),
          fixed: true,
          isSystemAnchor: false,
          isFixedAnchor: true,
          locked: false,
          deletable: true,
          source: 'settings',
          notes: 'Work hours from profile',
        })
      );

      const lunchDuration = settings.lunchDurationMin ?? 30;
      let lunchStart = settings.lunchClockTime
        ? parseClockTimeOnDate(settings.lunchClockTime, date)
        : settings.lunchTime
          ? parseTimeOnDate(settings.lunchTime, date)
          : addMinutes(workStart, Math.floor((workEnd.getTime() - workStart.getTime()) / 120000));

      if (isBefore(lunchStart, workStart)) {
        lunchStart = addMinutes(workStart, 60);
      }
      if (isAfter(addMinutes(lunchStart, lunchDuration), workEnd)) {
        lunchStart = addMinutes(workEnd, -lunchDuration);
      }

      items.push(
        withPlannedStatus({
          id: `lunch-break-${dateISO}`,
          type: 'meal',
          title: 'Lunch',
          startISO: localDateToTimelineISO(lunchStart, dateISO),
          endISO: localDateToTimelineISO(addMinutes(lunchStart, lunchDuration), dateISO),
          fixed: false,
          isSystemAnchor: false,
          isFixedAnchor: false,
          locked: false,
          deletable: true,
          source: 'settings',
          notes: 'Lunch block during work hours',
          meta: { mealType: 'lunch' },
        })
      );
    }
  }

  const hasWorkInSettings = settings.workStartTime && settings.workEndTime;
  const filteredConstraints = hasWorkInSettings
    ? constraints.filter((c) => c.type !== 'work' && c.type !== 'commute')
    : constraints;

  for (const constraint of filteredConstraints) {
    items.push(
      withPlannedStatus({
        id: generateId(),
        type: constraint.type === 'meeting' ? 'meeting' : 'custom',
        title: constraint.description || 'Scheduled Block',
        startISO: localDateToTimelineISO(constraint.start, dateISO),
        endISO: localDateToTimelineISO(constraint.end, dateISO),
        fixed: true,
        isSystemAnchor: false,
        isFixedAnchor: true,
        locked: false,
        deletable: true,
        source: 'user',
        notes: constraint.description,
      })
    );
  }

  for (const workout of plannedWorkouts) {
    items.push(
      withPlannedStatus({
        id: generateId(),
        type: 'workout',
        title: `${workout.type} Workout (${workout.duration}min)`,
        startISO: localDateToTimelineISO(workout.time, dateISO),
        endISO: localDateToTimelineISO(addMinutes(workout.time, workout.duration), dateISO),
        fixed: false,
        source: 'user',
        notes: `${workout.intensity} intensity`,
        meta: { workoutType: workout.type, intensity: workout.intensity },
      })
    );
  }

  for (const meal of plannedMeals) {
    items.push(
      withPlannedStatus({
        id: generateId(),
        type: 'meal',
        title: `${meal.mealType.replace('-', ' ')} Meal`,
        startISO: localDateToTimelineISO(meal.time, dateISO),
        endISO: localDateToTimelineISO(addMinutes(meal.time, 45), dateISO),
        fixed: false,
        source: 'user',
        notes: meal.mealType,
        meta: { mealType: meal.mealType },
      })
    );
  }

  for (const entry of todayEntries) {
    items.push(
      withPlannedStatus({
        ...entry,
        source: entry.source || 'user',
      })
    );
  }

  const itemsById = new Map<string, ScheduleItem>();

  for (const item of items) {
    const existing = itemsById.get(item.id);
    if (!existing || item.source === 'user') {
      itemsById.set(item.id, item);
    }
  }

  const uniqueItems: ScheduleItem[] = [];
  const itemsArray = Array.from(itemsById.values());

  for (const item of itemsArray) {
    let isDuplicate = false;

    for (const existing of uniqueItems) {
      const isSameType =
        item.type === existing.type ||
        (isWorkRelated(item.type) && isWorkRelated(existing.type));

      if (isSameType) {
        const overlap = calculateOverlap(
          new Date(item.startISO),
          new Date(item.endISO),
          new Date(existing.startISO),
          new Date(existing.endISO)
        );

        if (overlap > 0.8) {
          isDuplicate = true;
          if (item.source === 'user' && existing.source !== 'user') {
            const index = uniqueItems.indexOf(existing);
            uniqueItems[index] = item;
          }
          break;
        }
      }
    }

    if (!isDuplicate) {
      uniqueItems.push(item);
    }
  }

  items = uniqueItems;

  items.sort((a, b) => new Date(a.startISO).getTime() - new Date(b.startISO).getTime());

  const mealItems = insertMeals(wakeTime, sleepTime, items, settings, dateISO);
  items.push(...mealItems);

  const fitnessItems = insertFitnessActivities(
    wakeTime,
    sleepTime,
    items,
    settings.fitnessGoal || 'MAINTENANCE',
    dateISO
  );
  items.push(...fitnessItems);

  const fillerItems = fillGaps(
    wakeTime,
    sleepTime,
    items,
    settings.fitnessGoal || 'MAINTENANCE',
    dateISO
  );
  items.push(...fillerItems);

  items.sort((a, b) => new Date(a.startISO).getTime() - new Date(b.startISO).getTime());

  items = items.filter((item) => item.notes !== 'deleted-marker');
  items = resolveOverlaps(items);

  const summary = generateSummary(items, settings.fitnessGoal || 'MAINTENANCE');
  const recommendations = generateRecommendations(settings.fitnessGoal || 'MAINTENANCE');

  return {
    dateISO,
    items,
    summary,
    recommendations,
  };
}

function resolveOverlaps(items: ScheduleItem[]): ScheduleItem[] {
  const sorted = [...items].sort((a, b) => new Date(a.startISO).getTime() - new Date(b.startISO).getTime());

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const current = sorted[i];

    const prevEnd = new Date(prev.endISO);
    const currentStart = new Date(current.startISO);

    if (currentStart < prevEnd) {
      // Do not shift fixed anchors; preserve exact anchor times from settings.
      if (prev.isFixedAnchor || current.isFixedAnchor) {
        continue;
      }
      const currentEnd = new Date(current.endISO);
      const durationMs = Math.max(5 * 60 * 1000, currentEnd.getTime() - currentStart.getTime());
      const newStart = new Date(prevEnd);
      const newEnd = new Date(newStart.getTime() + durationMs);

      const currentDateISO =
        typeof current.startISO === 'string' && current.startISO.includes('T')
          ? current.startISO.split('T')[0]
          : new Date().toISOString().slice(0, 10);

      sorted[i] = {
        ...current,
        startISO: localDateToTimelineISO(newStart, currentDateISO),
        endISO: localDateToTimelineISO(newEnd, currentDateISO),
      };
    }
  }

  return sorted;
}

function insertMeals(
  wakeTime: Date,
  sleepTime: Date,
  existingItems: ScheduleItem[],
  _settings: UserProfile,
  dateISO: string
): ScheduleItem[] {
  const meals: ScheduleItem[] = [];

  const hasMeals = existingItems.some((item) => item.type === 'meal');
  if (hasMeals) return meals;

  const breakfastTime = addMinutes(wakeTime, 90);
  if (isBeforeSleep(breakfastTime, sleepTime) && !hasConflict(breakfastTime, existingItems, 60)) {
    meals.push(
      withPlannedStatus({
        id: generateId(),
        type: 'meal',
        title: 'Breakfast',
        startISO: localDateToTimelineISO(breakfastTime, dateISO),
        endISO: localDateToTimelineISO(addMinutes(breakfastTime, 30), dateISO),
        fixed: false,
        source: 'engine',
        notes: 'Breakfast ~90min after wake',
        meta: { mealType: 'breakfast' },
      })
    );
  }

  const lunchTime = parseTimeOnDate('12:30', new Date(breakfastTime));
  if (isBeforeSleep(lunchTime, sleepTime) && !hasConflict(lunchTime, existingItems, 60)) {
    meals.push(
      withPlannedStatus({
        id: generateId(),
        type: 'meal',
        title: 'Lunch',
        startISO: localDateToTimelineISO(lunchTime, dateISO),
        endISO: localDateToTimelineISO(addMinutes(lunchTime, 30), dateISO),
        fixed: false,
        source: 'engine',
        notes: 'Mid-day meal',
        meta: { mealType: 'lunch' },
      })
    );
  }

  const dinnerTime = addHours(sleepTime, -3.5);
  if (isAfter(dinnerTime, wakeTime) && !hasConflict(dinnerTime, existingItems, 60)) {
    meals.push(
      withPlannedStatus({
        id: generateId(),
        type: 'meal',
        title: 'Dinner',
        startISO: localDateToTimelineISO(dinnerTime, dateISO),
        endISO: localDateToTimelineISO(addMinutes(dinnerTime, 30), dateISO),
        fixed: false,
        source: 'engine',
        notes: '3.5hrs before sleep for digestion',
        meta: { mealType: 'dinner' },
      })
    );
  }

  return meals;
}

function insertFitnessActivities(
  wakeTime: Date,
  sleepTime: Date,
  existingItems: ScheduleItem[],
  fitnessGoal: FitnessGoal,
  dateISO: string
): ScheduleItem[] {
  const activities: ScheduleItem[] = [];

  const morningLightTime = addMinutes(wakeTime, 20);
  if (!hasConflict(morningLightTime, existingItems, 15)) {
    activities.push(
      withPlannedStatus({
        id: generateId(),
        type: 'custom',
        title: 'Morning Light Exposure',
        startISO: localDateToTimelineISO(morningLightTime, dateISO),
        endISO: localDateToTimelineISO(addMinutes(morningLightTime, 10), dateISO),
        fixed: false,
        source: 'engine',
        notes: 'Get sunlight for circadian rhythm and metabolic boost',
      })
    );
  }

  const morningStretchTime = addMinutes(wakeTime, 35);
  if (!hasConflict(morningStretchTime, existingItems, 15)) {
    activities.push(
      withPlannedStatus({
        id: generateId(),
        type: 'stretch',
        title: 'Morning Mobility',
        startISO: localDateToTimelineISO(morningStretchTime, dateISO),
        endISO: localDateToTimelineISO(addMinutes(morningStretchTime, 10), dateISO),
        fixed: false,
        source: 'engine',
        notes: 'Light stretching to wake up the body',
      })
    );
  }

  if (fitnessGoal === 'MUSCLE_GAIN' || fitnessGoal === 'PERFORMANCE') {
    const workoutTime = addHours(wakeTime, 2);
    if (!hasConflict(workoutTime, existingItems, 90)) {
      activities.push(
        withPlannedStatus({
          id: generateId(),
          type: 'workout',
          title:
            fitnessGoal === 'MUSCLE_GAIN'
              ? 'Morning Resistance Training'
              : 'Morning Performance Session',
          startISO: localDateToTimelineISO(workoutTime, dateISO),
          endISO: localDateToTimelineISO(addMinutes(workoutTime, 60), dateISO),
          fixed: false,
          source: 'engine',
          notes: `60min ${
            fitnessGoal === 'MUSCLE_GAIN' ? 'strength' : 'performance'
          } workout - fasted or lightly fueled`,
        })
      );
    }
  }

  if (fitnessGoal === 'GENERAL_HEALTH' || fitnessGoal === 'MAINTENANCE') {
    const middayWalk = addHours(wakeTime, 5);
    if (!hasConflict(middayWalk, existingItems, 20)) {
      activities.push(
        withPlannedStatus({
          id: generateId(),
          type: 'walk',
          title: 'Midday Movement Break',
          startISO: localDateToTimelineISO(middayWalk, dateISO),
          endISO: localDateToTimelineISO(addMinutes(middayWalk, 15), dateISO),
          fixed: false,
          source: 'engine',
          notes: 'Break up sitting time with light activity',
        })
      );
    }
  }

  if (fitnessGoal === 'FAT_LOSS' || fitnessGoal === 'WEIGHT_LOSS') {
    const meals = existingItems.filter((item) => item.type === 'meal');
    for (const meal of meals) {
      const walkTime = addMinutes(new Date(meal.endISO), 15);
      if (!hasConflict(walkTime, existingItems, 20)) {
        activities.push(
          withPlannedStatus({
            id: generateId(),
            type: 'walk',
            title: 'Post-Meal Walk',
            startISO: localDateToTimelineISO(walkTime, dateISO),
            endISO: localDateToTimelineISO(addMinutes(walkTime, 15), dateISO),
            fixed: false,
            source: 'engine',
            notes: 'Helps with glucose clearance and fat oxidation',
          })
        );
      }
    }
  }

  const winddownTime = addMinutes(sleepTime, -45);
  if (isAfter(winddownTime, wakeTime) && !hasConflict(winddownTime, existingItems, 40)) {
    activities.push(
      withPlannedStatus({
        id: generateId(),
        type: 'winddown',
        title: 'Evening Wind-Down Routine',
        startISO: localDateToTimelineISO(winddownTime, dateISO),
        endISO: localDateToTimelineISO(addMinutes(winddownTime, 30), dateISO),
        fixed: false,
        source: 'engine',
        notes: 'Reading, stretching, journaling - dim lights, no screens',
      })
    );
  }

  const hydrationTimes = [
    { offset: 180, label: 'Mid-Morning Hydration' },
    { offset: 360, label: 'Midday Hydration' },
    { offset: 540, label: 'Afternoon Hydration' },
  ];

  for (const { offset, label } of hydrationTimes) {
    const hydrationTime = addMinutes(wakeTime, offset);
    if (!hasConflict(hydrationTime, existingItems, 5)) {
      activities.push(
        withPlannedStatus({
          id: generateId(),
          type: 'hydration',
          title: label,
          startISO: localDateToTimelineISO(hydrationTime, dateISO),
          endISO: localDateToTimelineISO(addMinutes(hydrationTime, 2), dateISO),
          fixed: false,
          source: 'engine',
          notes: 'Drink 300-500ml water',
        })
      );
    }
  }

  return activities;
}

function fillGaps(
  wakeTime: Date,
  sleepTime: Date,
  existingItems: ScheduleItem[],
  fitnessGoal: FitnessGoal,
  dateISO: string
): ScheduleItem[] {
  const fillers: ScheduleItem[] = [];
  const sorted = [...existingItems].sort(
    (a, b) => new Date(a.startISO).getTime() - new Date(b.startISO).getTime()
  );

  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i];
    const next = sorted[i + 1];
    const gapStart = new Date(current.endISO);
    const gapEnd = new Date(next.startISO);
    const gapMinutes = (gapEnd.getTime() - gapStart.getTime()) / 60000;

    if (gapMinutes > 30) {
      const hourOfDay = gapStart.getHours();
      const isEvening = hourOfDay >= 17 && hourOfDay < 21;
      const isAfternoon = hourOfDay >= 13 && hourOfDay < 17;
      const isMorning = hourOfDay >= 6 && hourOfDay < 12;
      const isPreSleep = hourOfDay >= 21;

      const gapActivities = getGapActivities(
        gapStart,
        gapMinutes,
        fitnessGoal,
        isEvening,
        isAfternoon,
        isMorning,
        isPreSleep,
        dateISO
      );

      fillers.push(...gapActivities);
    }
  }

  return fillers;
}

function getGapActivities(
  gapStart: Date,
  gapMinutes: number,
  fitnessGoal: FitnessGoal,
  isEvening: boolean,
  isAfternoon: boolean,
  _isMorning: boolean,
  isPreSleep: boolean,
  dateISO: string
): ScheduleItem[] {
  const activities: ScheduleItem[] = [];
  let currentTime = gapStart;
  let remainingMinutes = gapMinutes - 10;

  if (isPreSleep) {
    if (remainingMinutes >= 30) {
      activities.push(
        withPlannedStatus({
          id: generateId(),
          type: 'winddown',
          title: 'Evening Wind-Down',
          startISO: localDateToTimelineISO(addMinutes(currentTime, 5), dateISO),
          endISO: localDateToTimelineISO(
            addMinutes(currentTime, 5 + Math.min(remainingMinutes, 45)),
            dateISO
          ),
          fixed: false,
          source: 'engine',
          notes: 'Reading, stretching, or light activity before bed',
        })
      );
    }
    return activities;
  }

  if (isEvening && remainingMinutes >= 45) {
    switch (fitnessGoal) {
      case 'MUSCLE_GAIN':
      case 'PERFORMANCE':
        if (remainingMinutes >= 90) {
          activities.push(
            withPlannedStatus({
              id: generateId(),
              type: 'workout',
              title:
                fitnessGoal === 'MUSCLE_GAIN'
                  ? 'Evening Resistance Training'
                  : 'Evening Training Session',
              startISO: localDateToTimelineISO(addMinutes(currentTime, 10), dateISO),
              endISO: localDateToTimelineISO(addMinutes(currentTime, 70), dateISO),
              fixed: false,
              source: 'engine',
              notes: `60min ${
                fitnessGoal === 'MUSCLE_GAIN' ? 'strength' : 'performance'
              } workout - optimal evening window`,
            })
          );
          currentTime = addMinutes(currentTime, 70);
          remainingMinutes -= 60;
        }
        break;

      case 'FAT_LOSS':
      case 'WEIGHT_LOSS':
        if (remainingMinutes >= 60) {
          activities.push(
            withPlannedStatus({
              id: generateId(),
              type: 'walk',
              title: 'Evening Activity Walk',
              startISO: localDateToTimelineISO(addMinutes(currentTime, 10), dateISO),
              endISO: localDateToTimelineISO(addMinutes(currentTime, 40), dateISO),
              fixed: false,
              source: 'engine',
              notes: '30min brisk walk - great for fat loss and glucose management',
            })
          );
          currentTime = addMinutes(currentTime, 40);
          remainingMinutes -= 30;
        }
        break;

      case 'GENERAL_HEALTH':
      case 'MAINTENANCE':
        if (remainingMinutes >= 60) {
          activities.push(
            withPlannedStatus({
              id: generateId(),
              type: 'walk',
              title: 'Evening Movement',
              startISO: localDateToTimelineISO(addMinutes(currentTime, 10), dateISO),
              endISO: localDateToTimelineISO(addMinutes(currentTime, 35), dateISO),
              fixed: false,
              source: 'engine',
              notes: '25min walk or light activity for general wellness',
            })
          );
          currentTime = addMinutes(currentTime, 35);
          remainingMinutes -= 25;
        }
        break;
    }

    if (
      remainingMinutes >= 20 &&
      activities.length > 0 &&
      activities[activities.length - 1].type === 'workout'
    ) {
      activities.push(
        withPlannedStatus({
          id: generateId(),
          type: 'stretch',
          title: 'Post-Workout Stretching',
          startISO: localDateToTimelineISO(currentTime, dateISO),
          endISO: localDateToTimelineISO(addMinutes(currentTime, 15), dateISO),
          fixed: false,
          source: 'engine',
          notes: 'Recovery and flexibility work',
        })
      );
      currentTime = addMinutes(currentTime, 15);
      remainingMinutes -= 15;
    }
  }

  if (isAfternoon && remainingMinutes >= 30) {
    switch (fitnessGoal) {
      case 'MUSCLE_GAIN':
      case 'PERFORMANCE':
        if (remainingMinutes >= 90) {
          activities.push(
            withPlannedStatus({
              id: generateId(),
              type: 'workout',
              title: 'Afternoon Training',
              startISO: localDateToTimelineISO(addMinutes(currentTime, 10), dateISO),
              endISO: localDateToTimelineISO(addMinutes(currentTime, 70), dateISO),
              fixed: false,
              source: 'engine',
              notes: '60min workout - peak performance window',
            })
          );
          currentTime = addMinutes(currentTime, 70);
          remainingMinutes -= 60;
        }
        break;

      case 'FAT_LOSS':
      case 'WEIGHT_LOSS':
        if (remainingMinutes >= 45) {
          activities.push(
            withPlannedStatus({
              id: generateId(),
              type: 'walk',
              title: 'Afternoon Movement',
              startISO: localDateToTimelineISO(addMinutes(currentTime, 10), dateISO),
              endISO: localDateToTimelineISO(addMinutes(currentTime, 35), dateISO),
              fixed: false,
              source: 'engine',
              notes: '25min activity - helps energy and fat oxidation',
            })
          );
          currentTime = addMinutes(currentTime, 35);
          remainingMinutes -= 25;
        }
        break;
    }
  }

  if (remainingMinutes >= 30) {
    const fillType = remainingMinutes > 60 ? 'focus' : 'break';
    const fillDuration = Math.min(remainingMinutes, 90);

    activities.push(
      withPlannedStatus({
        id: generateId(),
        type: fillType,
        title: fillType === 'focus' ? 'Focus / Deep Work' : 'Flexible Time',
        startISO: localDateToTimelineISO(currentTime, dateISO),
        endISO: localDateToTimelineISO(addMinutes(currentTime, fillDuration), dateISO),
        fixed: false,
        source: 'engine',
        notes: `${Math.floor(fillDuration)}min ${
          fillType === 'focus' ? 'for productive work' : 'for rest and recovery'
        }`,
      })
    );
  }

  return activities;
}

function hasConflict(time: Date, items: ScheduleItem[], durationMinutes: number): boolean {
  const proposedEnd = addMinutes(time, durationMinutes);

  for (const item of items) {
    const itemStart = new Date(item.startISO);
    const itemEnd = new Date(item.endISO);

    if (
      isWithinInterval(time, { start: itemStart, end: itemEnd }) ||
      isWithinInterval(proposedEnd, { start: itemStart, end: itemEnd }) ||
      (isBefore(time, itemStart) && isAfter(proposedEnd, itemEnd))
    ) {
      return true;
    }
  }

  return false;
}

function isBeforeSleep(time: Date, sleepTime: Date): boolean {
  return isBefore(time, sleepTime);
}

function isWorkRelated(type: string): boolean {
  return type === 'work' || type === 'commute';
}

function calculateOverlap(start1: Date, end1: Date, start2: Date, end2: Date): number {
  const latestStart = start1 > start2 ? start1 : start2;
  const earliestEnd = end1 < end2 ? end1 : end2;

  if (latestStart >= earliestEnd) return 0;

  const overlapMs = earliestEnd.getTime() - latestStart.getTime();
  const duration1 = end1.getTime() - start1.getTime();
  const duration2 = end2.getTime() - start2.getTime();
  const minDuration = Math.min(duration1, duration2);

  return overlapMs / minDuration;
}

function generateSummary(items: ScheduleItem[], fitnessGoal: FitnessGoal): string {
  const mealCount = items.filter((i) => i.type === 'meal').length;
  const workoutCount = items.filter((i) => i.type === 'workout').length;
  const walkCount = items.filter((i) => i.type === 'walk').length;
  const hasWork = items.some((i) => i.type === 'work');

  let summary = `${items.length} activities scheduled`;
  if (hasWork) summary += ' including work';
  if (mealCount > 0) summary += `, ${mealCount} meals`;
  if (workoutCount > 0) summary += `, ${workoutCount} workout${workoutCount > 1 ? 's' : ''}`;
  if (walkCount > 0) summary += `, ${walkCount} walks`;
  summary += `. Optimized for ${fitnessGoal.toLowerCase().replace('_', ' ')}.`;

  return summary;
}

function generateRecommendations(fitnessGoal: FitnessGoal): string[] {
  const recommendations: string[] = [];

  switch (fitnessGoal) {
    case 'FAT_LOSS':
    case 'WEIGHT_LOSS':
      recommendations.push('Evening walks are optimal for fat oxidation - use the time after work');
      recommendations.push('Take 10-15min walks after each meal to manage blood glucose');
      recommendations.push('Prioritize protein at each meal to maintain muscle during fat loss');
      recommendations.push('Earlier dinner (3-4hrs before sleep) improves overnight fat burning');
      recommendations.push('Morning sunlight exposure boosts metabolism and circadian rhythm');
      recommendations.push('Fill evening gaps with movement activities rather than sitting');
      break;
    case 'MUSCLE_GAIN':
      recommendations.push('Evening training window (5-7pm) is optimal for strength gains');
      recommendations.push('Fuel adequately 1-2hrs before resistance training sessions');
      recommendations.push('Post-workout stretching and mobility work aids recovery');
      recommendations.push('Space meals 3-4 hours apart for optimal protein synthesis');
      recommendations.push('Prioritize 7-9hrs sleep for muscle repair and growth');
      recommendations.push('Use evening gaps for training and active recovery');
      break;
    case 'PERFORMANCE':
      recommendations.push('Afternoon and evening are peak performance windows for training');
      recommendations.push('Time carbohydrate intake around training sessions for fuel');
      recommendations.push('Active recovery and mobility work prevent overtraining');
      recommendations.push('Stay hydrated throughout the day for performance');
      recommendations.push('Evening gaps are perfect for skill work and conditioning');
      break;
    case 'MAINTENANCE':
    case 'GENERAL_HEALTH':
      recommendations.push('Use evening time for walks, stretching, or light activities');
      recommendations.push('Maintain consistent meal timing for metabolic health');
      recommendations.push('Balance movement throughout the day, not just workouts');
      recommendations.push('Evening wind-down routine improves sleep quality');
      recommendations.push('Fill gaps with a mix of productive work and active breaks');
      break;
  }

  recommendations.push('Tap any activity to adjust timing or add your own events');

  return recommendations;
}