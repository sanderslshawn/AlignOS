/**
 * AlignOS Advisor - Comfort Meal Handler
 * Provides structured timing for treats (pudding, ice cream, desserts)
 */

import { format, addHours, addMinutes } from 'date-fns';
import type { DecisionContext, AdvisorResponse, AdvisorInsert, AdvisorAction } from '../types';

export function handleComfortMeal(context: DecisionContext): AdvisorResponse {
  const { profile, currentPlan, currentTime } = context;

  // Parse bedtime
  const sleepTime = profile.sleepTime || '22:00';
  const [sleepHour] = sleepTime.split(':').map(Number);
  const bedtime = new Date(currentTime);
  bedtime.setHours(sleepHour, 0, 0, 0);
  if (bedtime < currentTime) {
    bedtime.setDate(bedtime.getDate() + 1);
  }

  // Find next protein meal in schedule
  const now = currentTime;
  const nextProteinMeal = currentPlan?.items.find(
    item => item.type === 'meal' && new Date(item.startISO) > now
  );

  // Calculate treat window: 2-3 hours after next protein meal, at least 2 hours before bed
  let treatWindowStart: Date;
  let treatWindowEnd: Date;

  if (nextProteinMeal) {
    const mealEnd = new Date(nextProteinMeal.endISO);
    treatWindowStart = addHours(mealEnd, 2);
    treatWindowEnd = addHours(mealEnd, 3);
  } else {
    // Default: 2-3 hours from now
    treatWindowStart = addHours(now, 2);
    treatWindowEnd = addHours(now, 3);
  }

  // Ensure at least 2 hours before bed
  const twoHoursBeforeBed = addHours(bedtime, -2);
  if (treatWindowEnd > twoHoursBeforeBed) {
    treatWindowEnd = twoHoursBeforeBed;
    treatWindowStart = addHours(treatWindowEnd, -1);
  }

  // If window is in the past or too narrow, suggest tomorrow
  const isValidWindow = treatWindowStart > now && (treatWindowEnd.getTime() - treatWindowStart.getTime()) > 30 * 60 * 1000;

  const directAnswer = isValidWindow
    ? `Optimal treat window: ${format(treatWindowStart, 'h:mma')}–${format(treatWindowEnd, 'h:mma')} (after protein digestion, before sleep disruption)`
    : `Too close to bedtime. Try tomorrow afternoon after a protein meal.`;

  const nextMoves = isValidWindow
    ? [
        {
          time: nextProteinMeal ? format(new Date(nextProteinMeal.startISO), 'h:mma') : format(addHours(now, 0.5), 'h:mma'),
          action: 'Eat protein-first meal',
          duration: '20-30min',
        },
        {
          time: format(treatWindowStart, 'h:mma'),
          action: 'Treat window opens',
          duration: '60min',
        },
        {
          time: format(addMinutes(treatWindowStart, 15), 'h:mma'),
          action: 'Light movement',
          duration: '10-15min',
        },
      ]
    : [
        {
          time: format(addHours(now, 12), 'h:mma'),
          action: 'Tomorrow: protein meal',
          duration: '30min',
        },
        {
          time: format(addHours(now, 14), 'h:mma'),
          action: 'Treat window',
          duration: '60min',
        },
        {
          time: format(addHours(now, 14.5), 'h:mma'),
          action: 'Post-treat walk',
          duration: '10min',
        },
      ];

  const ifThen = [
    {
      condition: 'If craving hits now',
      action: 'Drink 16oz water, wait 15min, reassess hunger vs. habit',
    },
    {
      condition: 'If treating on empty stomach',
      action: 'Risk blood sugar crash — eat protein first, then treat',
    },
  ];

  const why = `Treats spike glucose and insulin. Timing after protein meals + distance from sleep minimizes metabolic disruption and preserves REM quality.`;

  // Create insert for treat window
  const inserts: AdvisorInsert[] = isValidWindow
    ? [
        {
          type: 'break',
          title: 'Treat Window',
          startISO: treatWindowStart.toISOString(),
          endISO: treatWindowEnd.toISOString(),
          fixed: false,
          source: 'user',
          notes: 'Comfort meal window after protein digestion',
        },
      ]
    : [];

  const actions: AdvisorAction[] = isValidWindow
    ? [
        {
          id: 'ADD_INSERTS_TO_PLAN',
          label: 'Add to Plan',
          variant: 'primary',
          payload: { inserts },
        },
        {
          id: 'INSERT_WALK_15',
          label: 'Insert Post-Treat Walk',
          variant: 'secondary',
        },
      ]
    : [];

  return {
    intent: {
      type: 'comfort_meal',
      confidence: 0.95,
      entities: {},
    },
    advice: {
      directAnswer,
      inserts,
      nextMoves,
      ifThen,
      why,
      actions,
    },
  };
}
