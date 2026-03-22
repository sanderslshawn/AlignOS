import { parseISO, differenceInHours, differenceInMinutes, format, addHours, addMinutes, isBefore, parse } from 'date-fns';

/**
 * Calculate hours elapsed since a timestamp
 */
export function hoursSince(timestamp: string | undefined): number {
  if (!timestamp) return 0;
  try {
    const past = parseISO(timestamp);
    const now = new Date();
    return Math.max(0, differenceInHours(now, past));
  } catch {
    return 0;
  }
}

/**
 * Calculate minutes since a timestamp
 */
export function minutesSince(timestamp: string | undefined): number {
  if (!timestamp) return 0;
  try {
    const past = parseISO(timestamp);
    const now = new Date();
    return Math.max(0, differenceInMinutes(now, past));
  } catch {
    return 0;
  }
}

/**
 * Format time in HH:MM AM/PM format
 */
export function formatTime(timestamp: string | Date | undefined): string {
  if (!timestamp) return '';
  try {
    const date = typeof timestamp === 'string' ? parseISO(timestamp) : timestamp;
    return format(date, 'h:mma').toLowerCase();
  } catch {
    return '';
  }
}

/**
 * Format time in 24-hour format (HH:MM)
 */
export function formatTime24(timestamp: string | Date | undefined): string {
  if (!timestamp) return '';
  try {
    const date = typeof timestamp === 'string' ? parseISO(timestamp) : timestamp;
    return format(date, 'HH:mm');
  } catch {
    return '';
  }
}

/**
 * Add hours to a timestamp
 */
export function addHoursToTime(timestamp: string | Date, hours: number): Date {
  const date = typeof timestamp === 'string' ? parseISO(timestamp) : timestamp;
  return addHours(date, hours);
}

/**
 * Add minutes to a timestamp
 */
export function addMinutesToTime(timestamp: string | Date, minutes: number): Date {
  const date = typeof timestamp === 'string' ? parseISO(timestamp) : timestamp;
  return addMinutes(date, minutes);
}

/**
 * Clamp a time to be before a bedtime (don't suggest activities past bedtime)
 */
export function clampToBeforeBedtime(time: Date | string, bedtime: string | undefined): Date {
  if (!bedtime) return typeof time === 'string' ? parseISO(time) : time;
  
  try {
    const timeDate = typeof time === 'string' ? parseISO(time) : time;
    const bedtimeDate = parseISO(bedtime);
    
    if (isBefore(bedtimeDate, timeDate)) {
      // If proposed time is after bedtime, return bedtime minus 30min
      return addMinutes(bedtimeDate, -30);
    }
    
    return timeDate;
  } catch {
    return typeof time === 'string' ? parseISO(time) : time;
  }
}

/**
 * Parse a 24-hour time string (HH:MM) and create a Date for today
 */
export function parseTimeToday(timeString: string | undefined): Date | undefined {
  if (!timeString) return undefined;
  try {
    const today = format(new Date(), 'yyyy-MM-dd');
    return parseISO(`${today}T${timeString}:00`);
  } catch {
    return undefined;
  }
}

/**
 * Get a time N hours from now
 */
export function getTimeFromNow(hours: number): Date {
  return addHours(new Date(), hours);
}

/**
 * Get a time N minutes from now
 */
export function getTimeFromNowMinutes(minutes: number): Date {
  return addMinutes(new Date(), minutes);
}

/**
 * Convert hours to a human-readable format (e.g., 3.5 -> "3.5h" or "3h 30m")
 */
export function formatHours(hours: number, includeMinutes = false): string {
  if (!includeMinutes) {
    return `${hours.toFixed(1)}h`;
  }
  
  const wholeHours = Math.floor(hours);
  const minutes = Math.round((hours - wholeHours) * 60);
  
  if (minutes === 0) {
    return `${wholeHours}h`;
  }
  
  if (wholeHours === 0) {
    return `${minutes}min`;
  }
  
  return `${wholeHours}h ${minutes}min`;
}

/**
 * Check if a time is within N hours from now
 */
export function isWithinHours(timestamp: string | Date | undefined, hours: number): boolean {
  if (!timestamp) return false;
  try {
    const date = typeof timestamp === 'string' ? parseISO(timestamp) : timestamp;
    const now = new Date();
    const diffHours = differenceInHours(date, now);
    return diffHours >= 0 && diffHours <= hours;
  } catch {
    return false;
  }
}

/**
 * Get current time formatted for display
 */
export function getCurrentTimeFormatted(): string {
  return formatTime(new Date());
}

/**
 * Get current time in ISO format
 */
export function getCurrentTimeISO(): string {
  return new Date().toISOString();
}
