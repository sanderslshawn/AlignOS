/**
 * AlignOS AI Advisor - Response Generator
 * 
 * Context-aware response generation using structured knowledge base.
 * Maintains tone, structure, and guardrails per AlignOS philosophy.
 */

import { format, addMinutes, differenceInMinutes, isWithinInterval } from 'date-fns';
import type { UserProfile, DayPlan, ScheduleItem } from '@physiology-engine/shared';
import { KNOWLEDGE_BASE, getRelevantKnowledge, type KnowledgeDomain } from './knowledgeBase';

export interface AdvisorContext {
  query: string;
  profile: UserProfile;
  currentPlan?: DayPlan;
  currentTime: Date;
  sleepScore?: number;
  stressLevel?: 'low' | 'medium' | 'high';
  lastMealTime?: Date;
  lastMealType?: string;
  nextWorkout?: ScheduleItem;
  heartRate?: number;
}

export interface AdvisorResponse {
  explanation: string;
  action: string;
  integration?: string;
  reasoning: string[];
  confidence: 'high' | 'medium' | 'low';
  domains: KnowledgeDomain[];
}

/**
 * Main entry point - generates context-aware responses
 */
export function generateResponse(context: AdvisorContext): AdvisorResponse {
  const { query } = context;
  const lowerQuery = query.toLowerCase();

  // Route to specialized handlers
  if (matchesMealQuery(lowerQuery)) {
    return generateMealResponse(context);
  }
  
  if (matchesWorkoutQuery(lowerQuery)) {
    return generateWorkoutResponse(context);
  }
  
  if (matchesEnergyQuery(lowerQuery)) {
    return generateEnergyResponse(context);
  }
  
  if (matchesSleepQuery(lowerQuery)) {
    return generateSleepResponse(context);
  }
  
  if (matchesCaffeineQuery(lowerQuery)) {
    return generateCaffeineResponse(context);
  }
  
  if (matchesTimingQuery(lowerQuery)) {
    return generateTimingResponse(context);
  }
  
  // Default: general optimization
  return generateGeneralResponse(context);
}

// ========================================
// QUERY MATCHERS
// ========================================

function matchesMealQuery(query: string): boolean {
  const keywords = ['eat', 'meal', 'food', 'breakfast', 'lunch', 'dinner', 'snack', 'hungry', 'chicken', 'beef', 'fish', 'carbs', 'protein'];
  return keywords.some(kw => query.includes(kw));
}

function matchesWorkoutQuery(query: string): boolean {
  const keywords = ['workout', 'train', 'exercise', 'gym', 'lift', 'strength', 'cardio', 'run'];
  return keywords.some(kw => query.includes(kw));
}

function matchesEnergyQuery(query: string): boolean {
  const keywords = ['tired', 'energy', 'fatigue', 'alert', 'awake', 'crash', 'sluggish'];
  return keywords.some(kw => query.includes(kw));
}

function matchesSleepQuery(query: string): boolean {
  const keywords = ['sleep', 'bed', 'rest', 'insomnia', 'wake up', 'can\'t sleep'];
  return keywords.some(kw => query.includes(kw));
}

function matchesCaffeineQuery(query: string): boolean {
  const keywords = ['caffeine', 'coffee', 'tea', 'espresso', 'energy drink'];
  return keywords.some(kw => query.includes(kw));
}

function matchesTimingQuery(query: string): boolean {
  return query.includes('when') || query.includes('what time') || query.includes('timing');
}

// ========================================
// MEAL RESPONSE GENERATOR
// ========================================

function generateMealResponse(context: AdvisorContext): AdvisorResponse {
  const { query, profile, currentTime, currentPlan, stressLevel, lastMealTime } = context;
  const lowerQuery = query.toLowerCase();
  
  const goal = profile.fitnessGoal || 'GENERAL_HEALTH';
  const knowledge = getRelevantKnowledge(['meal_timing', 'circadian'], ['fitness_goal', 'meal_composition', 'current_time']);
  
  const reasoning: string[] = [];
  let explanation = '';
  let action = '';
  let integration = '';
  
  // Determine meal composition hints
  const isHighProtein = /chicken|steak|beef|fish|protein|meat/.test(lowerQuery);
  const isHighCarb = /pasta|rice|bread|carbs|potato|pizza/.test(lowerQuery);
  const isHighFat = /burger|fried|pizza|dessert|fatty/.test(lowerQuery);
  
  const currentHour = currentTime.getHours();
  const meals = currentPlan?.items.filter(i => i.type === 'meal') || [];
  const nextWorkout = currentPlan?.items.find(i => i.type === 'workout' && new Date(i.startISO) > currentTime);
  
  // Calculate time since last meal
  const hoursSinceLastMeal = lastMealTime ? differenceInMinutes(currentTime, lastMealTime) / 60 : null;
  
  // MEAL TIMING LOGIC
  if (goal === 'FAT_LOSS' || goal === 'WEIGHT_LOSS') {
    explanation = 'For fat loss goals, meal timing affects insulin sensitivity and fat oxidation throughout the day.';
    
    if (isHighCarb || isHighFat) {
      if (currentHour < 12) {
        action = 'Eat this now or within the next hour. Morning is optimal for higher-calorie meals.';
        reasoning.push('Insulin sensitivity peaks in morning hours');
        reasoning.push('Calories consumed early are more likely used for energy vs storage');
        integration = 'Add to your schedule between ' + format(currentTime, 'h:mm a') + ' and ' + format(addMinutes(currentTime, 90), 'h:mm a');
      } else if (currentHour < 15) {
        action = 'You can eat this now, but limit portion size. Afternoon carbs/fats are less optimal.';
        reasoning.push('Insulin sensitivity declining in afternoon');
        reasoning.push('If workout pending, eat 2+ hours before for better fat oxidation');
      } else {
        action = 'For fat loss, save this meal for tomorrow morning (before noon).';
        reasoning.push('Evening high-calorie meals impair overnight fat burning');
        reasoning.push('Late insulin spikes disrupt sleep quality');
        integration = 'Schedule for tomorrow between 10 AM - 12 PM instead';
      }
    } else if (isHighProtein) {
      action = 'High-protein meals support fat loss at any time. Eat within the next 30-60 minutes.';
      reasoning.push('Protein has minimal insulin response');
      reasoning.push('High thermic effect of protein increases metabolism');
      reasoning.push('Protein maintains muscle during calorie deficit');
      
      if (nextWorkout) {
        const minsToWorkout = differenceInMinutes(new Date(nextWorkout.startISO), currentTime);
        if (minsToWorkout > 60 && minsToWorkout < 180) {
          integration = `Optimal: eat 90 min before your ${format(new Date(nextWorkout.startISO), 'h:mm a')} workout`;
        }
      }
    }
    
  } else if (goal === 'MUSCLE_GAIN') {
    explanation = 'For muscle gain, prioritize protein timing around training and consistent intake throughout the day.';
    
    if (nextWorkout) {
      const minsToWorkout = differenceInMinutes(new Date(nextWorkout.startISO), currentTime);
      
      if (isHighProtein) {
        if (minsToWorkout > 90 && minsToWorkout < 180) {
          action = `Eat 60-90 minutes before your ${format(new Date(nextWorkout.startISO), 'h:mm a')} workout.`;
          reasoning.push('Pre-workout protein prevents muscle breakdown');
          reasoning.push('Allows time for digestion before training');
          integration = `Schedule at ${format(addMinutes(new Date(nextWorkout.startISO), -90), 'h:mm a')}`;
        } else if (minsToWorkout <= 60) {
          action = 'Too close to training. Wait and eat immediately post-workout instead.';
          reasoning.push('Eating too close impairs performance');
          reasoning.push('Post-workout protein (within 30 min) maximizes muscle protein synthesis');
          integration = `Schedule at ${format(addMinutes(new Date(nextWorkout.endISO || nextWorkout.startISO), 15), 'h:mm a')}`;
        } else {
          action = 'Eat now to maintain consistent protein intake.';
          reasoning.push('Muscle protein synthesis elevated for 3-4 hours post-meal');
          reasoning.push('Consistency matters more than specific timing without workout');
        }
      } else if (isHighCarb) {
        if (minsToWorkout > 90 && minsToWorkout < 240) {
          action = `Eat carbs 90-120 min before ${format(new Date(nextWorkout.startISO), 'h:mm a')} training.`;
          reasoning.push('Pre-workout carbs maximize muscle glycogen');
          reasoning.push('Timing allows digestion while ensuring energy availability');
          integration = `Optimal timing: ${format(addMinutes(new Date(nextWorkout.startISO), -120), 'h:mm a')}`;
        } else {
          action = 'Save carbs for post-workout. Eat immediately after training.';
          reasoning.push('Post-workout carbs replenish glycogen and spike anabolic insulin');
          reasoning.push('The post-workout window is real for glycogen restocking');
        }
      }
    } else {
      action = 'No workout today. Focus on eating protein every 3-4 hours.';
      reasoning.push('Elevated muscle protein synthesis requires consistent protein intake');
      reasoning.push('Space meals 3-4 hours apart for optimal absorption');
    }
    
  } else {
    explanation = 'For general health, focus on meal timing aligned with your circadian rhythm.';
    action = 'Eat when hungry, but respect 3-4 hour spacing between meals.';
    reasoning.push('Allow insulin to return to baseline between meals');
    reasoning.push('Avoid late meals (3+ hours before sleep)');
    reasoning.push('Front-load calories: breakfast > lunch > dinner');
  }
  
  // Check meal spacing
  if (hoursSinceLastMeal !== null && hoursSinceLastMeal < 3) {
    action = `Wait ${Math.ceil((3 - hoursSinceLastMeal) * 60)} more minutes. You ate ${Math.floor(hoursSinceLastMeal * 60)} min ago.`;
    reasoning.unshift('Optimal meal spacing is 3-4 hours');
    reasoning.unshift('Insulin must return to baseline for metabolic flexibility');
  }
  
  return {
    explanation,
    action,
    integration: integration || undefined,
    reasoning,
    confidence: 'high',
    domains: ['meal_timing', 'circadian'],
  };
}

// ========================================
// WORKOUT RESPONSE GENERATOR
// ========================================

function generateWorkoutResponse(context: AdvisorContext): AdvisorResponse {
  const { profile, currentTime, currentPlan, sleepScore, stressLevel, lastMealTime } = context;
  
  const reasoning: string[] = [];
  const currentHour = currentTime.getHours();
  const hoursSinceWake = currentHour - new Date(profile.wakeTime).getHours();
  
  let explanation = 'Training timing affects performance, recovery, and circadian alignment.';
  let action = '';
  let integration = '';
  
  // Check sleep quality
  if (sleepScore && sleepScore < 60) {
    explanation = 'Your sleep score is low. Training quality and recovery will be impaired.';
    action = 'Reduce intensity today. Focus on light movement or mobility work instead.';
    reasoning.push('Poor sleep reduces muscle protein synthesis');
    reasoning.push('Insufficient recovery increases injury risk');
    reasoning.push('Light activity supports recovery better than intense training');
    return {
      explanation,
      action,
      reasoning,
      confidence: 'high',
      domains: ['movement', 'sleep'],
    };
  }
  
  // Optimal training window: 3-6 hours post-wake
  if (hoursSinceWake >= 3 && hoursSinceWake <= 6) {
    action = 'Now is optimal. Body temperature and muscle activation peak 3-6 hours post-wake.';
    reasoning.push('Core temperature elevated = better performance');
    reasoning.push('Neuromuscular system fully online');
    reasoning.push('Hormone profile supports training (cortisol + testosterone peak)');
    integration = `Schedule workout at ${format(currentTime, 'h:mm a')}`;
  } else if (hoursSinceWake < 3) {
    const optimalTime = addMinutes(new Date(profile.wakeTime), 3 * 60);
    action = `Wait until ${format(optimalTime, 'h:mm a')} for peak performance.`;
    reasoning.push('Training too early risks injury (body not warmed up)');
    reasoning.push('Cortisol still peaking - let it stabilize first');
    integration = `Schedule at ${format(optimalTime, 'h:mm a')} or later`;
  } else if (hoursSinceWake > 10) {
    action = 'Training now may impact sleep. Reduce intensity or reschedule to morning.';
    reasoning.push('Evening training elevates cortisol');
    reasoning.push('Hard training within 4 hours of sleep delays sleep onset');
    reasoning.push('If you must train now: keep intensity moderate and protein post-workout');
  } else {
    action = 'Good timing window. Train within the next 1-2 hours.';
    reasoning.push('Afternoon performance is solid for most people');
    reasoning.push('Allows pre-workout meal digestion (eat 90 min before)');
  }
  
  // Check if they've eaten recently
  if (lastMealTime) {
    const minsSinceFood = differenceInMinutes(currentTime, lastMealTime);
    if (minsSinceFood < 60) {
      action = `Wait ${60 - minsSinceFood} more minutes before training. Food needs time to digest.`;
      reasoning.push('Training on full stomach reduces performance');
      reasoning.push('Blood diverted to digestion instead of muscles');
    } else if (minsSinceFood > 240) {
      action = 'Eat a small protein + carb meal before training. You last ate over 4 hours ago.';
      reasoning.push('Fasted training reduces performance for strength work');
      reasoning.push('20-30g protein + 30-40g carbs ideal');
    }
  }
  
  return {
    explanation,
    action,
    integration: integration || undefined,
    reasoning,
    confidence: 'high',
    domains: ['movement', 'circadian'],
  };
}

// ========================================
// ENERGY RESPONSE GENERATOR
// ========================================

function generateEnergyResponse(context: AdvisorContext): AdvisorResponse {
  const { query, currentTime, profile, sleepScore, stressLevel, lastMealTime } = context;
  const lowerQuery = query.toLowerCase();
  
  const reasoning: string[] = [];
  const currentHour = currentTime.getHours();
  const hoursSinceWake = currentHour - new Date(profile.wakeTime).getHours();
  
  let explanation = '';
  let action = '';
  let integration = '';
  
  // Afternoon dip (2-4 PM / 7-9 hours post-wake)
  if (hoursSinceWake >= 7 && hoursSinceWake <= 9) {
    explanation = 'You\'re experiencing the natural circadian dip. This happens 7-9 hours post-wake due to adenosine buildup and potential post-lunch glucose drop.';
    action = 'Take a 10-15 minute walk or do light stretching. Avoid caffeine if past 2 PM.';
    reasoning.push('Light movement clears adenosine and restores alertness');
    reasoning.push('Walking improves cerebral blood flow');
    reasoning.push('Caffeine after 2 PM impacts sleep onset');
    integration = 'Add a 15-min walk to your schedule now';
    
  } else if (sleepScore && sleepScore < 60) {
    explanation = 'Low sleep quality is driving your fatigue. No amount of caffeine or food timing will fully compensate.';
    action = 'Prioritize sleep tonight. Reduce demands today and avoid afternoon caffeine.';
    reasoning.push('Sleep debt compounds - must be repaid');
    reasoning.push('Cognitive performance drops 20-30% when sleep-deprived');
    reasoning.push('Focus on sleep hygiene: dark room, consistent timing');
    
  } else if (lastMealTime) {
    const minsSinceFood = differenceInMinutes(currentTime, lastMealTime);
    
    if (minsSinceFood < 45) {
      explanation = 'Post-meal energy dip is normal. Blood flow diverted to digestion causes temporary fatigue.';
      action = 'Wait 30 more minutes, then take a 10-min walk. Avoid heavy carbs at next meal.';
      reasoning.push('Post-meal dip peaks 20-40 min after eating');
      reasoning.push('High-carb meals cause larger glucose swings = more fatigue');
      reasoning.push('Walking post-meal improves glucose clearance');
      
    } else if (minsSinceFood > 240) {
      explanation = 'You haven\'t eaten in over 4 hours. Low glucose may be causing fatigue.';
      action = 'Eat a protein-dominant meal now (protein + fat, minimal carbs).';
      reasoning.push('Stable protein + fat = stable energy');
      reasoning.push('Avoid solo carbs - they\'ll crash you in 90 min');
      reasoning.push('Hydrate as well - dehydration mimics low energy');
    }
  } else {
    explanation = 'Energy crashes usually stem from sleep debt, poor meal timing, or circadian misalignment.';
    action = 'Check: sleep quality, last meal timing, and hydration. Walk for 10 minutes now.';
    reasoning.push('Most common causes: insufficient sleep, caffeine mistiming, glucose variability');
    reasoning.push('Light movement is the fastest non-pharmaceutical energy boost');
  }
  
  return {
    explanation,
    action,
    integration: integration || undefined,
    reasoning,
    confidence: 'high',
    domains: ['energy', 'circadian', 'meal_timing'],
  };
}

// ========================================
// SLEEP RESPONSE GENERATOR
// ========================================

function generateSleepResponse(context: AdvisorContext): AdvisorResponse {
  const { query, currentTime, profile, lastMealTime, stressLevel } = context;
  const lowerQuery = query.toLowerCase();
  
  const reasoning: string[] = [];
  const sleepTime = new Date(profile.sleepTime);
  const hoursUntilSleep = differenceInMinutes(sleepTime, currentTime) / 60;
  
  let explanation = '';
  let action = '';
  
  if (lowerQuery.includes('can\'t sleep') || lowerQuery.includes('insomnia')) {
    explanation = 'Sleep disruption usually stems from late meals, screen time, or elevated cortisol.';
    
    if (lastMealTime) {
      const hoursSinceFood = differenceInMinutes(currentTime, lastMealTime) / 60;
      if (hoursSinceFood < 3) {
        action = 'Your meal was too close to sleep. Digestion is preventing deep sleep.';
        reasoning.push('Last meal should be 3-4 hours before sleep');
        reasoning.push('Late meals delay melatonin onset and raise cortisol');
      }
    }
    
    action = action || 'Wind down protocol: dim lights now, no screens for 60 min, room temp to 65-68°F.';
    reasoning.push('Blue light suppresses melatonin for 1-2 hours');
    reasoning.push('Core body temp must drop 2-3°F for sleep onset');
    reasoning.push('Warm shower 90 min before sleep facilitates cooling');
    
  } else if (hoursUntilSleep <= 3 && hoursUntilSleep > 0) {
    explanation = 'You\'re approaching your sleep window. Begin wind-down protocol now.';
    action = 'Dim lights, stop screen time in 60 min, last meal should be done.';
    reasoning.push('Melatonin onset begins 2-3 hours pre-sleep');
    reasoning.push('Environment prep is crucial: dark, cool, quiet');
    reasoning.push('Consistency matters - same bedtime trains circadian rhythm');
    
  } else {
    explanation = 'Sleep quality depends on daytime behavior: caffeine timing, light exposure, meal timing, and stress.';
    action = 'Optimize: last caffeine by 2 PM, last meal 3+ hours before sleep, morning light exposure.';
    reasoning.push('Caffeine has 5-6 hour half-life');
    reasoning.push('Morning light anchors circadian rhythm');
    reasoning.push('Evening routine consistency > any single optimization');
  }
  
  return {
    explanation,
    action,
    reasoning,
    confidence: 'high',
    domains: ['sleep', 'circadian'],
  };
}

// ========================================
// CAFFEINE RESPONSE GENERATOR
// ========================================

function generateCaffeineResponse(context: AdvisorContext): AdvisorResponse {
  const { currentTime, profile, stressLevel, sleepScore } = context;
  
  const reasoning: string[] = [];
  const currentHour = currentTime.getHours();
  const hoursSinceWake = currentHour - new Date(profile.wakeTime).getHours();
  const sleepTime = new Date(profile.sleepTime);
  const hoursUntilSleep = differenceInMinutes(sleepTime, currentTime) / 60;
  
  let explanation = 'Caffeine blocks adenosine (sleep pressure) and has a 5-6 hour half-life.';
  let action = '';
  
  // Check if too early
  if (hoursSinceWake < 1.5) {
    action = `Wait until ${format(addMinutes(new Date(profile.wakeTime), 90), 'h:mm a')} for first caffeine.`;
    reasoning.push('Caffeine too early blunts natural cortisol awakening response');
    reasoning.push('Let cortisol peak naturally 30-60 min post-wake');
    reasoning.push('Delaying caffeine makes it more effective');
    
  } else if (hoursUntilSleep < 8) {
    action = 'Too late for caffeine. It will impact sleep onset even if you don\'t feel it.';
    reasoning.push('Half-life is 5-6 hours, but quarter-life extends to bedtime');
    reasoning.push('Even "used to it" people show sleep architecture disruption');
    reasoning.push('Opt for movement or cold water instead');
    
  } else if (stressLevel === 'high') {
    action = 'Avoid caffeine when stressed. It amplifies cortisol and impairs recovery.';
    reasoning.push('Stress + caffeine = excessive sympathetic activation');
    reasoning.push('High cortisol impairs digestion, sleep, and cognition');
    reasoning.push('Try breathwork or short walk instead');
    
  } else if (sleepScore && sleepScore < 60) {
    action = 'Caffeine won\'t fix poor sleep. It masks fatigue but worsens the debt.';
    reasoning.push('Sleep debt must be repaid with actual sleep');
    reasoning.push('Caffeine increases sleep pressure for tonight');
    reasoning.push('Prioritize recovery over stimulation');
    
  } else {
    action = 'Safe to have caffeine now. Optimal window is 90 min - 6 hours post-wake.';
    reasoning.push('You\'re in the performance window');
    reasoning.push('Ensure last caffeine is 8+ hours before sleep');
    reasoning.push('200mg (2 cups coffee) is effective dose for most');
  }
  
  return {
    explanation,
    action,
    reasoning,
    confidence: 'high',
    domains: ['energy', 'circadian', 'sleep'],
  };
}

// ========================================
// TIMING RESPONSE GENERATOR
// ========================================

function generateTimingResponse(context: AdvisorContext): AdvisorResponse {
  const { query, profile, currentTime, currentPlan } = context;
  
  // Generic timing question - provide framework
  const explanation = 'Optimal timing depends on your circadian rhythm, goals, and current schedule.';
  const action = 'For specific timing advice, ask about: meals, workouts, caffeine, or sleep.';
  const reasoning = [
    'Peak performance: 2-4 hours post-wake',
    'Best meal timing: aligned with activity and circadian rhythm',
    'Training: 3-6 hours post-wake for strength',
    'Sleep prep: begin wind-down 2 hours before target',
  ];
  
  return {
    explanation,
    action,
    reasoning,
    confidence: 'medium',
    domains: ['circadian'],
  };
}

// ========================================
// GENERAL RESPONSE GENERATOR
// ========================================

function generateGeneralResponse(context: AdvisorContext): AdvisorResponse {
  const explanation = 'I specialize in physiology-based timing and structure optimization.';
  const action = 'Ask me about: meal timing, workout scheduling, energy management, sleep optimization, or stress regulation.';
  const reasoning = [
    'I provide timing-focused, structure-focused behavioral guidance',
    'No calorie counting, no macro tracking, no medical advice',
    'Focus: circadian alignment, meal spacing, movement timing',
  ];
  
  return {
    explanation,
    action,
    reasoning,
    confidence: 'medium',
    domains: ['circadian'],
  };
}
