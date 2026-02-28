import { addMinutes, differenceInMinutes } from 'date-fns';
import type { UserProfile, DayState } from '@physiology-engine/shared';
import { parseTimeString } from '@physiology-engine/shared';

export function calculateFastingWindow(profile: UserProfile, dayState: DayState): { start: Date; end: Date } {
  const wakeTime = parseTimeString(profile.wakeTime, dayState.date);
  const targetFastingHours = profile.preferredFastingHours;
  
  const fastingStart = addMinutes(wakeTime, -60 * (targetFastingHours - 8));
  const fastingEnd = addMinutes(wakeTime, 60);
  
  return { start: fastingStart, end: fastingEnd };
}

export function getFirstMealWindow(profile: UserProfile, dayState: DayState): Date {
  const wakeTime = parseTimeString(profile.wakeTime, dayState.date);
  
  if (dayState.dayMode === 'recovery') {
    return addMinutes(wakeTime, 30);
  }
  
  if (profile.preferredFastingHours >= 16) {
    return addMinutes(wakeTime, 60 * 4);
  } else if (profile.preferredFastingHours >= 14) {
    return addMinutes(wakeTime, 60 * 2);
  }
  
  return addMinutes(wakeTime, 60);
}

export function adjustFastingForStress(baseWindow: Date, stressLevel: number): Date {
  if (stressLevel >= 8) {
    return addMinutes(baseWindow, -60);
  }
  if (stressLevel >= 6) {
    return addMinutes(baseWindow, -30);
  }
  return baseWindow;
}
