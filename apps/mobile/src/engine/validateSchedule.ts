import type { ScheduleItem } from '@physiology-engine/shared';
import type { ClockTime } from '@physiology-engine/shared';
import { normalizeAndValidateTimeline, canDeleteScheduleItem } from './normalizeTimeline';

interface ValidateScheduleInput {
  items: ScheduleItem[];
  wakeTime: ClockTime;
  sleepTime: ClockTime;
  dateISO?: string;
}

interface ValidateScheduleResult {
  items: ScheduleItem[];
  valid: boolean;
  issues: string[];
}

export function validateSchedule(input: ValidateScheduleInput): ValidateScheduleResult {
  const syntheticSettings = {
    wakeTime: `${String(input.wakeTime.hour).padStart(2, '0')}:${String(input.wakeTime.minute).padStart(2, '0')}`,
    sleepTime: `${String(input.sleepTime.hour).padStart(2, '0')}:${String(input.sleepTime.minute).padStart(2, '0')}`,
    wakeClockTime: input.wakeTime,
    sleepClockTime: input.sleepTime,
  } as any;

  const normalized = normalizeAndValidateTimeline(input.items, syntheticSettings, {
    dateISO: input.dateISO,
  });

  return {
    items: normalized.items,
    valid: normalized.valid,
    issues: normalized.issues,
  };
}

export { canDeleteScheduleItem };
