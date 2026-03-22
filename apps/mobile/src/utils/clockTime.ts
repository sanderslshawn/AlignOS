import type { ClockTime } from '@physiology-engine/shared';

const MINUTES_PER_DAY = 24 * 60;

export function parseClockTime(input: string | ClockTime | null | undefined): ClockTime | null {
  if (!input) return null;

  if (typeof input === 'object') {
    const hour = Number(input.hour);
    const minute = Number(input.minute);
    const period = input.period === 'PM' ? 'PM' : input.period === 'AM' ? 'AM' : null;
    if (!period || !Number.isFinite(hour) || !Number.isFinite(minute)) return null;
    if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return null;
    return { hour, minute, period };
  }

  const raw = input.trim();
  if (!raw) return null;

  const withPeriod = raw.match(/^(\d{1,2}):(\d{2})\s*([aApP][mM])$/);
  if (withPeriod) {
    const hour = Number.parseInt(withPeriod[1], 10);
    const minute = Number.parseInt(withPeriod[2], 10);
    const period = withPeriod[3].toUpperCase() as 'AM' | 'PM';
    if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return null;
    return { hour, minute, period };
  }

  const hhmm = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (hhmm) {
    const hour = Number.parseInt(hhmm[1], 10);
    const minute = Number.parseInt(hhmm[2], 10);
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
    const period: 'AM' | 'PM' = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 === 0 ? 12 : hour % 12;
    return { hour: hour12, minute, period };
  }

  return null;
}

export function formatClockTime(clockTime: ClockTime): string {
  const parsed = parseClockTime(clockTime);
  if (!parsed) return '12:00 AM';
  return `${parsed.hour}:${String(parsed.minute).padStart(2, '0')} ${parsed.period}`;
}

export function toSortableMinutes(clockTime: ClockTime): number {
  const parsed = parseClockTime(clockTime);
  if (!parsed) return 0;

  let hour24 = parsed.hour % 12;
  if (parsed.period === 'PM') hour24 += 12;
  return hour24 * 60 + parsed.minute;
}

export function fromDateToClockTime(date: Date): ClockTime {
  const hours = date.getHours();
  const minute = date.getMinutes();
  return {
    hour: (hours % 12) || 12,
    minute,
    period: hours >= 12 ? 'PM' : 'AM',
  };
}

export function compareClockTime(a: ClockTime, b: ClockTime): number {
  return toSortableMinutes(a) - toSortableMinutes(b);
}

export function addMinutes(clockTime: ClockTime, minutes: number): ClockTime {
  const base = toSortableMinutes(clockTime);
  const shifted = ((Math.round(base + minutes) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const hours24 = Math.floor(shifted / 60);
  const minute = shifted % 60;
  return {
    hour: (hours24 % 12) || 12,
    minute,
    period: hours24 >= 12 ? 'PM' : 'AM',
  };
}

export function isClockTimeWithinRange(time: ClockTime, start: ClockTime, end: ClockTime): boolean {
  const value = toSortableMinutes(time);
  const startValue = toSortableMinutes(start);
  const endValue = toSortableMinutes(end);

  if (startValue <= endValue) {
    return value >= startValue && value <= endValue;
  }

  return value >= startValue || value <= endValue;
}

export function toISOWithClockTime(baseISO: string | undefined, clockTime: ClockTime): string {
  const sortable = toSortableMinutes(clockTime);
  const baseDate = baseISO ? new Date(baseISO) : new Date();
  const safeBaseDate = Number.isNaN(baseDate.getTime()) ? new Date() : baseDate;
  const year = safeBaseDate.getFullYear();
  const month = safeBaseDate.getMonth() + 1;
  const day = safeBaseDate.getDate();
  const local = new Date(year, month - 1, day, Math.floor(sortable / 60), sortable % 60, 0, 0);
  return local.toISOString();
}

export function clockTimeFromISO(iso: string | undefined): ClockTime | null {
  if (!iso) return null;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;
  return fromDateToClockTime(parsed);
}
