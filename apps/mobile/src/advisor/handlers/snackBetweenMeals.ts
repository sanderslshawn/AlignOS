/**
 * AlignOS AI Advisor - Snack Containment Handler
 * Addresses snacking between meals
 */

import type { DecisionContext, StructuredAdvice, AdvisorAction } from '../types';
import { format } from 'date-fns';

export function handleSnackBetweenMeals(context: DecisionContext): StructuredAdvice {
  const { profile, currentPlan, currentTime } = context;
  
  const dayMode = profile.defaultDayMode || 'tight';
  
  let directAnswer: string;
  let nextMoves: any[];
  let ifThen: any[];
  let why: string;
  
  if (dayMode === 'tight' || dayMode === 'high-output') {
    // Discourage snacking in tight protocols
    directAnswer = `**Don't snack** between structured meals. Wait for your next scheduled meal.`;
    
    nextMoves = [
      {
        time: 'Now',
        action: 'Drink 16oz water with pinch of salt',
      },
      {
        time: '+15min',
        action: 'Light walk or stretch if hunger persists',
      },
      {
        time: 'Next meal',
        action: 'Eat your scheduled meal at planned time',
      },
    ];
    
    ifThen = [
      {
        condition: 'If genuinely hungry (not bored)',
        action: 'Move next meal 30-45min earlier',
      },
      {
        condition: 'If post-workout within 2 hours',
        action: 'Small protein snack (20g) is acceptable',
      },
    ];
    
    why = 'Maintaining meal spacing preserves insulin sensitivity and metabolic flexibility. Constant eating disrupts fat oxidation between meals.';
    
  } else {
    // Allow strategic snacking in flex modes
    directAnswer = `**Strategic snack okay** if 3+ hours from last meal. Keep it protein-focused and under 200 calories.`;
    
    const snackTime = new Date(currentTime.getTime() + 15 * 60 * 1000);
    
    nextMoves = [
      {
        time: 'Now',
        action: 'Assess: true hunger or craving?',
      },
      {
        time: format(snackTime, 'h:mma'),
        action: 'Small protein snack (Greek yogurt, nuts, jerky)',
        duration: '10min',
      },
      {
        time: 'Next meal',
        action: 'Return to normal schedule',
      },
    ];
    
    ifThen = [
      {
        condition: 'If less than 2 hours from last meal',
        action: 'Wait 30 more minutes—likely thirst or boredom',
      },
      {
        condition: 'If snacking becomes daily',
        action: 'Add 100-150 calories to previous meal',
      },
    ];
    
    why = 'Flexible protocols allow occasional snacks to prevent overcompensation at meals. Protein minimizes insulin impact.';
  }
  
  const actions: AdvisorAction[] = [];

  return {
    directAnswer,
    nextMoves,
    ifThen,
    why,
    actions,
  };
}
