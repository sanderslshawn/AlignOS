import { addMinutes } from 'date-fns';
import type { ScheduleItem } from '@physiology-engine/shared';

export type SelfHealingTrigger = 'workout-skipped' | 'meal-delayed' | 'focus-interrupted' | 'unexpected-event';

export type SelfHealingMutation =
  | { kind: 'add'; item: Omit<ScheduleItem, 'id'> }
  | { kind: 'update'; id: string; updates: Partial<ScheduleItem> }
  | { kind: 'recompute' };

export interface SelfHealingContext {
  now: Date;
  nowMinutes: number;
  sleepScore: number;
  stressLevel: number;
  quickStatusSignals: string[];
}

export interface SelfHealingResult {
  applied: boolean;
  reason: string;
  toast: string;
  highlightHints: Array<{ title?: string; id?: string }>;
  mutations: SelfHealingMutation[];
}

const buildRecoveryBlock = (baseTime: Date): Omit<ScheduleItem, 'id'> => {
  const start = baseTime;
  const end = addMinutes(start, 12);
  const startMin = start.getHours() * 60 + start.getMinutes();
  return {
    type: 'custom',
    title: 'Recovery Reset',
    startISO: start.toISOString(),
    endISO: end.toISOString(),
    startMin,
    endMin: startMin + 12,
    durationMin: 12,
    source: 'system',
    status: 'planned',
    isSystemAnchor: true,
    isFixedAnchor: false,
    fixed: false,
    locked: false,
    deletable: true,
    notes: 'Self-healed from skipped training block',
  };
};

const buildLightWalk = (baseTime: Date): Omit<ScheduleItem, 'id'> => {
  const start = baseTime;
  const end = addMinutes(start, 10);
  const startMin = start.getHours() * 60 + start.getMinutes();
  return {
    type: 'walk',
    title: 'Light Walk Reset',
    startISO: start.toISOString(),
    endISO: end.toISOString(),
    startMin,
    endMin: startMin + 10,
    durationMin: 10,
    source: 'system',
    status: 'planned',
    isSystemAnchor: true,
    isFixedAnchor: false,
    fixed: false,
    locked: false,
    deletable: true,
    notes: 'Self-healed after skipped workout',
  };
};

export function selfHealSchedule(input: {
  currentSchedule: ScheduleItem[];
  trigger: SelfHealingTrigger;
  targetEvent?: ScheduleItem;
  context: SelfHealingContext;
}): SelfHealingResult {
  const { trigger, targetEvent, context } = input;

  if (trigger === 'workout-skipped') {
    const addWalk = context.sleepScore >= 6 && context.stressLevel <= 7;
    const replacement = addWalk ? buildLightWalk(context.now) : buildRecoveryBlock(context.now);

    return {
      applied: true,
      reason: addWalk ? 'Skipped workout replaced with light movement anchor.' : 'Skipped workout replaced with recovery reset.',
      toast: 'AlignOS adjusted your day.',
      highlightHints: [{ title: replacement.title }],
      mutations: [{ kind: 'add', item: replacement }],
    };
  }

  if (trigger === 'meal-delayed' && targetEvent) {
    const delayedMinutes = Math.max(15, Math.min(45, Math.round((targetEvent.durationMin || 30) / 2)));
    const downstreamMeals = input.currentSchedule
      .filter((item) => (item.type === 'meal' || item.type === 'snack') && item.id !== targetEvent.id && (item.startMin || 0) > (targetEvent.startMin || 0))
      .slice(0, 2);

    if (!downstreamMeals.length) {
      return {
        applied: true,
        reason: 'Meal delay detected; recomputing remainder of day.',
        toast: 'AlignOS adjusted your day.',
        highlightHints: [],
        mutations: [{ kind: 'recompute' }],
      };
    }

    return {
      applied: true,
      reason: 'Meal delay propagated to protect downstream energy stability.',
      toast: 'AlignOS adjusted your day.',
      highlightHints: downstreamMeals.map((item) => ({ id: item.id, title: item.title })),
      mutations: downstreamMeals.map((item) => ({
        kind: 'update' as const,
        id: item.id,
        updates: {
          startMin: (item.startMin || 0) + delayedMinutes,
          endMin: (item.endMin || 0) + delayedMinutes,
          status: 'adjusted',
        },
      })),
    };
  }

  if (trigger === 'focus-interrupted') {
    const start = new Date(context.now);
    start.setMinutes(start.getMinutes() + 45);
    const end = addMinutes(start, 25);
    const startMin = start.getHours() * 60 + start.getMinutes();

    return {
      applied: true,
      reason: 'Interrupted focus reinserted as micro-focus block later in day.',
      toast: 'AlignOS adjusted your day.',
      highlightHints: [{ title: 'Focus Recovery Block' }],
      mutations: [
        {
          kind: 'add',
          item: {
            type: 'focus',
            title: 'Focus Recovery Block',
            startISO: start.toISOString(),
            endISO: end.toISOString(),
            startMin,
            endMin: startMin + 25,
            durationMin: 25,
            source: 'system',
            status: 'planned',
            isSystemAnchor: true,
            isFixedAnchor: false,
            fixed: false,
            locked: false,
            deletable: true,
            notes: 'Self-healed from interrupted focus block',
          },
        },
      ],
    };
  }

  if (trigger === 'unexpected-event') {
    return {
      applied: true,
      reason: 'Unexpected event inserted; schedule recompute required.',
      toast: 'AlignOS adjusted your day.',
      highlightHints: [],
      mutations: [{ kind: 'recompute' }],
    };
  }

  return {
    applied: false,
    reason: 'No self-healing required.',
    toast: 'AlignOS adjusted your day.',
    highlightHints: [],
    mutations: [],
  };
}
