import { parseTimeToMinutes } from './time';
import type { RecommendationContext } from './recommendationContext';
import { QUICK_STATUS_LABELS } from '../types/quickStatus';

export interface RecommendationAction {
  id: 'INSERT_WALK_8' | 'INSERT_WALK_10' | 'INSERT_SNACK_15' | 'SHIFT_LUNCH_EARLIER_15' | 'DELAY_CAFFEINE_20' | 'ADD_HYDRATION_NOW' | 'RECOMPUTE_FROM_NOW';
  label: string;
}

export interface RecommendationOutput {
  cards: string[];
  actions: RecommendationAction[];
}

export function generateRecommendationsFromContext(context: RecommendationContext): RecommendationOutput {
  const cards: string[] = [];
  const actions: RecommendationAction[] = [];

  const mealCount = context.timelineItems.filter((item) => item.type === 'meal' || item.type === 'snack').length;
  const workoutCount = context.timelineItems.filter((item) => item.type === 'workout').length;
  const walkCount = context.timelineItems.filter((item) => item.type === 'walk').length;

  const lunchMin = parseTimeToMinutes(context.lunchTime || '12:30') || 750;
  const lateLunch = context.timelineItems.some((item) => (item.type === 'meal' || item.type === 'lunch') && (item.startMin || 0) >= lunchMin + 60);

  if (context.fitnessGoal === 'FAT_LOSS' || context.fitnessGoal === 'WEIGHT_LOSS') {
    cards.push('Prioritize post-meal movement to improve glucose control and support fat loss.');
    cards.push('Keep meal timing stable and avoid compressing calories late in the day.');
    if (walkCount < 2) actions.push({ id: 'INSERT_WALK_8', label: 'Insert 8-min walk' });
  } else if (context.fitnessGoal === 'MUSCLE_GAIN' || context.fitnessGoal === 'MUSCLE_BUILDING') {
    cards.push('Protect workout placement and add protein-forward fueling around training.');
    cards.push('Use a strategic snack between meals when training density is high.');
    if (workoutCount === 0) actions.push({ id: 'RECOMPUTE_FROM_NOW', label: 'Add training structure' });
  } else {
    cards.push('Keep anchors consistent to preserve energy stability through the day.');
  }

  if (context.dayMode === 'tight' || context.dayMode === 'high-output') {
    cards.push('Tight mode active: keep anchors fixed and reduce discretionary inserts.');
    actions.push({ id: 'RECOMPUTE_FROM_NOW', label: 'Tighten afternoon' });
  }

  if (context.dayMode === 'recovery' || context.sleepScore <= 6 || context.stressLevel >= 7) {
    cards.push('Recovery bias: lower intensity and prioritize hydration, walking, and winddown protection.');
    if (context.stressLevel >= 7) actions.push({ id: 'DELAY_CAFFEINE_20', label: 'Delay caffeine 20 min' });
  }

  if (context.dietFoundation === 'KETO' || context.dietFoundation === 'CARNIVORE') {
    cards.push('Align meals with your diet foundation: emphasize protein/fat and reduce opportunistic carb snacking.');
  } else if (context.dietFoundation === 'MEDITERRANEAN') {
    cards.push('Favor mediterranean composition: fiber-rich plants, olive oil, and balanced protein distribution.');
  }

  if (context.mealSequencePreference === 'protein-first') {
    cards.push('Meal sequence set to protein-first: start each meal/snack with protein to blunt glucose spikes.');
  } else if (context.mealSequencePreference === 'carb-last') {
    cards.push('Meal sequence set to carb-last: keep carbs toward the end of meals for steadier energy.');
  }

  if (mealCount < 3) {
    cards.push('Low meal/snack density detected; add one bridge snack to avoid late-day energy crashes.');
  }

  if (lateLunch) {
    actions.push({ id: 'SHIFT_LUNCH_EARLIER_15', label: 'Shift lunch earlier' });
  }

  if (context.fastingHours >= 16) {
    cards.push(`Fasting target is ${context.fastingHours}h: avoid random intake outside your planned window.`);
  }

  if (context.quickStatusSignals.length > 0) {
    const signalText = context.quickStatusSignals.map((signal) => QUICK_STATUS_LABELS[signal]).join(', ');
    cards.push(`Quick Status active: ${signalText}.`);

    if (context.quickStatusSignals.includes('hungry-now')) {
      actions.push({ id: 'INSERT_SNACK_15', label: 'Insert protein snack' });
    }
    if (context.quickStatusSignals.includes('dehydrated')) {
      actions.push({ id: 'ADD_HYDRATION_NOW', label: 'Add hydration now' });
    }
    if (context.quickStatusSignals.includes('low-energy') || context.quickStatusSignals.includes('mental-fog')) {
      actions.push({ id: 'INSERT_WALK_8', label: 'Insert 8-min reset walk' });
    }
    if (context.quickStatusSignals.includes('poor-sleep')) {
      actions.push({ id: 'DELAY_CAFFEINE_20', label: 'Delay caffeine 20 min' });
    }
    if (context.quickStatusImpact.modifier <= -8) {
      actions.push({ id: 'RECOMPUTE_FROM_NOW', label: 'Recompute from now' });
    }
  }

  if (typeof context.momentumScore === 'number') {
    if (context.momentumScore < 50) {
      cards.push('Momentum is drifting; protect lunch timing and insert one short walk anchor.');
      actions.push({ id: 'INSERT_WALK_8', label: 'Insert 8-min reset walk' });
    } else if (context.momentumScore >= 75) {
      cards.push('Momentum is strong; keep core anchors stable and avoid unnecessary schedule edits.');
    }
  }

  if (context.rhythmProfile?.rollingMedians?.lunch) {
    cards.push(`Rhythm insight: your strongest afternoons follow lunch near ${context.rhythmProfile.rollingMedians.lunch}.`);
  }

  if (Array.isArray(context.rhythmInsights) && context.rhythmInsights.length) {
    cards.push(context.rhythmInsights[0]);
  }

  return {
    cards: Array.from(new Set(cards)).slice(0, 6),
    actions: dedupeActions(actions).slice(0, 3),
  };
}

function dedupeActions(actions: RecommendationAction[]): RecommendationAction[] {
  const seen = new Set<string>();
  const deduped: RecommendationAction[] = [];
  for (const action of actions) {
    if (seen.has(action.id)) continue;
    seen.add(action.id);
    deduped.push(action);
  }
  return deduped;
}
