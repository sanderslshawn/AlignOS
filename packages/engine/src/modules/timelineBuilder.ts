import { addMinutes, isBefore, isAfter } from 'date-fns';
import type {
  UserProfile,
  DayState,
  Event,
  ConstraintBlock,
  MealEvent,
  CaffeineEvent,
  WalkEvent,
  ActivationEvent,
} from '@physiology-engine/shared';
import { parseTimeString, generateId } from '@physiology-engine/shared';
import { getFirstMealWindow, adjustFastingForStress } from './fastingWindow';
import { getOptimalCaffeineTimes } from './caffeineTiming';
import { getPostMealWalkWindows, determineWalkHRZone, calculateWalkDuration } from './walkPlacement';
import {
  shouldAddPreWalkActivation,
  shouldAddPreMealActivation,
  getMiddayResetTime,
  getNightRoutineTime,
  getActivationDuration,
} from './activationRoutines';
import { buildComfortMealContainment } from './comfortMealContainment';
import { optimizeSleepWindow, calculateWindDownStart } from './sleepOptimization';

export interface TimelineCandidate {
  events: Event[];
  score: number;
  warnings: string[];
}

export function buildTimeline(profile: UserProfile, dayState: DayState): TimelineCandidate {
  const events: Event[] = [];
  const warnings: string[] = [];
  
  const wakeTime = parseTimeString(profile.wakeTime, dayState.date);
  const sleepTime = parseTimeString(profile.sleepTime, dayState.date);
  
  let firstMealTime = getFirstMealWindow(profile, dayState);
  firstMealTime = adjustFastingForStress(firstMealTime, dayState.stressLevel);
  
  if (isTimeBlocked(firstMealTime, dayState.constraints)) {
    firstMealTime = findNextAvailableSlot(firstMealTime, 60, dayState.constraints);
  }
  
  const mealTimes = generateMealTimes(firstMealTime, sleepTime, dayState.dayMode);
  
  mealTimes.forEach((time, index) => {
    const mealType = selectMealType(index, dayState);
    const meal: MealEvent = {
      type: 'meal',
      time,
      mealType,
    };
    events.push(meal);
    
    if (shouldAddPreMealActivation(dayState.stressLevel, mealType)) {
      const activation: ActivationEvent = {
        type: 'activation',
        time: addMinutes(time, -10),
        activationType: 'pre-meal',
        duration: 3,
      };
      events.push(activation);
    }
  });
  
  const comfortMeals = events.filter(
    (e): e is MealEvent => e.type === 'meal' && e.mealType === 'comfort-meal'
  );
  
  comfortMeals.forEach((comfortMeal) => {
    const nextMealIndex = events.findIndex(
      (e) => e.type === 'meal' && e.time > comfortMeal.time
    );
    const nextMeal = nextMealIndex >= 0 ? (events[nextMealIndex] as MealEvent) : undefined;
    
    const containment = buildComfortMealContainment(comfortMeal, nextMeal);
    warnings.push('Comfort meal detected - containment sequence activated');
  });
  
  const caffeineTimes = getOptimalCaffeineTimes(profile, dayState);
  caffeineTimes.forEach((time) => {
    if (!isTimeBlocked(time, dayState.constraints)) {
      const caffeine: CaffeineEvent = {
        type: 'caffeine',
        time,
        caffeineType: 'coffee',
        amount: 200,
      };
      events.push(caffeine);
    }
  });
  
  const meals = events.filter((e): e is MealEvent => e.type === 'meal');
  const postMealWindows = getPostMealWalkWindows(meals);
  
  postMealWindows.forEach((window) => {
    const walkTime = window.start;
    const duration = calculateWalkDuration(dayState.dayMode, true, 30);
    const walkEnd = addMinutes(walkTime, duration);
    
    // Check if walk would overlap with any constraints
    if (!isTimeBlocked(walkTime, dayState.constraints) && !isTimeBlocked(walkEnd, dayState.constraints)) {
      const hrZone = determineWalkHRZone(profile, dayState, true, walkTime);
      
      const walk: WalkEvent = {
        type: 'walk',
        time: walkTime,
        duration,
        hrZone,
        postMeal: true,
      };
      events.push(walk);
      
      if (shouldAddPreWalkActivation(duration, dayState.dayMode)) {
        const activation: ActivationEvent = {
          type: 'activation',
          time: addMinutes(walkTime, -5),
          activationType: 'pre-walk',
          duration: 5,
        };
        events.push(activation);
      }
    }
  });
  
  const middayTime = getMiddayResetTime(wakeTime, sleepTime);
  if (!isTimeBlocked(middayTime, dayState.constraints)) {
    const activation: ActivationEvent = {
      type: 'activation',
      time: middayTime,
      activationType: 'midday-reset',
      duration: 8,
    };
    events.push(activation);
  }
  
  const { targetSleepTime, warnings: sleepWarnings } = optimizeSleepWindow(profile, dayState, events);
  warnings.push(...sleepWarnings);
  
  const nightRoutineTime = getNightRoutineTime(targetSleepTime);
  const activation: ActivationEvent = {
    type: 'activation',
    time: nightRoutineTime,
    activationType: 'night-routine',
    duration: 10,
  };
  events.push(activation);
  
  events.sort((a, b) => a.time.getTime() - b.time.getTime());
  
  const score = calculateTimelineScore(events, dayState, warnings);
  
  return { events, score, warnings };
}

function generateMealTimes(firstMeal: Date, sleepTime: Date, dayMode: string): Date[] {
  const times: Date[] = [firstMeal];
  
  const mealCount = dayMode === 'high-output' ? 4 : 3;
  const totalMinutes = (sleepTime.getTime() - firstMeal.getTime()) / 60000;
  const spacing = totalMinutes / mealCount;
  
  for (let i = 1; i < mealCount; i++) {
    times.push(addMinutes(firstMeal, spacing * i));
  }
  
  return times;
}

function selectMealType(index: number, dayState: DayState): MealEvent['mealType'] {
  if (dayState.plannedMeals[index]) {
    return dayState.plannedMeals[index].mealType;
  }
  
  if (index === 0) {
    return 'lean-protein';
  }
  
  if (dayState.dayMode === 'recovery') {
    return index === 1 ? 'carb-heavy' : 'lean-protein';
  }
  
  return 'lean-protein';
}

function isTimeBlocked(time: Date, constraints: ConstraintBlock[]): boolean {
  return constraints.some((constraint) => {
    return isAfter(time, constraint.start) && isBefore(time, constraint.end);
  });
}

function findNextAvailableSlot(
  preferredTime: Date,
  durationMinutes: number,
  constraints: ConstraintBlock[]
): Date {
  let candidate = preferredTime;
  
  while (isTimeBlocked(candidate, constraints)) {
    candidate = addMinutes(candidate, 15);
  }
  
  return candidate;
}

function calculateTimelineScore(events: Event[], dayState: DayState, warnings: string[]): number {
  let score = 100;
  
  score -= warnings.length * 5;
  
  const meals = events.filter((e) => e.type === 'meal');
  if (meals.length < 2) score -= 20;
  if (meals.length > 5) score -= 10;
  
  const walks = events.filter((e) => e.type === 'walk');
  if (walks.length === 0) score -= 15;
  
  return Math.max(0, score);
}
