import { addMinutes } from 'date-fns';
import type { MealEvent, Event } from '@physiology-engine/shared';

export interface ComfortMealSequence {
  preMealActivation: Date;
  comfortMeal: Date;
  postMealWalk: Date;
  recoveryWindow: Date;
  nextMealAdjustment: string;
}

export function buildComfortMealContainment(
  comfortMeal: MealEvent,
  nextMeal?: MealEvent
): ComfortMealSequence {
  const preMealActivation = addMinutes(comfortMeal.time, -10);
  const postMealWalk = addMinutes(comfortMeal.time, 20);
  const recoveryWindow = addMinutes(comfortMeal.time, 90);
  
  let nextMealAdjustment = 'no change';
  
  if (nextMeal) {
    const timeDiff = (nextMeal.time.getTime() - comfortMeal.time.getTime()) / 60000;
    
    if (timeDiff < 240) {
      nextMealAdjustment = 'delay by 30 minutes, choose lean protein';
    } else if (timeDiff < 300) {
      nextMealAdjustment = 'keep timing, choose lean protein';
    }
  }
  
  return {
    preMealActivation,
    comfortMeal: comfortMeal.time,
    postMealWalk,
    recoveryWindow,
    nextMealAdjustment,
  };
}

export function protectNext3Moves(comfortMealTime: Date): Array<{ time: Date; type: string; reasoning: string }> {
  return [
    {
      time: addMinutes(comfortMealTime, 20),
      type: 'walk',
      reasoning: 'Post-comfort meal walk helps with digestion and insulin response',
    },
    {
      time: addMinutes(comfortMealTime, 120),
      type: 'hydration',
      reasoning: 'Rehydrate after higher inflammation meal',
    },
    {
      time: addMinutes(comfortMealTime, 240),
      type: 'meal',
      reasoning: 'Return to lean protein to restore metabolic structure',
    },
  ];
}

export function generateComfortMealReasoning(): string {
  return 'Comfort meal contained with activation, walk, and structured recovery. Next meal adjusted to lean protein.';
}
