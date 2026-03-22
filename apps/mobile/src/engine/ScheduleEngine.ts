import type { ScheduleItem } from '@physiology-engine/shared';
import type { QuickStatusSignal } from '../types/quickStatus';

export type ScheduleActionId =
  | 'INSERT_WALK_10'
  | 'INSERT_WALK_8'
  | 'INSERT_SNACK_15'
  | 'SHIFT_LUNCH_EARLIER_15'
  | 'DELAY_CAFFEINE_20'
  | 'ADD_HYDRATION_NOW'
  | 'RECOMPUTE_FROM_NOW';

export interface ScheduleEngineContext {
  nowMinutes: number;
  stressLevel: number;
  sleepScore: number;
  dayMode?: string;
  quickStatusSignals?: QuickStatusSignal[];
}

export interface ScheduleEngineRecommendation {
  actionId: ScheduleActionId;
  reason: string;
  confidence: number;
}

export function rankScheduleActions(
  items: ScheduleItem[],
  context: ScheduleEngineContext
): ScheduleEngineRecommendation[] {
  const recommendations: ScheduleEngineRecommendation[] = [];
  const hasMeal = items.some((item) => item.type === 'meal');
  const hasWalk = items.some((item) => item.type === 'walk');
  const lunch = items.find((item) => item.type === 'meal' && (item.startMin || 0) >= 12 * 60);

  if (lunch && (lunch.startMin || 0) >= 13 * 60) {
    recommendations.push({
      actionId: 'SHIFT_LUNCH_EARLIER_15',
      reason: 'Lunch is scheduled late and may increase midday energy crash risk.',
      confidence: 0.88,
    });
  }

  if (!hasWalk && context.nowMinutes >= 10 * 60 && context.nowMinutes <= 18 * 60) {
    recommendations.push({
      actionId: 'INSERT_WALK_10',
      reason: 'No movement anchor found during daytime window.',
      confidence: 0.8,
    });
  }

  if (!hasMeal && context.nowMinutes >= 11 * 60) {
    recommendations.push({
      actionId: 'INSERT_SNACK_15',
      reason: 'Meal density is low; snack can protect momentum and energy stability.',
      confidence: 0.76,
    });
  }

  if ((context.quickStatusSignals || []).includes('dehydrated')) {
    recommendations.push({
      actionId: 'ADD_HYDRATION_NOW',
      reason: 'Hydration signal detected from quick status.',
      confidence: 0.9,
    });
  }

  if (context.stressLevel >= 8 || context.sleepScore <= 5) {
    recommendations.push({
      actionId: 'RECOMPUTE_FROM_NOW',
      reason: 'High stress / low sleep context suggests adaptive recompute.',
      confidence: 0.85,
    });
  }

  return recommendations
    .sort((left, right) => right.confidence - left.confidence)
    .slice(0, 3);
}
