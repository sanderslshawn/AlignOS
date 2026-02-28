import { format, parse, addMinutes, differenceInMinutes, isBefore, isAfter } from 'date-fns';

export function parseTimeString(timeStr: string, date: Date): Date {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const result = new Date(date);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

export function formatTime(date: Date): string {
  return format(date, 'HH:mm');
}

export function formatDateTime(date: Date): string {
  return format(date, 'MMM dd, HH:mm');
}

export function addMinutesToDate(date: Date, minutes: number): Date {
  return addMinutes(date, minutes);
}

export function getMinutesBetween(start: Date, end: Date): number {
  return differenceInMinutes(end, start);
}

export function isTimeBefore(time1: Date, time2: Date): boolean {
  return isBefore(time1, time2);
}

export function isTimeAfter(time1: Date, time2: Date): boolean {
  return isAfter(time1, time2);
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
