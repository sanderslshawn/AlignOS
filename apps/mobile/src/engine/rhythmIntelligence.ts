import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ScheduleItem } from '@physiology-engine/shared';

export interface UserRhythmProfile {
  updatedAtISO: string;
  focusPeakWindow?: string;
  energyCrashWindow?: string;
  preferredWalkTime?: string;
  consistentMealTimes: string[];
  wakeConsistency: number;
  cravingTimes: string[];
  workoutAdherence: number;
  rollingDays: number;
}

interface UpdateRhythmInput {
  deviceId?: string | null;
  dateISO: string;
  wakeTime?: string;
  events: ScheduleItem[];
}

interface RhythmSnapshot {
  dateISO: string;
  focusTimes: number[];
  mealTimes: number[];
  walkTimes: number[];
  workoutPlanned: number;
  workoutActual: number;
  wakeMin?: number;
}

interface StoredRhythmData {
  snapshots: RhythmSnapshot[];
  profile: UserRhythmProfile;
}

const MAX_SNAPSHOTS = 21;

const toStorageKey = (deviceId?: string | null) => `alignos_rhythm_profile_${deviceId || 'local'}`;

const hhmmToMinutes = (value?: string): number | undefined => {
  if (!value) return undefined;
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return undefined;
  const hour = Number.parseInt(match[1], 10);
  const minute = Number.parseInt(match[2], 10);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return undefined;
  return hour * 60 + minute;
};

const minutesToHHmm = (minutes: number): string => {
  const normalized = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const hour = Math.floor(normalized / 60);
  const minute = normalized % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
};

const average = (values: number[]): number | null => {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const extractSnapshot = (input: UpdateRhythmInput): RhythmSnapshot => {
  const focusTimes = input.events
    .filter((item) => item.type === 'focus' || item.type === 'work')
    .map((item) => item.startMin || 0);

  const mealTimes = input.events
    .filter((item) => item.type === 'meal' || item.type === 'snack')
    .map((item) => item.startMin || 0);

  const walkTimes = input.events
    .filter((item) => item.type === 'walk')
    .map((item) => item.startMin || 0);

  const workoutItems = input.events.filter((item) => item.type === 'workout');
  const workoutActual = workoutItems.filter((item) => item.status === 'actual' || item.origin === 'actual').length;

  return {
    dateISO: input.dateISO,
    focusTimes,
    mealTimes,
    walkTimes,
    workoutPlanned: workoutItems.length,
    workoutActual,
    wakeMin: hhmmToMinutes(input.wakeTime),
  };
};

const recomputeProfile = (snapshots: RhythmSnapshot[]): UserRhythmProfile => {
  const focusAvg = average(snapshots.flatMap((item) => item.focusTimes));
  const walkAvg = average(snapshots.flatMap((item) => item.walkTimes));
  const mealAverages = snapshots.map((item) => average(item.mealTimes)).filter((value): value is number => value !== null);
  const wakeValues = snapshots.map((item) => item.wakeMin).filter((value): value is number => typeof value === 'number');

  const crashWindow = mealAverages.length
    ? minutesToHHmm((average(mealAverages) || (13 * 60)) + 90)
    : undefined;

  const wakeMean = average(wakeValues);
  const wakeVariance = wakeValues.length
    ? wakeValues.reduce((sum, value) => sum + Math.pow(value - (wakeMean || value), 2), 0) / wakeValues.length
    : 0;
  const wakeConsistency = Math.max(0, Math.min(1, 1 - (Math.sqrt(wakeVariance) / 120)));

  const consistentMealTimes = mealAverages.length
    ? [minutesToHHmm(Math.round(average(mealAverages) || 12 * 60))]
    : [];

  const totalWorkoutPlanned = snapshots.reduce((sum, item) => sum + item.workoutPlanned, 0);
  const totalWorkoutActual = snapshots.reduce((sum, item) => sum + item.workoutActual, 0);

  return {
    updatedAtISO: new Date().toISOString(),
    focusPeakWindow: focusAvg !== null ? `${minutesToHHmm(Math.round(focusAvg))}-${minutesToHHmm(Math.round(focusAvg + 60))}` : undefined,
    energyCrashWindow: crashWindow ? `${crashWindow}-${minutesToHHmm(hhmmToMinutes(crashWindow)! + 60)}` : undefined,
    preferredWalkTime: walkAvg !== null ? minutesToHHmm(Math.round(walkAvg)) : undefined,
    consistentMealTimes,
    wakeConsistency: Number(wakeConsistency.toFixed(3)),
    cravingTimes: crashWindow ? [crashWindow] : [],
    workoutAdherence: totalWorkoutPlanned > 0 ? Number((totalWorkoutActual / totalWorkoutPlanned).toFixed(3)) : 0,
    rollingDays: snapshots.length,
  };
};

export async function loadRhythmProfile(deviceId?: string | null): Promise<UserRhythmProfile | null> {
  const raw = await AsyncStorage.getItem(toStorageKey(deviceId));
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as StoredRhythmData;
    return parsed.profile;
  } catch {
    return null;
  }
}

export async function updateRhythmProfile(input: UpdateRhythmInput): Promise<UserRhythmProfile> {
  const storageKey = toStorageKey(input.deviceId);
  const raw = await AsyncStorage.getItem(storageKey);
  let existing: StoredRhythmData = {
    snapshots: [],
    profile: {
      updatedAtISO: new Date().toISOString(),
      consistentMealTimes: [],
      wakeConsistency: 0,
      cravingTimes: [],
      workoutAdherence: 0,
      rollingDays: 0,
    },
  };

  if (raw) {
    try {
      existing = JSON.parse(raw) as StoredRhythmData;
    } catch {
      existing = { ...existing };
    }
  }

  const nextSnapshot = extractSnapshot(input);
  const snapshots = [...(existing.snapshots || []).filter((item) => item.dateISO !== input.dateISO), nextSnapshot]
    .sort((left, right) => right.dateISO.localeCompare(left.dateISO))
    .slice(0, MAX_SNAPSHOTS)
    .reverse();

  const profile = recomputeProfile(snapshots);
  await AsyncStorage.setItem(storageKey, JSON.stringify({ snapshots, profile }));

  return profile;
}

export function getRhythmInsights(profile: UserRhythmProfile | null): string[] {
  if (!profile) return [];

  const insights: string[] = [];

  if (profile.energyCrashWindow) {
    insights.push(`You tend to crash around ${profile.energyCrashWindow.split('-')[0]} when lunch slips.`);
  }

  if (profile.focusPeakWindow) {
    insights.push(`You are most productive between ${profile.focusPeakWindow}.`);
  }

  if (profile.preferredWalkTime) {
    insights.push(`Best adherence for walks appears near ${profile.preferredWalkTime}.`);
  }

  if (profile.wakeConsistency < 0.7) {
    insights.push('Wake timing drift is reducing energy predictability.');
  }

  return insights.slice(0, 3);
}
