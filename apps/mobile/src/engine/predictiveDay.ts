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
