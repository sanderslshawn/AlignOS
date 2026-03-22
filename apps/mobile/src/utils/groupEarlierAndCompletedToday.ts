import type { ScheduleItem } from '@physiology-engine/shared';
import { sortScheduleItems } from './scheduleSort';

export function groupEarlierAndCompletedToday(
  items: ScheduleItem[],
  nowMinutes: number,
  _dateISO?: string
): { items: ScheduleItem[]; summaryCount: number } {
  const relevantItems = Array.isArray(items) ? items : [];

  const completedItems = relevantItems.filter(
    (item) =>
      item.status === 'actual' ||
      item.origin === 'actual' ||
      item.status === 'skipped'
  );

  const earlierScheduledItems = relevantItems.filter((item) => {
    const isCompleted =
      item.status === 'actual' ||
      item.origin === 'actual' ||
      item.status === 'skipped';

    if (isCompleted) return false;

    const endMin = item.endMin ?? ((item.startMin || 0) + (item.durationMin || 5));
    return endMin <= nowMinutes;
  });

  const deduped = new Map<string, ScheduleItem>();

  for (const item of [...completedItems, ...earlierScheduledItems]) {
    const key = `${item.id}|${item.status || 'planned'}|${item.origin || ''}`;
    deduped.set(key, item);
  }

  const combined = sortScheduleItems(Array.from(deduped.values()));

  return {
    items: combined,
    summaryCount: combined.length,
  };
}