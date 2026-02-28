import { addMinutes, differenceInMinutes } from 'date-fns';
import type { DayState, UserProfile } from '@physiology-engine/shared';
import { parseTimeString } from '@physiology-engine/shared';

export function shouldAllowCaffeine(
  currentTime: Date,
  profile: UserProfile,
  dayState: DayState,
  lastCaffeineTime?: Date
): boolean {
  const sleepTime = parseTimeString(profile.sleepTime, dayState.date);
  const cutoffTime = addMinutes(sleepTime, -8 * 60);
  
  if (currentTime >= cutoffTime) {
    return false;
  }
  
  if (lastCaffeineTime) {
    const timeSinceLastCaffeine = differenceInMinutes(currentTime, lastCaffeineTime);
    const minSpacing = profile.caffeineToleranceLow ? 180 : 120;
    
    if (timeSinceLastCaffeine < minSpacing) {
      return false;
    }
  }
  
  return true;
}

export function adjustCaffeineForStress(baseTime: Date, stressLevel: number): Date {
  if (stressLevel >= 8) {
    return addMinutes(baseTime, 60);
  }
  if (stressLevel >= 6) {
    return addMinutes(baseTime, 30);
  }
  return baseTime;
}

export function adjustCaffeineForHR(baseTime: Date, currentHR?: number, restingHR?: number): Date {
  if (!currentHR || !restingHR) return baseTime;
  
  const hrElevation = currentHR - restingHR;
  
  if (hrElevation > 20) {
    return addMinutes(baseTime, 60);
  }
  if (hrElevation > 10) {
    return addMinutes(baseTime, 30);
  }
  
  return baseTime;
}

export function getOptimalCaffeineTimes(
  profile: UserProfile,
  dayState: DayState
): Date[] {
  const wakeTime = parseTimeString(profile.wakeTime, dayState.date);
  const sleepTime = parseTimeString(profile.sleepTime, dayState.date);
  const cutoffTime = addMinutes(sleepTime, -8 * 60);
  
  const times: Date[] = [];
  
  const morningCaffeine = addMinutes(wakeTime, 90);
  if (morningCaffeine < cutoffTime) {
    times.push(morningCaffeine);
  }
  
  if (dayState.dayMode === 'high-output' || dayState.dayMode === 'tight') {
    const midMorning = addMinutes(wakeTime, 240);
    if (midMorning < cutoffTime) {
      times.push(midMorning);
    }
    
    const afternoon = addMinutes(wakeTime, 420);
    if (afternoon < cutoffTime && !profile.caffeineToleranceLow) {
      times.push(afternoon);
    }
  } else {
    const midDay = addMinutes(wakeTime, 300);
    if (midDay < cutoffTime) {
      times.push(midDay);
    }
  }
  
  return times;
}
