import type { ScheduleItem, UserProfile } from '@physiology-engine/shared';
import { parseClockTime } from '../utils/clockTime';
import { canDeleteScheduleItem } from './normalizeTimeline';
import { validateSchedule } from './validateSchedule';

interface DeleteScheduleItemInput {
  itemId: string;
  currentSchedule: ScheduleItem[];
  settings: UserProfile;
  dateISO?: string;
}

export interface DeleteScheduleItemResult {
  deletedItem: ScheduleItem | null;
  items: ScheduleItem[];
  valid: boolean;
  issues: string[];
}

export function deleteScheduleItem(input: DeleteScheduleItemInput): DeleteScheduleItemResult {
  const deletedItem = input.currentSchedule.find((item) => item.id === input.itemId) || null;

  if (!deletedItem || !canDeleteScheduleItem(deletedItem)) {
    const wakeFallback = input.settings.wakeClockTime || parseClockTime(input.settings.wakeTime) || { hour: 7, minute: 0, period: 'AM' as const };
    const sleepFallback = input.settings.sleepClockTime || parseClockTime(input.settings.sleepTime) || { hour: 11, minute: 0, period: 'PM' as const };
    const passthrough = validateSchedule({
      items: input.currentSchedule,
      wakeTime: wakeFallback,
      sleepTime: sleepFallback,
      dateISO: input.dateISO,
    });

    return {
      deletedItem: null,
      items: passthrough.items,
      valid: passthrough.valid,
      issues: passthrough.issues,
    };
  }

  const remaining = input.currentSchedule.filter((item) => item.id !== input.itemId);
  const wake = input.settings.wakeClockTime || parseClockTime(input.settings.wakeTime) || { hour: 7, minute: 0, period: 'AM' as const };
  const sleep = input.settings.sleepClockTime || parseClockTime(input.settings.sleepTime) || { hour: 11, minute: 0, period: 'PM' as const };

  const validation = validateSchedule({
    items: remaining,
    wakeTime: wake,
    sleepTime: sleep,
    dateISO: input.dateISO,
  });

  return {
    deletedItem,
    items: validation.items,
    valid: validation.valid,
    issues: validation.issues,
  };
}
