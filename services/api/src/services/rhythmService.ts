import { promises as fs } from 'fs';
import path from 'path';
import type { DayState, PlanStep, UserProfile } from '@physiology-engine/shared';

export type RhythmConfidence = 'low' | 'medium' | 'high';

interface DaySummary {
  dateKey: string;
  wakeMin?: number;
  sleepMin?: number;
  firstMealMin?: number;
  lunchMin?: number;
  lastMealMin?: number;
  walkBinCounts: Record<string, number>;
  workoutBinCounts: Record<string, number>;
  plannedCount: number;
  completedCount: number;
  disruptionHourCounts: Record<string, number>;
}

export interface RhythmProfile {
  deviceId: string;
  updatedAtISO: string;
  daysObserved: number;
  confidence: RhythmConfidence;
  rollingMedians: {
    wake?: string;
    sleep?: string;
    firstMeal?: string;
    lunch?: string;
    lastMeal?: string;
  };
  commonBins: {
    walk: string[];
    workout: string[];
  };
  adherenceScore: number;
  disruptionWindows: number[];
  daySummaries: Record<string, DaySummary>;
}

interface EventLike {
  type?: string;
  action?: string;
  status?: string;
  time?: string | Date;
  mealType?: string;
  intensity?: string;
  title?: string;
  notes?: string;
}

const MAX_DAYS = 14;

function createDefaultRhythmProfile(deviceId: string): RhythmProfile {
  return {
    deviceId,
    updatedAtISO: new Date().toISOString(),
    daysObserved: 0,
    confidence: 'low',
    rollingMedians: {},
    commonBins: { walk: [], workout: [] },
    adherenceScore: 0,
    disruptionWindows: [],
    daySummaries: {},
  };
}

function toMinutesFromDate(value: Date): number {
  return value.getHours() * 60 + value.getMinutes();
}

function minutesToHHmm(minutes: number): string {
  const normalized = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const hour = Math.floor(normalized / 60);
  const minute = normalized % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function hhmmToMinutes(value?: string): number | null {
  if (!value) return null;
  const [hourText, minuteText] = value.split(':');
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  return hour * 60 + minute;
}

function toDate(value: string | Date | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function to15MinuteBin(minutes: number): string {
  const rounded = Math.round(minutes / 15) * 15;
  return minutesToHHmm(rounded);
}

function weightedMedian(values: Array<{ value: number; weight: number }>): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left.value - right.value);
  const totalWeight = sorted.reduce((acc, item) => acc + item.weight, 0);
  if (totalWeight <= 0) return null;

  let running = 0;
  for (const item of sorted) {
    running += item.weight;
    if (running >= totalWeight / 2) {
      return item.value;
    }
  }

  return sorted[sorted.length - 1].value;
}

function topBinsWithWeight(
  summaries: DaySummary[],
  selector: (summary: DaySummary) => Record<string, number>,
  weightForSummary: (summary: DaySummary) => number
): string[] {
  const counts = new Map<string, number>();

  for (const summary of summaries) {
    const multiplier = weightForSummary(summary);
    const bins = selector(summary);
    for (const [bin, count] of Object.entries(bins)) {
      counts.set(bin, (counts.get(bin) || 0) + count * multiplier);
    }
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 2)
    .map(([bin]) => bin);
}

function recencyWeightForDate(summary: DaySummary, sortedDateKeysNewestFirst: string[]): number {
  const index = sortedDateKeysNewestFirst.indexOf(summary.dateKey);
  return index >= 0 && index < 3 ? 2 : 1;
}

function deriveConfidence(daysObserved: number): RhythmConfidence {
  if (daysObserved >= 10) return 'high';
  if (daysObserved >= 4) return 'medium';
  return 'low';
}

function pickRecentDateKeys(daySummaries: Record<string, DaySummary>): string[] {
  return Object.keys(daySummaries).sort((left, right) => right.localeCompare(left)).slice(0, MAX_DAYS);
}

function extractMealTimes(dayState: DayState, events: EventLike[]): number[] {
  const times: number[] = [];

  const dayStateMeals = dayState.events.filter((event: any) => event.type === 'meal');
  for (const meal of dayStateMeals) {
    const date = toDate((meal as any).time);
    if (date) times.push(toMinutesFromDate(date));
  }

  for (const event of events) {
    if (event.type === 'meal') {
      const date = toDate(event.time);
      if (date) times.push(toMinutesFromDate(date));
    }
  }

  return times.sort((left, right) => left - right);
}

function deriveLunch(mealTimes: number[]): number | undefined {
  if (!mealTimes.length) return undefined;
  const noon = 12 * 60 + 30;
  let best = mealTimes[0];
  let bestDiff = Math.abs(mealTimes[0] - noon);

  for (const mealTime of mealTimes) {
    const diff = Math.abs(mealTime - noon);
    if (diff < bestDiff) {
      best = mealTime;
      bestDiff = diff;
    }
  }

  return best;
}

function deriveDailySummary(dateKey: string, profile: UserProfile, dayState: DayState, events: EventLike[]): DaySummary {
  const wakeMin = hhmmToMinutes(profile.wakeTime) ?? undefined;
  const sleepMin = hhmmToMinutes(profile.sleepTime) ?? undefined;
  const mealTimes = extractMealTimes(dayState, events);

  const walkBinCounts: Record<string, number> = {};
  const workoutBinCounts: Record<string, number> = {};
  const disruptionHourCounts: Record<string, number> = {};

  const mergedEvents: EventLike[] = [...(events || [])];

  const dayStateWalkWorkouts = dayState.events.filter((event: any) => event.type === 'walk' || event.type === 'workout');
  for (const event of dayStateWalkWorkouts) {
    mergedEvents.push({
      type: (event as any).type,
      status: (event as any).status,
      time: (event as any).time,
      intensity: (event as any).intensity,
      title: (event as any).title,
      notes: (event as any).notes,
    });
  }

  for (const event of mergedEvents) {
    const actionType = `${event.type || ''} ${event.action || ''}`.toLowerCase();
    const eventDate = toDate(event.time);

    if (eventDate && event.type === 'walk' && event.status !== 'SKIPPED') {
      const bin = to15MinuteBin(toMinutesFromDate(eventDate));
      walkBinCounts[bin] = (walkBinCounts[bin] || 0) + 1;
    }

    if (eventDate && event.type === 'workout' && event.status !== 'SKIPPED') {
      const bin = to15MinuteBin(toMinutesFromDate(eventDate));
      workoutBinCounts[bin] = (workoutBinCounts[bin] || 0) + 1;
    }

    if (actionType.includes('edit') || actionType.includes('regen') || actionType.includes('recompute')) {
      const hour = eventDate ? eventDate.getHours() : new Date().getHours();
      const key = String(hour);
      disruptionHourCounts[key] = (disruptionHourCounts[key] || 0) + 1;
    }
  }

  const plannedCount = dayState.computedPlan?.length || 0;
  const completedByStatus = dayState.events.filter((event: any) => event.status === 'DONE').length;
  const completedCount = Math.max(dayState.completedEvents?.length || 0, completedByStatus);

  return {
    dateKey,
    wakeMin,
    sleepMin,
    firstMealMin: mealTimes[0],
    lunchMin: deriveLunch(mealTimes),
    lastMealMin: mealTimes.length ? mealTimes[mealTimes.length - 1] : undefined,
    walkBinCounts,
    workoutBinCounts,
    plannedCount,
    completedCount,
    disruptionHourCounts,
  };
}

function recomputeRhythm(profile: RhythmProfile): RhythmProfile {
  const recentDateKeys = pickRecentDateKeys(profile.daySummaries);
  const recentSummaries = recentDateKeys.map((dateKey) => profile.daySummaries[dateKey]).filter(Boolean);

  const weightForSummary = (summary: DaySummary) => recencyWeightForDate(summary, recentDateKeys);

  const medianFor = (selector: (summary: DaySummary) => number | undefined): string | undefined => {
    const weightedValues = recentSummaries
      .map((summary) => {
        const value = selector(summary);
        if (typeof value !== 'number') return null;
        return { value, weight: weightForSummary(summary) };
      })
      .filter((entry): entry is { value: number; weight: number } => !!entry);

    const median = weightedMedian(weightedValues);
    return median === null ? undefined : minutesToHHmm(median);
  };

  const weightedAdherenceData = recentSummaries.map((summary) => {
    const weight = weightForSummary(summary);
    return {
      completed: summary.completedCount * weight,
      planned: summary.plannedCount * weight,
    };
  });

  const totalCompleted = weightedAdherenceData.reduce((acc, row) => acc + row.completed, 0);
  const totalPlanned = weightedAdherenceData.reduce((acc, row) => acc + row.planned, 0);
  const adherenceScore = totalPlanned > 0 ? Number((totalCompleted / totalPlanned).toFixed(3)) : 0;

  const disruptionCounts = new Map<number, number>();
  for (const summary of recentSummaries) {
    const weight = weightForSummary(summary);
    for (const [hourText, count] of Object.entries(summary.disruptionHourCounts)) {
      const hour = Number(hourText);
      if (!Number.isNaN(hour)) {
        disruptionCounts.set(hour, (disruptionCounts.get(hour) || 0) + count * weight);
      }
    }
  }

  const disruptionWindows = [...disruptionCounts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([hour]) => hour);

  const daysObserved = recentSummaries.length;

  return {
    ...profile,
    updatedAtISO: new Date().toISOString(),
    daysObserved,
    confidence: deriveConfidence(daysObserved),
    rollingMedians: {
      wake: medianFor((summary) => summary.wakeMin),
      sleep: medianFor((summary) => summary.sleepMin),
      firstMeal: medianFor((summary) => summary.firstMealMin),
      lunch: medianFor((summary) => summary.lunchMin),
      lastMeal: medianFor((summary) => summary.lastMealMin),
    },
    commonBins: {
      walk: topBinsWithWeight(recentSummaries, (summary) => summary.walkBinCounts, weightForSummary),
      workout: topBinsWithWeight(recentSummaries, (summary) => summary.workoutBinCounts, weightForSummary),
    },
    adherenceScore,
    disruptionWindows,
  };
}

export async function ensureRhythmDir(baseDataDir: string): Promise<string> {
  const rhythmDir = path.join(baseDataDir, 'rhythm');
  await fs.mkdir(rhythmDir, { recursive: true });
  return rhythmDir;
}

export async function loadRhythmProfile(baseDataDir: string, deviceId: string): Promise<RhythmProfile> {
  const rhythmDir = await ensureRhythmDir(baseDataDir);
  const filePath = path.join(rhythmDir, `${deviceId}.json`);

  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(raw) as RhythmProfile;
    return {
      ...createDefaultRhythmProfile(deviceId),
      ...parsed,
      deviceId,
      daySummaries: parsed.daySummaries || {},
    };
  } catch {
    return createDefaultRhythmProfile(deviceId);
  }
}

export async function saveRhythmProfile(baseDataDir: string, profile: RhythmProfile): Promise<void> {
  const rhythmDir = await ensureRhythmDir(baseDataDir);
  const filePath = path.join(rhythmDir, `${profile.deviceId}.json`);
  await fs.writeFile(filePath, JSON.stringify(profile, null, 2));
}

export async function resetRhythmProfile(baseDataDir: string, deviceId: string): Promise<RhythmProfile> {
  const rhythmDir = await ensureRhythmDir(baseDataDir);
  const filePath = path.join(rhythmDir, `${deviceId}.json`);
  await fs.rm(filePath, { force: true });
  return createDefaultRhythmProfile(deviceId);
}

export async function updateRhythmFromEvents(
  baseDataDir: string,
  deviceId: string,
  dayState: DayState,
  profile: UserProfile,
  rawEvents: EventLike[]
): Promise<RhythmProfile> {
  const rhythm = await loadRhythmProfile(baseDataDir, deviceId);
  const dateKey = dayState.dateKey || new Date().toISOString().slice(0, 10);

  const summary = deriveDailySummary(dateKey, profile, dayState, rawEvents || []);
  rhythm.daySummaries[dateKey] = summary;

  const recentDateKeys = pickRecentDateKeys(rhythm.daySummaries);
  const trimmed: Record<string, DaySummary> = {};
  for (const key of recentDateKeys) {
    trimmed[key] = rhythm.daySummaries[key];
  }
  rhythm.daySummaries = trimmed;

  const recomputed = recomputeRhythm(rhythm);
  await saveRhythmProfile(baseDataDir, recomputed);
  return recomputed;
}

function shiftMinutesToward(current: number, target: number, maxShiftMinutes: number): number {
  const diff = target - current;
  if (Math.abs(diff) <= maxShiftMinutes) return target;
  return current + Math.sign(diff) * maxShiftMinutes;
}

function parseTimeToMinutes(value?: string): number | null {
  return hhmmToMinutes(value);
}

function applyTimeToDate(base: Date, targetMinutes: number): Date {
  const next = new Date(base);
  const hour = Math.floor(targetMinutes / 60);
  const minute = targetMinutes % 60;
  next.setHours(hour, minute, 0, 0);
  return next;
}

function nearestTarget(current: number, candidates: number[]): number | null {
  if (!candidates.length) return null;
  let best = candidates[0];
  let bestDiff = Math.abs(current - best);
  for (const candidate of candidates) {
    const diff = Math.abs(current - candidate);
    if (diff < bestDiff) {
      best = candidate;
      bestDiff = diff;
    }
  }
  return best;
}

export function applyRhythmToSchedule(
  scheduleItems: PlanStep[],
  rhythm: RhythmProfile,
  userProfile: UserProfile
): PlanStep[] {
  const shouldApply = rhythm.confidence === 'medium' || rhythm.confidence === 'high';
  if (!shouldApply || userProfile.useLearnedRhythm === false) {
    return scheduleItems;
  }

  const adjusted = scheduleItems.map((step) => ({ ...step, event: { ...step.event } }));

  const mealIndices = adjusted
    .map((step, index) => ({ step, index }))
    .filter(({ step }) => step.event.type === 'meal')
    .sort((left, right) => left.step.time.getTime() - right.step.time.getTime())
    .map(({ index }) => index);

  const firstMealTarget = parseTimeToMinutes(rhythm.rollingMedians.firstMeal);
  const lunchTarget = parseTimeToMinutes(rhythm.rollingMedians.lunch);
  const lastMealTarget = parseTimeToMinutes(rhythm.rollingMedians.lastMeal);

  mealIndices.forEach((index, mealPosition) => {
    const step = adjusted[index];
    const currentMinutes = toMinutesFromDate(step.event.time);

    let target: number | null = null;
    if (mealPosition === 0) target = firstMealTarget;
    else if (mealPosition === mealIndices.length - 1) target = lastMealTarget;
    else target = lunchTarget;

    if (target !== null) {
      const shiftedMinutes = shiftMinutesToward(currentMinutes, target, 30);
      step.event.time = applyTimeToDate(step.event.time, shiftedMinutes);
      step.time = new Date(step.event.time);
    }
  });

  const walkTargets = rhythm.commonBins.walk
    .map((bin) => parseTimeToMinutes(bin))
    .filter((value): value is number => value !== null);

  const workoutTargets = rhythm.commonBins.workout
    .map((bin) => parseTimeToMinutes(bin))
    .filter((value): value is number => value !== null);

  for (const step of adjusted) {
    const currentMinutes = toMinutesFromDate(step.event.time);

    if (step.event.type === 'walk') {
      const target = nearestTarget(currentMinutes, walkTargets);
      if (target !== null) {
        const shiftedMinutes = shiftMinutesToward(currentMinutes, target, 30);
        step.event.time = applyTimeToDate(step.event.time, shiftedMinutes);
        step.time = new Date(step.event.time);
      }
    }

    if (step.event.type === 'workout') {
      const target = nearestTarget(currentMinutes, workoutTargets);
      if (target !== null) {
        const shiftedMinutes = shiftMinutesToward(currentMinutes, target, 30);
        step.event.time = applyTimeToDate(step.event.time, shiftedMinutes);
        step.time = new Date(step.event.time);
      }
    }
  }

  return adjusted.sort((left, right) => left.time.getTime() - right.time.getTime());
}
