export const QUICK_STATUS_SIGNALS = [
  'hungry-now',
  'craving-comfort',
  'low-energy',
  'high-stress',
  'dehydrated',
  'poor-sleep',
  'mental-fog',
] as const;

export type QuickStatusSignal = (typeof QUICK_STATUS_SIGNALS)[number];

export const QUICK_STATUS_LABELS: Record<QuickStatusSignal, string> = {
  'hungry-now': 'Hungry now',
  'craving-comfort': 'Craving comfort',
  'low-energy': 'Low energy',
  'high-stress': 'High stress',
  'dehydrated': 'Dehydrated',
  'poor-sleep': 'Poor sleep',
  'mental-fog': 'Mental fog',
};

export type QuickStatusActionId =
  | 'INSERT_WALK_8'
  | 'INSERT_WALK_10'
  | 'INSERT_SNACK_15'
  | 'SHIFT_LUNCH_EARLIER_15'
  | 'DELAY_CAFFEINE_20'
  | 'ADD_HYDRATION_NOW'
  | 'RECOMPUTE_FROM_NOW';

export interface QuickStatusAction {
  id: QuickStatusActionId;
  label: string;
}

export interface QuickStatusDecision {
  primarySignal: QuickStatusSignal;
  severity: 'low' | 'medium' | 'high';
  title: string;
  reasoning: string;
  actions: QuickStatusAction[];
}

export interface QuickStatusEvaluationInput {
  signals: QuickStatusSignal[];
  nowMinutes: number;
  sleepScore: number;
  stressLevel: number;
}

export function normalizeQuickStatusSignals(input: unknown): QuickStatusSignal[] {
  if (!Array.isArray(input)) return [];
  const allowed = new Set<string>(QUICK_STATUS_SIGNALS);
  const values = input
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim().toLowerCase())
    .filter((value) => allowed.has(value));

  return Array.from(new Set(values)) as QuickStatusSignal[];
}
