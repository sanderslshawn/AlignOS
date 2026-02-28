import { addMinutes } from 'date-fns';
import type { MealEvent, WalkEvent, HRZone, UserProfile, DayState } from '@physiology-engine/shared';
import { classifyMeal } from './mealClassification';
import { recommendHRZone } from './hrZoneCalculator';

export function getPostMealWalkWindows(meals: MealEvent[]): Array<{ start: Date; end: Date; mealType: string }> {
  return meals.map((meal) => {
    const properties = classifyMeal(meal.mealType);
    const walkDelay = properties.insulinImpact > 6 ? 15 : 30;
    
    return {
      start: addMinutes(meal.time, walkDelay),
      end: addMinutes(meal.time, 90),
      mealType: meal.mealType,
    };
  });
}

export function determineWalkHRZone(
  profile: UserProfile,
  dayState: DayState,
  postMeal: boolean,
  walkTime: Date
): HRZone {
  // Determine time of day
  const hour = walkTime.getHours();
  let timeOfDay: 'morning' | 'midday' | 'afternoon' | 'evening';
  if (hour < 10) timeOfDay = 'morning';
  else if (hour < 14) timeOfDay = 'midday';
  else if (hour < 18) timeOfDay = 'afternoon';
  else timeOfDay = 'evening';

  return recommendHRZone(profile, dayState, postMeal, timeOfDay);
}

export function calculateWalkDuration(
  dayMode: string,
  postMeal: boolean,
  availableMinutes: number
): number {
  let targetDuration = 20;
  
  if (postMeal) {
    targetDuration = 15;
  } else if (dayMode === 'high-output') {
    targetDuration = 30;
  } else if (dayMode === 'recovery') {
    targetDuration = 25;
  }
  
  return Math.min(targetDuration, availableMinutes);
}

export function shouldAddWalkAfterCaffeine(
  caffeineTime: Date,
  nextMealTime?: Date
): boolean {
  if (!nextMealTime) return false;
  
  const timeDiff = (nextMealTime.getTime() - caffeineTime.getTime()) / 60000;
  
  return timeDiff > 45;
}
