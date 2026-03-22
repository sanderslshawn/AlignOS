import type { ScheduleItem } from '@physiology-engine/shared';
import { ensureStartEnd } from './time';

export function compareScheduleItemsStable(left: ScheduleItem, right: ScheduleItem): number {
  const normalizedLeft = ensureStartEnd(left);
  const normalizedRight = ensureStartEnd(right);

  const leftStart = normalizedLeft.startMin ?? 0;
  const rightStart = normalizedRight.startMin ?? 0;

  if (leftStart !== rightStart) return leftStart - rightStart;

  return String(left.id || '').localeCompare(String(right.id || ''));
}

export function sortScheduleItems(items: ScheduleItem[]): ScheduleItem[] {
  return [...items].sort(compareScheduleItemsStable);
}