import type { ClockTime, ScheduleItem } from '@physiology-engine/shared';
import { sortScheduleItems } from './scheduleSort';

export function safeRenderTimeline(
  items: ScheduleItem[],
  _wakeTime: ClockTime,
  _sleepTime: ClockTime,
  _dateISO: string
): ScheduleItem[] {
  try {
    return sortScheduleItems(
      [...(items || [])].filter((item) => item && item.type && item.title)
    );
  } catch (error) {
    console.warn('[safeRenderTimeline] Fallback sort failed', error);
    return [];
  }
}