import { addMinutes, differenceInMinutes } from 'date-fns';
import type { UserProfile, DayState, Event } from '@physiology-engine/shared';
import { parseTimeString } from '@physiology-engine/shared';

export function optimizeSleepWindow(
  profile: UserProfile,
  dayState: DayState,
  plannedEvents: Event[]
): { targetSleepTime: Date; warnings: string[] } {
  const warnings: string[] = [];
  const baseSleepTime = parseTimeString(profile.sleepTime, dayState.date);
  let targetSleepTime = baseSleepTime;
  
  if (dayState.sleepQuality <= 5) {
    targetSleepTime = addMinutes(baseSleepTime, -30);
    warnings.push('Poor sleep quality detected - moving bedtime earlier');
  }
  
  if (dayState.stressLevel >= 8) {
    targetSleepTime = addMinutes(targetSleepTime, -15);
    warnings.push('High stress - additional 15 min sleep buffer added');
  }
  
  const lastCaffeine = plannedEvents
    .filter((e) => e.type === 'caffeine')
    .sort((a, b) => b.time.getTime() - a.time.getTime())[0];
  
  if (lastCaffeine) {
    const timeDiff = differenceInMinutes(targetSleepTime, lastCaffeine.time);
    if (timeDiff < 480) {
      warnings.push('Last caffeine too close to bedtime - may affect sleep');
    }
  }
  
  return { targetSleepTime, warnings };
}

export function calculateWindDownStart(sleepTime: Date, stressLevel: number): Date {
  const baseWindDown = 60;
  const stressAdjustment = stressLevel >= 7 ? 30 : 0;
  
  return addMinutes(sleepTime, -(baseWindDown + stressAdjustment));
}

export function shouldAddNightRoutine(sleepQuality: number, stressLevel: number): boolean {
  return sleepQuality <= 6 || stressLevel >= 6;
}
