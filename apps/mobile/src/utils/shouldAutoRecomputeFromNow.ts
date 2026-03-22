import type { ScheduleItem } from '@physiology-engine/shared';
import type { MutationIntent } from '../types/mutationIntent';

export interface AutoRecomputeChangeContext {
  action: 'mark-actual' | 'mark-skipped' | 'log-meal' | 'log-walk' | 'log-workout' | 'edit-future-time' | 'drift-detected' | 'other';
  nowMinutes: number;
  affectedItem?: Pick<ScheduleItem, 'type' | 'startMin' | 'status' | 'origin'> | null;
  intent?: MutationIntent;
}

export function shouldAutoRecomputeFromNow(context: AutoRecomputeChangeContext): boolean {
  if (context.intent === 'DELETE' || context.intent === 'DELETE_VALIDATE_ONLY') return false;
  if (context.intent === 'GENERATE_TOMORROW' || context.intent === 'COPY_TODAY_STRUCTURE') return false;

  if (context.action === 'drift-detected') return true;
  if (context.action === 'mark-actual' || context.action === 'mark-skipped') return true;
  if (context.action === 'log-meal' || context.action === 'log-walk' || context.action === 'log-workout') return true;

  if (context.action === 'edit-future-time') {
    const start = context.affectedItem?.startMin ?? 0;
    return start > context.nowMinutes;
  }

  return false;
}
