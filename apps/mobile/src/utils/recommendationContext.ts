import type { DayPlan, DayState, ScheduleItem, UserProfile } from '@physiology-engine/shared';
import { deriveQuickStatusSummary } from '../engine/quickStatusEngine';
import { normalizeQuickStatusSignals, type QuickStatusSignal } from '../types/quickStatus';

export interface RecommendationContext {
  date: string;
  now: string;
  wakeTime: string;
  sleepTime: string;
  workStart?: string;
  workEnd?: string;
  lunchTime?: string;
  dayMode: string;
  fitnessGoal: string;
  dietFoundation: string;
  mealSequencePreference: string;
  mealSequence: string;
  fastingHours: number;
  sleepScore: number;
  stressLevel: number;
  currentHeartRate?: number;
  quickStatusSignals: QuickStatusSignal[];
  quickStatusImpact: { modifier: number; label: string };
  momentumScore?: number;
  rhythmInsights?: string[];
  timelineItems: ScheduleItem[];
  actualEvents: ScheduleItem[];
  rhythmProfile?: any;
}

export function buildRecommendationContext(input: {
  dateISO: string;
  profile: UserProfile;
  dayState?: DayState | null;
  plan?: DayPlan | null;
  todayEntries?: ScheduleItem[];
  rhythmProfile?: any;
  momentumScore?: number;
  rhythmInsights?: string[];
}): RecommendationContext {
  const timelineItems = input.plan?.items || [];
  const actualEvents = (input.todayEntries || []).filter(
    (item) => item.status === 'actual' || item.origin === 'actual'
  );
  const quickStatusSignals = normalizeQuickStatusSignals((input.dayState as any)?.quickStatusSignals);
  const quickStatusImpact = deriveQuickStatusSummary(quickStatusSignals);

  return {
    date: input.dateISO,
    now: new Date().toISOString(),
    wakeTime: input.profile.wakeTime,
    sleepTime: input.profile.sleepTime,
    workStart: input.profile.workStartTime,
    workEnd: input.profile.workEndTime,
    lunchTime: input.profile.lunchTime,
    dayMode: input.dayState?.dayMode || input.profile.defaultDayMode || 'flex',
    fitnessGoal: input.profile.fitnessGoal || 'MAINTENANCE',
    dietFoundation: input.profile.dietFoundation || 'BALANCED',
    mealSequencePreference: input.profile.mealSequencePreference || 'balanced',
    mealSequence: input.profile.mealSequencePreference || 'balanced',
    fastingHours: input.profile.preferredFastingHours || 14,
    sleepScore: input.dayState?.sleepQuality || 7,
    stressLevel: input.dayState?.stressLevel || 5,
    currentHeartRate: (input.dayState as any)?.currentHeartRate,
    quickStatusSignals,
    quickStatusImpact,
    momentumScore: input.momentumScore,
    rhythmInsights: input.rhythmInsights,
    timelineItems,
    actualEvents,
    rhythmProfile: input.rhythmProfile,
  };
}
