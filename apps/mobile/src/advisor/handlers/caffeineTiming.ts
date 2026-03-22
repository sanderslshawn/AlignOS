/**
 * AlignOS AI Advisor - Caffeine Timing Handler
 * Strategic caffeine use based on adenosine and cortisol
 */

import type { DecisionContext, StructuredAdvice, AdvisorAction } from '../types';
import { addHours, format } from 'date-fns';

export function handleCaffeineTiming(context: DecisionContext): StructuredAdvice {
  const { profile, currentTime } = context;
  
  const wakeTime = profile.wakeTime ? parseInt(profile.wakeTime.split(':')[0]) : 7;
  const sleepTime = profile.sleepTime ? parseInt(profile.sleepTime.split(':')[0]) : 23;
  const currentHour = currentTime.getHours();
  
  // Optimal caffeine window: 90-120 min post-wake
  const optimalTime = new Date(currentTime);
  optimalTime.setHours(wakeTime + 1.5, 30, 0, 0);
  
  const caffeineDeadline = new Date(currentTime);
  caffeineDeadline.setHours(sleepTime - 8, 0, 0, 0); // 8 hours before bed
  
  let directAnswer: string;
  let why: string;
  
  if (currentHour < wakeTime + 1) {
    directAnswer = `**Wait 90 minutes** after waking. Drink coffee at **${format(optimalTime, 'h:mma')}**.`;
    why = 'Cortisol peaks naturally upon waking. Caffeine now blocks this and creates tolerance. Wait 90min for adenosine to build.';
  } else if (currentHour >= sleepTime - 8) {
    directAnswer = `**Too late** for caffeine. Cutoff was **${format(caffeineDeadline, 'h:mma')}**. It will disrupt sleep.`;
    why = 'Caffeine has an 8-hour half-life. Evening caffeine fragments REM and deep sleep even if you "fall asleep fine."';
  } else {
    directAnswer = `Drink coffee **now** (${format(currentTime, 'h:mma')}). Last caffeine by **${format(caffeineDeadline, 'h:mma')}**.`;
    why = 'You\'re in the safe window: past cortisol peak and 8+ hours before bed. This maximizes alertness without sleep disruption.';
  }
  
  const nextMoves = [
    {
      time: format(optimalTime, 'h:mma'),
      action: 'First coffee (100-200mg caffeine)',
      duration: '15min',
    },
    {
      time: format(addHours(optimalTime, 4), 'h:mma'),
      action: 'Optional: second coffee if needed (before cutoff)',
    },
    {
      time: format(caffeineDeadline, 'h:mma'),
      action: 'Absolute caffeine cutoff—no exceptions',
    },
  ];
  
  const ifThen = [
    {
      condition: 'If afternoon energy dip at 2-3pm',
      action: 'Take 10min walk + sunlight instead of coffee',
    },
    {
      condition: 'If sleep quality is poor',
      action: 'Move cutoff to 10 hours before bed',
    },
  ];
  
  const actions: AdvisorAction[] = [];

  return {
    directAnswer,
    nextMoves,
    ifThen,
    why,
    actions,
  };
}
