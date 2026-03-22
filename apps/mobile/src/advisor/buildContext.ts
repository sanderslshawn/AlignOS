/**
 * AlignOS Advisor - Context Builder
 * Assembles DayState context for decision engine
 */

import type { DecisionContext } from './types';
import type { UserProfile, DayPlan, DayState } from '@physiology-engine/shared';
import { buildRecommendationContext } from '../utils/recommendationContext';

export function buildDecisionContext(
  query: string,
  profile: UserProfile,
  dayState: DayState | null,
  currentPlan: DayPlan | null
): DecisionContext {
  const dateISO = new Date().toISOString().split('T')[0];

  return {
    query,
    profile,
    dayState,
    currentPlan: currentPlan ?? undefined,
    currentTime: new Date(),
    recommendationContext: buildRecommendationContext({
      dateISO,
      profile,
      dayState,
      plan: currentPlan,
      todayEntries: currentPlan?.items || [],
    }),
  };
}

/**
 * Get current context summary for display in Context Bar
 */
export function getContextSummary(dayState: DayState | null, currentPlan: DayPlan | null) {
  if (!dayState || !currentPlan) {
    return {
      dayMode: 'flex',
      sleepScore: 7,
      stressLevel: 'low',
      fastingHours: 16,
      nextMeal: null,
      nowTime: new Date(),
    };
  }

  const now = new Date();
  const nextMealItem = currentPlan.items.find(
    item => item.type === 'meal' && new Date(item.startISO) > now
  );

  return {
    dayMode: dayState.dayMode || 'flex',
    sleepScore: dayState.sleepQuality || 7,
    stressLevel: dayState.stressLevel === 0 ? 'low' : dayState.stressLevel === 1 ? 'medium' : 'high',
    fastingHours: 16, // Default, could calculate from profile
    nextMeal: nextMealItem ? {
      title: nextMealItem.title,
      time: new Date(nextMealItem.startISO),
    } : null,
    nowTime: now,
  };
}
