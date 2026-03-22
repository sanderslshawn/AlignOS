import type { ScheduleItem } from '@physiology-engine/shared';

export interface ScheduleDriftResult {
  hasDrift: boolean;
  reason?: string;
  behindCurrentBlockByMin?: number;
  missedMealByMin?: number;
}

function isActual(item: ScheduleItem): boolean {
  return item.status === 'actual' || item.origin === 'actual';
}

export function detectScheduleDrift(currentTime: Date, activePlan: ScheduleItem[]): ScheduleDriftResult {
  if (!activePlan.length) return { hasDrift: false };

  const nowMin = currentTime.getHours() * 60 + currentTime.getMinutes();
  const sorted = [...activePlan].sort((a, b) => (a.startMin || 0) - (b.startMin || 0));

  const current = sorted.find((item) => {
    const start = item.startMin || 0;
    const end = item.endMin || start + (item.durationMin || 5);
    return start <= nowMin && nowMin <= end;
  });

  if (current && !isActual(current)) {
    const behindBy = nowMin - (current.startMin || nowMin);
    if (behindBy > 20) {
      return {
        hasDrift: true,
        reason: 'Current block is running behind schedule',
        behindCurrentBlockByMin: behindBy,
      };
    }
  }

  const keyMeal = sorted.find((item) => (item.type === 'meal' || item.type === 'lunch') && !isActual(item));
  if (keyMeal) {
    const missedBy = nowMin - (keyMeal.startMin || nowMin);
    if (missedBy > 45) {
      return {
        hasDrift: true,
        reason: 'Key meal timing drift detected',
        missedMealByMin: missedBy,
      };
    }
  }

  const overdueImportant = sorted.find((item) => {
    if (isActual(item)) return false;
    if (!(item.type === 'focus' || item.type === 'workout' || item.type === 'work')) return false;
    const end = item.endMin || (item.startMin || 0) + (item.durationMin || 5);
    return end + 25 < nowMin;
  });

  if (overdueImportant) {
    return {
      hasDrift: true,
      reason: `${overdueImportant.title} is significantly overdue`,
    };
  }

  return { hasDrift: false };
}
