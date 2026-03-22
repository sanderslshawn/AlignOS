import type { ScheduleItem } from '@physiology-engine/shared';
import type { QuickStatusAction, QuickStatusDecision, QuickStatusEvaluationInput, QuickStatusSignal } from '../types/quickStatus';

const signalPriority: Record<QuickStatusSignal, number> = {
  'high-stress': 100,
  'low-energy': 90,
  'poor-sleep': 85,
  'hungry-now': 80,
  'dehydrated': 75,
  'mental-fog': 70,
  'craving-comfort': 65,
};

function dedupeActions(actions: QuickStatusAction[]): QuickStatusAction[] {
  const seen = new Set<string>();
  const output: QuickStatusAction[] = [];
  for (const action of actions) {
    if (seen.has(action.id)) continue;
    seen.add(action.id);
    output.push(action);
  }
  return output;
}

export function evaluateQuickStatusDecision(input: QuickStatusEvaluationInput): QuickStatusDecision | null {
  if (!input.signals.length) return null;

  const sortedSignals = [...input.signals].sort((a, b) => signalPriority[b] - signalPriority[a]);
  const primary = sortedSignals[0];
  const morningWindow = input.nowMinutes < 12 * 60;
  const severeLoad = input.stressLevel >= 8 || input.sleepScore <= 5 || input.signals.length >= 3;

  const actions: QuickStatusAction[] = [];

  if (sortedSignals.includes('dehydrated')) {
    actions.push({ id: 'ADD_HYDRATION_NOW', label: 'Add hydration now' });
  }

  if (sortedSignals.includes('hungry-now')) {
    if (morningWindow) {
      actions.push({ id: 'INSERT_SNACK_15', label: 'Insert protein snack' });
    } else {
      actions.push({ id: 'SHIFT_LUNCH_EARLIER_15', label: 'Shift lunch earlier 15 min' });
    }
  }

  if (sortedSignals.includes('low-energy') || sortedSignals.includes('mental-fog')) {
    actions.push({ id: 'INSERT_WALK_8', label: 'Insert 8-min reset walk' });
  }

  if (sortedSignals.includes('high-stress')) {
    actions.push({ id: 'INSERT_WALK_10', label: 'Insert 10-min decompression walk' });
  }

  if (sortedSignals.includes('poor-sleep')) {
    actions.push({ id: 'DELAY_CAFFEINE_20', label: 'Delay caffeine 20 min' });
  }

  if (sortedSignals.includes('craving-comfort')) {
    actions.push({ id: 'INSERT_WALK_8', label: 'Insert 8-min craving reset' });
  }

  if (severeLoad) {
    actions.push({ id: 'RECOMPUTE_FROM_NOW', label: 'Recompute from now' });
  }

  const severity: QuickStatusDecision['severity'] = severeLoad ? 'high' : input.signals.length >= 2 ? 'medium' : 'low';

  return {
    primarySignal: primary,
    severity,
    title: quickStatusTitle(primary),
    reasoning: quickStatusReasoning(primary, input),
    actions: dedupeActions(actions).slice(0, 3),
  };
}

export function deriveQuickStatusSummary(signals: QuickStatusSignal[]): { modifier: number; label: string } {
  if (!signals.length) return { modifier: 0, label: 'stable' };

  let modifier = 0;
  if (signals.includes('low-energy')) modifier -= 6;
  if (signals.includes('poor-sleep')) modifier -= 5;
  if (signals.includes('high-stress')) modifier -= 4;
  if (signals.includes('dehydrated')) modifier -= 3;
  if (signals.includes('hungry-now')) modifier -= 2;
  if (signals.includes('mental-fog')) modifier -= 3;
  if (signals.includes('craving-comfort')) modifier -= 1;

  const label = modifier <= -10 ? 'strained' : modifier <= -5 ? 'wobble' : 'stable';
  return { modifier, label };
}

export function hasUpcomingMeal(items: ScheduleItem[], nowMinutes: number, withinMinutes: number): boolean {
  return items.some((item) => {
    if (item.type !== 'meal' && item.type !== 'snack') return false;
    const startMin = typeof item.startMin === 'number' ? item.startMin : 0;
    return startMin >= nowMinutes && startMin <= nowMinutes + withinMinutes;
  });
}

function quickStatusTitle(signal: QuickStatusSignal): string {
  if (signal === 'hungry-now') return 'Hunger signal detected';
  if (signal === 'craving-comfort') return 'Comfort craving detected';
  if (signal === 'low-energy') return 'Energy dip detected';
  if (signal === 'high-stress') return 'Stress load is elevated';
  if (signal === 'dehydrated') return 'Hydration support needed';
  if (signal === 'poor-sleep') return 'Low sleep resilience detected';
  return 'Mental clarity support suggested';
}

function quickStatusReasoning(signal: QuickStatusSignal, input: QuickStatusEvaluationInput): string {
  const shared = `Sleep ${input.sleepScore}/10 • Stress ${input.stressLevel}/10`;
  if (signal === 'hungry-now') return `Fuel timing likely off-anchor. ${shared}.`;
  if (signal === 'craving-comfort') return `Comfort-seeking pattern active. ${shared}.`;
  if (signal === 'low-energy') return `Current demand exceeds energy availability. ${shared}.`;
  if (signal === 'high-stress') return `Cognitive load is high; momentum risk increased. ${shared}.`;
  if (signal === 'dehydrated') return `Hydration lag can reduce focus and energy. ${shared}.`;
  if (signal === 'poor-sleep') return `Sleep debt lowers resilience through midday. ${shared}.`;
  return `Attention and focus are likely degraded. ${shared}.`;
}
