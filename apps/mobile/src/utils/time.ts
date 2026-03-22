import type { ScheduleItem } from '@physiology-engine/shared';

const MINUTES_PER_DAY = 24 * 60;

function clampMinutes(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const rounded = Math.round(value);
  const normalized = ((rounded % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  return normalized;
}

function parseIsoClockToMinutes(input: string): number | null {
  // Parse the ISO string into a Date so we interpret the stored ISO as UTC
  // and then extract the local clock hours/minutes to get the user's intended time.
  try {
    const d = new Date(input);
    if (Number.isNaN(d.getTime())) return null;
    const hours = d.getHours();
    const minutes = d.getMinutes();
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
    return hours * 60 + minutes;
  } catch (e) {
    return null;
  }
}

export function normalizeMinutes(mins: number): number {
  return clampMinutes(mins);
}

export function parseTimeToMinutes(input: unknown): number | null {
  if (typeof input === 'number') {
    return normalizeMinutes(input);
  }

  if (typeof input !== 'string') {
    return null;
  }

  const raw = input.trim();
  if (!raw) return null;

  const isoValue = parseIsoClockToMinutes(raw);
  if (isoValue !== null) return isoValue;

  const ampmMatch = raw.match(/^(\d{1,2}):(\d{2})\s*([aApP][mM])$/);
  if (ampmMatch) {
    let hour = Number.parseInt(ampmMatch[1], 10);
    const minute = Number.parseInt(ampmMatch[2], 10);
    const suffix = ampmMatch[3].toUpperCase();

    if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return null;
    if (suffix === 'AM') {
      if (hour === 12) hour = 0;
    } else if (hour !== 12) {
      hour += 12;
    }

    return hour * 60 + minute;
  }

  const hhmm24 = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (hhmm24) {
    const hour = Number.parseInt(hhmm24[1], 10);
    const minute = Number.parseInt(hhmm24[2], 10);
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
    return hour * 60 + minute;
  }

  return null;
}

export function minutesTo12h(mins: number): string {
  const normalized = normalizeMinutes(mins);
  const hour24 = Math.floor(normalized / 60);
  const minute = normalized % 60;
  const suffix = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${String(minute).padStart(2, '0')} ${suffix}`;
}

export function formatRange12h(startMin: number, endMin: number): string {
  return `${minutesTo12h(startMin)} – ${minutesTo12h(endMin)}`;
}

export function compareByStartMin(a: { startMin?: number }, b: { startMin?: number }): number {
  const left = normalizeMinutes(a.startMin ?? 0);
  const right = normalizeMinutes(b.startMin ?? 0);
  return left - right;
}

function fromDuration(startMin: number, durationMin?: number): number {
  if (!durationMin || !Number.isFinite(durationMin)) return startMin + 5;
  const duration = Math.max(1, Math.round(durationMin));
  return startMin + duration;
}

export function ensureStartEnd<T extends Partial<ScheduleItem>>(item: T): T & { startMin: number; endMin: number } {
  let startMin = parseTimeToMinutes(item.startMin);
  if (startMin === null) {
    startMin = parseTimeToMinutes(item.startISO);
  }

  let endMin = parseTimeToMinutes(item.endMin);
  if (endMin === null) {
    endMin = parseTimeToMinutes(item.endISO);
  }

  if (startMin === null) startMin = 0;
  if (endMin === null) endMin = fromDuration(startMin, item.durationMin as number | undefined);

  if (endMin <= startMin) {
    endMin = startMin + 5;
  }

  return {
    ...item,
    startMin: normalizeMinutes(startMin),
    endMin: normalizeMinutes(endMin),
  };
}

export function minutesToHHmm(mins: number): string {
  const normalized = normalizeMinutes(mins);
  const hours = String(Math.floor(normalized / 60)).padStart(2, '0');
  const minutes = String(normalized % 60).padStart(2, '0');
  return `${hours}:${minutes}`;
}
