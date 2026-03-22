/**
 * AlignOS AI Advisor - Workout Timing Handler
 * Provides workout timing based on cortisol and performance windows
 */

import type { DecisionContext, StructuredAdvice, AdvisorAction } from '../types';
import { addHours, format } from 'date-fns';

export function handleWorkoutTiming(context: DecisionContext): StructuredAdvice {
  const { profile, currentTime } = context;
  
  const wakeTime = profile.wakeTime ? parseInt(profile.wakeTime.split(':')[0]) : 7;
  const timePreference = undefined;
  
  let targetTime: Date;
  let directAnswer: string;
  let why: string;
  
  if (timePreference === 'morning' || !timePreference) {
    // Morning workout (optimal for most)
    targetTime = new Date(currentTime);
    targetTime.setHours(wakeTime + 2, 0, 0, 0);
    
    directAnswer = `Train at **${format(targetTime, 'h:mma')}** (2 hours post-wake). This is your cortisol and body temp peak.`;
    why = '2-3 hours post-wake: cortisol peaks naturally, body temperature rises, and nervous system is primed. This timing doesn\'t require stimulants.';
    
  } else if (timePreference === 'afternoon') {
    // Afternoon workout (strength peak)
    targetTime = new Date(currentTime);
    targetTime.setHours(wakeTime + 8, 0, 0, 0);
    
    directAnswer = `Train at **${format(targetTime, 'h:mma')}** (late afternoon). Peak strength and lowest injury risk.`;
    why = 'Late afternoon: maximum muscle activation, joint lubrication, and reaction time. Body temp peaks 4-6pm for most people.';
    
  } else {
    // Evening (last resort)
    targetTime = new Date(currentTime);
    targetTime.setHours(wakeTime + 10, 0, 0, 0);
    
    directAnswer = `Train at **${format(targetTime, 'h:mma')}** (early evening). Keep intensity moderate to avoid sleep disruption.`;
    why = 'Evening workouts can disrupt sleep if too intense. Finish 3+ hours before bed and avoid heavy CNS work.';
  }
  
  const nextMoves = [
    {
      time: format(addHours(targetTime, -0.5), 'h:mma'),
      action: 'Light snack (20-30g carbs) if needed',
      duration: '10min',
    },
    {
      time: format(targetTime, 'h:mma'),
      action: 'Begin training session',
      duration: '45-60min',
    },
    {
      time: format(addHours(targetTime, 1), 'h:mma'),
      action: 'Post-workout meal within 60min',
    },
  ];
  
  const ifThen = [
    {
      condition: 'If fasted (no food 3+ hours)',
      action: 'Take 10g EAAs or small protein shake 15min before',
    },
    {
      condition: 'If training inhibits sleep',
      action: 'Shift to morning or reduce evening intensity',
    },
  ];
  
  const suggestedActivity = {
    type: 'workout' as const,
    title: 'Training Session',
    startISO: targetTime.toISOString(),
    endISO: addHours(targetTime, 1).toISOString(),
    fixed: false,
    isSystemAnchor: false,
    isFixedAnchor: false,
    source: 'user' as const,
    status: 'planned' as const,
    notes: 'Optimal workout timing',
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
