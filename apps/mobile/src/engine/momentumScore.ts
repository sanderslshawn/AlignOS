import type { ScheduleItem } from '@physiology-engine/shared';

export interface MomentumInput {
  wakeConsistency: number;
  sleepScore: number;
  stressLevel: number;
  scheduleItems: ScheduleItem[];
  sleepDriftMinutes?: number;
}

export interface MomentumResult {
  score: number;
  trend: 'rising' | 'falling' | 'stable';
  insights: string[];
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function calculateMomentumScore(input: MomentumInput): MomentumResult {
  let score = 50;
  const insights: string[] = [];

  const meals = input.scheduleItems.filter((item) => item.type === 'meal' || item.type === 'snack');
  const walks = input.scheduleItems.filter((item) => item.type === 'walk');
  const focusBlocks = input.scheduleItems.filter((item) => item.type === 'focus' || item.type === 'work');
  const skippedWorkout = input.scheduleItems.some((item) => item.type === 'workout' && item.status === 'skipped');

  if (input.wakeConsistency >= 0.8) {
    score += 10;
    insights.push('Wake timing stayed stable.');
  }

  if (meals.length >= 3) {
    score += 10;
    insights.push('Meal rhythm was consistent.');
  } else {
    score -= 6;
  }

  if (walks.some((item) => item.status === 'actual' || item.origin === 'actual')) {
    score += 10;
    insights.push('Movement anchors completed.');
  }

  const completedFocus = focusBlocks.filter((item) => item.status === 'actual' || item.origin === 'actual').length;
  if (completedFocus >= Math.max(1, Math.floor(focusBlocks.length / 2))) {
    score += 10;
    insights.push('Focus blocks were protected.');
  }

  if (skippedWorkout) {
    score -= 10;
    insights.push('Skipped workout reduced momentum.');
  }

  const lateMeal = meals.some((item) => (item.startMin || 0) >= 14 * 60);
  if (lateMeal) {
    score -= 10;
    insights.push('Late meal timing increased dip risk.');
  }

  if ((input.sleepDriftMinutes || 0) > 45) {
    score -= 10;
  }

  if (input.sleepScore >= 7) score += 5;
  if (input.stressLevel >= 8) score -= 8;

  const normalizedScore = clamp(Math.round(score), 0, 100);
  const trend: MomentumResult['trend'] = normalizedScore >= 70 ? 'rising' : normalizedScore <= 45 ? 'falling' : 'stable';

  return {
    score: normalizedScore,
    trend,
    insights: insights.slice(0, 3),
  };
}
