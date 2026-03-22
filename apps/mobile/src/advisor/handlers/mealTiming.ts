/**
 * AlignOS AI Advisor - Meal Timing Handler
 * Provides specific meal timing advice based on circadian rhythms
 */

import type { DecisionContext, StructuredAdvice, AdvisorAction } from '../types';
import { addHours, format } from 'date-fns';

export function handleMealTiming(context: DecisionContext): StructuredAdvice {
  const { profile, currentTime } = context;
  
  const wakeTime = profile.wakeTime ? parseInt(profile.wakeTime.split(':')[0]) : 7;
  const currentHour = currentTime.getHours();
  const hoursAwake = currentHour - wakeTime;
  
  // Calculate optimal meal windows
  const breakfastWindow = new Date(currentTime);
  breakfastWindow.setHours(wakeTime + 1, 0, 0, 0);
  
  const lunchWindow = new Date(currentTime);
  lunchWindow.setHours(wakeTime + 5, 0, 0, 0);
  
  const dinnerWindow = new Date(currentTime);
  dinnerWindow.setHours(wakeTime + 10, 0, 0, 0);
  
  // Determine meal type based on time of day
  let mealType: string;
  if (hoursAwake < 3) {
    mealType = 'breakfast';
  } else if (hoursAwake >= 3 && hoursAwake < 8) {
    mealType = 'lunch';
  } else {
    mealType = 'dinner';
  }
  const specificFood = mealType;
  
  let targetTime: Date;
  let mealWindow: string;
  let directAnswer: string;
  
  if (mealType === 'breakfast') {
    targetTime = breakfastWindow;
    mealWindow = 'within 1-2 hours of waking';
    directAnswer = `Eat ${specificFood} around **${format(targetTime, 'h:mma')}** (${wakeTime + 1}:00).`;
  } else if (mealType === 'lunch') {
    targetTime = lunchWindow;
    mealWindow = '4-6 hours after waking';
    directAnswer = `Eat ${specificFood} around **${format(targetTime, 'h:mma')}** (${wakeTime + 5}:00).`;
  } else {
    targetTime = dinnerWindow;
    mealWindow = '3-4 hours before bed';
    directAnswer = `Eat ${specificFood} around **${format(targetTime, 'h:mma')}** (${wakeTime + 10}:00).`;
  }
  
  const nextMoves = [
    {
      time: format(addHours(targetTime, -0.5), 'h:mma'),
      action: 'Start meal prep or head to location',
      duration: '30min',
    },
    {
      time: format(targetTime, 'h:mma'),
      action: `Eat ${specificFood} (aim for 20-30min)`,
      duration: '25min',
    },
    {
      time: format(addHours(targetTime, 0.5), 'h:mma'),
      action: 'Light walk to aid digestion',
      duration: '10min',
    },
  ];
  
  const ifThen = [
    {
      condition: 'If eating earlier than planned',
      action: 'Push next meal +1 hour to maintain spacing',
    },
    {
      condition: 'If intense workout within 2 hours',
      action: 'Add 20-30g protein to this meal',
    },
  ];
  
  const why = `${mealWindow} aligns with your cortisol curve and digestive enzyme production. This timing maximizes nutrient absorption and energy stability.`;
  
  const suggestedActivity = {
    type: 'meal' as const,
    title: `${mealType.charAt(0).toUpperCase() + mealType.slice(1)}: ${specificFood}`,
    startISO: targetTime.toISOString(),
    endISO: addHours(targetTime, 0.5).toISOString(),
    fixed: false,
    isSystemAnchor: false,
    isFixedAnchor: false,
    source: 'user' as const,
    status: 'planned' as const,
    notes: `Optimal ${mealType} timing`,
  };

  const actions: AdvisorAction[] = [
    {
      id: 'ADD_INSERTS_TO_PLAN',
      label: 'Add to Plan',
      variant: 'primary',
      payload: { inserts: [suggestedActivity] },
    },
  ];

  return {
    directAnswer,
    nextMoves,
    ifThen,
    why,
    actions,
    suggestedActivity,
  };
}
