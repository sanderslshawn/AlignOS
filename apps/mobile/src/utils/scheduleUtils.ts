import type { ScheduleItem, UserProfile } from '@physiology-engine/shared';

export type Period = 'AM' | 'PM';

export interface TimeOfDay {
  hour: number;
  minute: number;
  period: Period;
}

export interface ScheduleWindow {
  start: TimeOfDay;
  end: TimeOfDay;
}

export interface ProfileScheduleTimes {
  wakeTime: TimeOfDay;
  sleepTime: TimeOfDay;
  workStart?: TimeOfDay;
  workEnd?: TimeOfDay;
  lunchTime?: TimeOfDay;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function normalizeTimeOfDay(input: TimeOfDay): TimeOfDay {
  const safeMinute = clamp(Math.round(input.minute || 0), 0, 59);
  const rawHour = Math.round(input.hour || 12);
  const safeHour = ((rawHour - 1 + 12) % 12) + 1;
  return {
    hour: safeHour,
    minute: safeMinute,
    period: input.period === 'PM' ? 'PM' : 'AM',
  };
}

export function parseHHmmToTimeOfDay(value?: string): TimeOfDay | null {
  if (!value || typeof value !== 'string') return null;
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;

  const hour24 = Number.parseInt(match[1], 10);
  const minute = Number.parseInt(match[2], 10);

  if (Number.isNaN(hour24) || Number.isNaN(minute) || hour24 < 0 || hour24 > 23 || minute < 0 || minute > 59) {
    return null;
  }

  const period: Period = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;

  return { hour: hour12, minute, period };
}

export function parseISOToTimeOfDay(value?: string): TimeOfDay | null {
  if (!value) return null;
  const match = value.match(/T(\d{2}):(\d{2})/);
  if (!match) return null;
  return parseHHmmToTimeOfDay(`${match[1]}:${match[2]}`);
}

export function format12Hour(input: TimeOfDay): string {
  const normalized = normalizeTimeOfDay(input);
  return `${normalized.hour}:${String(normalized.minute).padStart(2, '0')} ${normalized.period}`;
}

export function to24HourParts(input: TimeOfDay): { hour24: number; minute: number } {
  const normalized = normalizeTimeOfDay(input);
  let hour24 = normalized.hour % 12;
  if (normalized.period === 'PM') hour24 += 12;
  return { hour24, minute: normalized.minute };
}

function toComparableValue(input: TimeOfDay): number {
  const { hour24, minute } = to24HourParts(input);
  return hour24 * 60 + minute;
}

export function compareTimes(a: TimeOfDay, b: TimeOfDay): number {
  return toComparableValue(a) - toComparableValue(b);
}

export function buildScheduleWindow(wakeTime: TimeOfDay, sleepTime: TimeOfDay): ScheduleWindow {
  return {
    start: normalizeTimeOfDay(wakeTime),
    end: normalizeTimeOfDay(sleepTime),
  };
}

export function isSleepWrapWindow(window: ScheduleWindow): boolean {
  return compareTimes(window.end, window.start) <= 0;
}

export function isWithinScheduleWindow(time: TimeOfDay, window: ScheduleWindow): boolean {
  const normalized = normalizeTimeOfDay(time);
  const wraps = isSleepWrapWindow(window);

  if (!wraps) {
    return compareTimes(normalized, window.start) >= 0 && compareTimes(normalized, window.end) <= 0;
  }

  return compareTimes(normalized, window.start) >= 0 || compareTimes(normalized, window.end) <= 0;
}

export function toHHmm24(input: TimeOfDay): string {
  const { hour24, minute } = to24HourParts(input);
  return `${String(hour24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function applyTimeToISO(baseISO: string | undefined, time: TimeOfDay): string {
  const datePart = (baseISO || new Date().toISOString()).split('T')[0];
  return `${datePart}T${toHHmm24(time)}:00.000Z`;
}

export function parseScheduleItemTime(item: ScheduleItem): TimeOfDay | null {
  const fromISO = parseISOToTimeOfDay(item.startISO);
  if (fromISO) return fromISO;

  if (typeof item.startMin === 'number') {
    const normalized = ((Math.round(item.startMin) % (24 * 60)) + (24 * 60)) % (24 * 60);
    const hour24 = Math.floor(normalized / 60);
    const minute = normalized % 60;
    return parseHHmmToTimeOfDay(`${String(hour24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
  }

  return null;
}

export function parseScheduleItemEndTime(item: ScheduleItem): TimeOfDay | null {
  const fromISO = parseISOToTimeOfDay(item.endISO);
  if (fromISO) return fromISO;

  if (typeof item.endMin === 'number') {
    const normalized = ((Math.round(item.endMin) % (24 * 60)) + (24 * 60)) % (24 * 60);
    const hour24 = Math.floor(normalized / 60);
    const minute = normalized % 60;
    return parseHHmmToTimeOfDay(`${String(hour24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
  }

  return null;
}

export function withDeleteFlag(item: ScheduleItem): ScheduleItem {
  const deleteEnabled = item.type !== 'wake' && item.type !== 'sleep';
  return {
    ...item,
    meta: {
      ...(item.meta || {}),
      deleteEnabled,
    },
  };
}

export function cleanEventsOutsideWindow(items: ScheduleItem[], window: ScheduleWindow): ScheduleItem[] {
  return items.filter((item) => {
    const time = parseScheduleItemTime(item);
    if (!time) return false;
    return isWithinScheduleWindow(time, window);
  });
}

export function sortByClockTime(items: ScheduleItem[]): ScheduleItem[] {
  return [...items].sort((left, right) => {
    const leftTime = parseScheduleItemTime(left);
    const rightTime = parseScheduleItemTime(right);

    if (!leftTime && !rightTime) return left.title.localeCompare(right.title);
    if (!leftTime) return 1;
    if (!rightTime) return -1;

    const compared = compareTimes(leftTime, rightTime);
    if (compared !== 0) return compared;
    return left.title.localeCompare(right.title);
  });
}

export function coerceProfileScheduleTimes(profile: UserProfile): ProfileScheduleTimes {
  const wakeTime = parseHHmmToTimeOfDay(profile.wakeTime) || { hour: 7, minute: 0, period: 'AM' };
  const sleepTime = parseHHmmToTimeOfDay(profile.sleepTime) || { hour: 11, minute: 0, period: 'PM' };

  return {
    wakeTime,
    sleepTime,
    workStart: parseHHmmToTimeOfDay(profile.workStartTime) ?? undefined,
    workEnd: parseHHmmToTimeOfDay(profile.workEndTime) ?? undefined,
    lunchTime: parseHHmmToTimeOfDay(profile.lunchTime) ?? undefined,
  };
}

export function validateTimeline(items: ScheduleItem[], window: ScheduleWindow): {
  valid: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  if (items.length === 0) {
    return { valid: false, reasons: ['Timeline is empty'] };
  }

  const first = items[0];
  const last = items[items.length - 1];

  if (first.type !== 'wake') reasons.push('First event is not Wake');
  if (last.type !== 'sleep') reasons.push('Last event is not Sleep');

  for (const item of items) {
    const start = parseScheduleItemTime(item);
    if (!start || !isWithinScheduleWindow(start, window)) {
      reasons.push(`Event outside window: ${item.title}`);
      break;
    }
  }

  for (let index = 1; index < items.length; index++) {
    const previousTime = parseScheduleItemTime(items[index - 1]);
    const currentTime = parseScheduleItemTime(items[index]);
    if (!previousTime || !currentTime) continue;

    if (compareTimes(previousTime, currentTime) > 0) {
      reasons.push('Timeline is not chronologically sorted');
      break;
    }
  }

  return {
    valid: reasons.length === 0,
    reasons,
  };
}
