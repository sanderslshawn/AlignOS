import type { ClockTime } from '@physiology-engine/shared';

export function fromDateToClockTime(date: Date): ClockTime {
  const hours = date.getHours();
  const minute = date.getMinutes();
  return {
    hour: (hours % 12) || 12,
    minute,
    period: hours >= 12 ? 'PM' : 'AM',
  };
}

export function toISOWithClockTime(baseISO: string | undefined, clockTime: ClockTime): string {
  const hour24 = (clockTime.period === 'PM' ? (clockTime.hour % 12) + 12 : (clockTime.hour % 12));

  // Accept either a date-only string `YYYY-MM-DD` or a full ISO base.
  let year: number;
  let month: number;
  let day: number;

  if (baseISO && /^\d{4}-\d{2}-\d{2}$/.test(baseISO)) {
    const [y, m, d] = baseISO.split('-').map(Number);
    year = y;
    month = m;
    day = d;
  } else {
    const baseDate = baseISO ? new Date(baseISO) : new Date();
    const safeBaseDate = Number.isNaN(baseDate.getTime()) ? new Date() : baseDate;
    year = safeBaseDate.getFullYear();
    month = safeBaseDate.getMonth() + 1;
    day = safeBaseDate.getDate();
  }

  const local = new Date(year, month - 1, day, hour24, clockTime.minute, 0, 0);
  return local.toISOString();
}

export function clockTimeFromISO(iso: string | undefined): ClockTime | null {
  if (!iso) return null;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;
  return fromDateToClockTime(parsed);
}
