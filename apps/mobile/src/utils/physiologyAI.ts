/**
 * PHYSIOLOGY-BASED AI ADVISOR
 * Provides intelligent, science-backed advice for meal timing, activity scheduling, and optimization
 * Enhanced with biometric data integration for recovery-aware recommendations
 * 
 * Now powered by AlignOS AI Advisor - knowledge-based advisory system
 */

import { addMinutes, format, isBefore, isAfter, differenceInMinutes } from 'date-fns';
import type { FitnessGoal, UserProfile, ScheduleItem, DayPlan } from '@physiology-engine/shared';
import type { RecoveryScore } from '../store/biometricStore';
import { getAdvisorResponse, getQuickQuestions, type BiometricContext } from './aiAdvisor';

export interface PlanUpdate {
  action: 'add' | 'modify' | 'remove';
  itemId?: string;
  newItem?: Omit<ScheduleItem, 'id'>;
  reason: string;
}

export interface AIAdvice {
  answer: string;
  reasoning: string[];
  suggestedTime?: Date;
  suggestedActivity?: Omit<ScheduleItem, 'id'>;
  suggestedPlanUpdate?: PlanUpdate;
  confidence: 'high' | 'medium' | 'low';
  references?: string[];
}

interface QueryContext {
  profile: UserProfile;
  currentPlan?: DayPlan;
  currentTime: Date;
  query: string;
  recoveryScore?: RecoveryScore; // Biometric recovery data
}

/**
 * Main AI advisor function - analyzes natural language queries
 * Now powered by knowledge-based AI Advisor module
 */
export async function analyzeQuery(context: QueryContext): Promise<AIAdvice> {
  const { query, profile, currentPlan, currentTime, recoveryScore } = context;
  
  // Map recovery score to biometric context
  const biometrics: BiometricContext | undefined = recoveryScore ? {
    sleepScore: recoveryScore.sleepScore,
    stressLevel: (recoveryScore.recommendation === 'rest' ? 'high' : 
                 recoveryScore.recommendation === 'light' ? 'medium' : 'low') as 'high' | 'medium' | 'low',
    hrv: recoveryScore.hrv,
    restingHeartRate: recoveryScore.restingHeartRate,
  } : undefined;
  
  // Get response from new AI Advisor
  const advisorResponse = await getAdvisorResponse(
    query,
    profile,
    currentPlan || null,
    currentTime,
    biometrics
  );
  
  // Map AdvisorResponse to legacy AIAdvice interface
  const answer = `${advisorResponse.explanation}\n\n**${advisorResponse.action}**${
    advisorResponse.integration ? `\n\n*${advisorResponse.integration}*` : ''
  }`;
  
  return {
    answer,
    reasoning: advisorResponse.reasoning,
    confidence: advisorResponse.confidence,
    references: advisorResponse.domains.map(d => `Knowledge: ${d}`),
  };
}

// Legacy function kept for backwards compatibility
function analyzeMealQuery(context: QueryContext): AIAdvice {
  const { query, profile, currentPlan, currentTime } = context;
  const lowerQuery = query.toLowerCase();

  // Extract meal type hints
  const isHighProtein = lowerQuery.includes('chicken') || lowerQuery.includes('steak') || 
                        lowerQuery.includes('fish') || lowerQuery.includes('meat');
  const isHighCarb = lowerQuery.includes('pasta') || lowerQuery.includes('rice') || 
                     lowerQuery.includes('bread') || lowerQuery.includes('potato');
  const isHighFat = lowerQuery.includes('burger') || lowerQuery.includes('pizza') || 
                    lowerQuery.includes('fries') || lowerQuery.includes('fried');
  const isDessert = lowerQuery.includes('dessert') || lowerQuery.includes('sweet') || 
                    lowerQuery.includes('cake') || lowerQuery.includes('ice cream');

  // Find existing meals and workouts
  const meals = currentPlan?.items.filter(i => i.type === 'meal') || [];
  const workouts = currentPlan?.items.filter(i => i.type === 'workout') || [];
  const nextWorkout = workouts.find(w => isAfter(new Date(w.startISO), currentTime));

  const goal = profile.fitnessGoal || 'MAINTENANCE';
  const reasoning: string[] = [];
  let suggestedTime: Date | undefined;
  let confidence: 'high' | 'medium' | 'low' = 'high';

  // Goal-specific meal timing logic
  if (goal === 'FAT_LOSS' || goal === 'WEIGHT_LOSS') {
    reasoning.push('For fat loss, meal timing affects insulin sensitivity and fat oxidation');

    if (isHighCarb || isHighFat) {
      // Suggest earlier in the day for high-calorie foods
      suggestedTime = addMinutes(currentTime, 30);
      const hour = suggestedTime.getHours();

      if (hour < 12) {
        reasoning.push('Morning (before noon) is optimal - highest insulin sensitivity');
        reasoning.push('Your body will efficiently use these calories for energy rather than storage');
      } else if (hour < 15) {
        reasoning.push('Early afternoon works - still decent insulin sensitivity');
        reasoning.push('Eat this 3-4 hours before any evening workout for best fat oxidation');
      } else {
        // After 3pm, suggest earlier next day
        suggestedTime = new Date(currentTime);
        suggestedTime.setDate(suggestedTime.getDate() + 1);
        suggestedTime.setHours(11, 0, 0, 0);
        reasoning.push('For fat loss goals, high-calorie meals are best before 3pm');
        reasoning.push('Consider having this tomorrow morning instead');
        confidence = 'medium';
      }

      if (isDessert) {
        reasoning.push('If you must have dessert, have it immediately after a main meal');
        reasoning.push('This minimizes insulin spikes and reduces fat storage');
      }
    } else if (isHighProtein) {
      // Protein can be any time
      suggestedTime = addMinutes(currentTime, 30);
      reasoning.push('High-protein meals support fat loss at any time of day');
      reasoning.push('Protein boosts metabolism and maintains muscle during calorie deficit');

      if (nextWorkout) {
        const minutesToWorkout = differenceInMinutes(new Date(nextWorkout.startISO), currentTime);
        if (minutesToWorkout > 60 && minutesToWorkout < 180) {
          suggestedTime = addMinutes(new Date(nextWorkout.startISO), -90);
          reasoning.push(`Ideal timing: 1.5 hours before your ${format(new Date(nextWorkout.startISO), 'HH:mm')} workout`);
          reasoning.push('Supports training performance while maintaining fat-burning state');
        }
      }
    }

  } else if (goal === 'MUSCLE_GAIN' || goal === 'PERFORMANCE') {
    reasoning.push('For muscle gain, nutrient timing around training is critical');

    if (nextWorkout) {
      const minutesToWorkout = differenceInMinutes(new Date(nextWorkout.startISO), currentTime);

      if (isHighProtein) {
        if (minutesToWorkout > 30 && minutesToWorkout < 120) {
          // Pre-workout protein
          suggestedTime = addMinutes(new Date(nextWorkout.startISO), -60);
          reasoning.push(`Eat 60 minutes before your ${format(new Date(nextWorkout.startISO), 'HH:mm')} workout`);
          reasoning.push('Pre-workout protein prevents muscle breakdown during training');
          reasoning.push('Aim for 30-40g protein with this meal');
        } else if (minutesToWorkout <= 30) {
          // Post-workout instead
          suggestedTime = addMinutes(new Date(nextWorkout.endISO || nextWorkout.startISO), 30);
          reasoning.push('Too close to workout - eat immediately after instead');
          reasoning.push('Post-workout protein within 30 min maximizes muscle protein synthesis');
        } else {
          suggestedTime = addMinutes(currentTime, 30);
          reasoning.push('Good timing for a protein-rich meal');
          reasoning.push('Consistent protein intake every 3-4 hours supports muscle growth');
        }
      } else if (isHighCarb) {
        if (minutesToWorkout > 60 && minutesToWorkout < 180) {
          suggestedTime = addMinutes(new Date(nextWorkout.startISO), -90);
          reasoning.push('Carbs 1.5-2 hours pre-workout optimize glycogen and performance');
          reasoning.push('This timing allows digestion while maximizing available energy');
        } else {
          suggestedTime = addMinutes(new Date(nextWorkout.endISO || nextWorkout.startISO), 15);
          reasoning.push('Post-workout carbs replenish glycogen and spike insulin for anabolism');
          reasoning.push('The "anabolic window" is real for glycogen replenishment');
        }
      }
    } else {
      suggestedTime = addMinutes(currentTime, 30);
      reasoning.push('No workout scheduled today - focus on consistent meal spacing');
      reasoning.push('Eat protein every 3-4 hours to maintain elevated muscle protein synthesis');
    }

  } else if (goal === 'MAINTENANCE' || goal === 'GENERAL_HEALTH') {
    reasoning.push('For general health, focus on consistent meal timing and circadian alignment');

    suggestedTime = addMinutes(currentTime, 30);
    const hour = suggestedTime.getHours();

    if (hour >= 19) {
      // Late evening - suggest earlier
      suggestedTime = new Date(currentTime);
      suggestedTime.setHours(18, 30, 0, 0);
      reasoning.push('Ideal dinner window: 5:30-7:30pm for circadian health');
      reasoning.push('Eating 3-4 hours before sleep improves sleep quality and metabolic health');
      confidence = 'medium';
    } else {
      reasoning.push('Current timing works well for metabolic health');
      reasoning.push('Aim to finish dinner 3-4 hours before bedtime');
    }

    if (isHighFat || isDessert) {
      reasoning.push('Higher-fat meals slow digestion - eat earlier if possible');
    }
  }

  // Check spacing from last meal
  if (meals.length > 0) {
    const lastMeal = meals[meals.length - 1];
    const minutesSinceLastMeal = differenceInMinutes(currentTime, new Date(lastMeal.startISO));

    if (minutesSinceLastMeal < 120) {
      reasoning.push(`⚠️ Only ${Math.floor(minutesSinceLastMeal / 60)}h since last meal`);
      reasoning.push('Ideally wait 3-4 hours between meals for optimal digestion');
      confidence = 'medium';
    }
  }

  // If no suggested time was set, default to a reasonable time
  if (!suggestedTime) {
    suggestedTime = addMinutes(currentTime, 60);
    reasoning.push('A good general guideline is to eat every 3-4 hours');
  }

  // Generate conversational answer like Copilot
  const timeStr = format(suggestedTime, 'h:mm a');
  const goalStr = goal.toLowerCase().replace('_', ' ');
  
  let answer = '';
  
  // Start with direct answer
  if (isHighProtein) {
    answer = `Great choice! For your ${goalStr} goal, I'd recommend having this high-protein meal around **${timeStr}**.\n\n`;
  } else if (isHighCarb) {
    answer = `Good question! Since you're focused on ${goalStr}, the optimal time for these carbs is **${timeStr}**.\n\n`;
  } else if (isHighFat || isDessert) {
    answer = `I understand - we all need treats! For ${goalStr}, the best time for this indulgence is **${timeStr}**.\n\n`;
  } else {
    answer = `Based on your ${goalStr} goal, I'd suggest having this meal around **${timeStr}**.\n\n`;
  }

  // Add top reasoning (make it conversational)
  if (reasoning.length > 0) {
    answer += reasoning[0];
    if (reasoning.length > 1) {
      answer += '\n\n' + reasoning.slice(1, 3).join('\n');
    }
  }

  // Extract meal description from query for better title
  let mealTitle = 'Meal';
  if (lowerQuery.includes('breakfast')) mealTitle = 'Breakfast';
  else if (lowerQuery.includes('lunch')) mealTitle = 'Lunch';
  else if (lowerQuery.includes('dinner')) mealTitle = 'Dinner';
  else if (lowerQuery.includes('snack')) mealTitle = 'Snack';
  else if (isHighProtein && (lowerQuery.includes('chicken') || lowerQuery.includes('steak') || lowerQuery.includes('fish'))) {
    mealTitle = 'Protein Meal';
  } else if (isHighCarb) {
    mealTitle = 'Carb Meal';
  } else if (isDessert) {
    mealTitle = 'Dessert';
  }

  // Create suggested activity - ALWAYS create for meal queries
  const suggestedActivity: Omit<ScheduleItem, 'id'> = {
    type: 'meal',
    title: mealTitle,
    startISO: suggestedTime.toISOString(),
    endISO: addMinutes(suggestedTime, 30).toISOString(),
    fixed: false,
    isSystemAnchor: false,
    isFixedAnchor: false,
    source: 'user',
    status: 'planned',
    notes: `From AI: ${query.substring(0, 100)}`,
  };

  // Create plan update suggestion - ALWAYS create for meal queries
  const suggestedPlanUpdate: PlanUpdate = {
    action: 'add',
    newItem: suggestedActivity,
    reason: `I'll add ${mealTitle.toLowerCase()} to your schedule at ${timeStr}`,
  };

  return {
    answer,
    reasoning,
    suggestedTime,
    suggestedActivity,
    suggestedPlanUpdate,
    confidence,
    references: [
      'Schoenfeld et al. (2018) - Nutrient timing revisited',
      'Rynders et al. (2019) - Meal timing and metabolic health',
      'Aragon & Schoenfeld (2013) - The anabolic window',
    ],
  };
}

/**
 * Analyze workout timing queries
 */
function analyzeWorkoutQuery(context: QueryContext): AIAdvice {
  const { profile, currentPlan, currentTime, recoveryScore } = context;
  const goal = profile.fitnessGoal || 'MAINTENANCE';
  const reasoning: string[] = [];

  // Check recovery status - BIOMETRIC INTEGRATION
  if (recoveryScore) {
    if (recoveryScore.score < 40) {
      reasoning.push(`🚨 Your recovery score is ${recoveryScore.score}/100 - LOW`);
      reasoning.push(`HRV: ${recoveryScore.hrv}ms | Resting HR: ${recoveryScore.restingHeartRate} BPM`);
      reasoning.push('\n⚠️ **RECOMMENDATION: REST DAY**');
      reasoning.push('Your body needs recovery. Heavy training now increases injury risk.');
      reasoning.push('Consider: light walk, stretching, or full rest day');
      
      return {
        answer: `Based on your biometric data, your body needs rest today. Your recovery score is ${recoveryScore.score}/100, which indicates you're not adequately recovered for training.`,
        reasoning,
        confidence: 'high',
        references: ['HRV-guided training reduces overtraining by 50% (Kiviniemi et al., 2007)'],
      };
    } else if (recoveryScore.score < 60) {
      reasoning.push(`⚠️ Your recovery score is ${recoveryScore.score}/100 - MODERATE`);
      reasoning.push(`HRV: ${recoveryScore.hrv}ms | Resting HR: ${recoveryScore.restingHeartRate} BPM`);
      reasoning.push('\n💡 **RECOMMENDATION: LIGHT TRAINING ONLY**');
      reasoning.push('Your body is partially recovered. Stick to 60-70% intensity max.');
      reasoning.push('');
    } else {
      reasoning.push(`Recovery score: ${recoveryScore.score}/100 - Good baseline`);
      reasoning.push(`HRV: ${recoveryScore.hrv}ms | Resting HR: ${recoveryScore.restingHeartRate} BPM`);
      reasoning.push('Your body is well-recovered and ready for training');
      reasoning.push('');
    }
  }

  // Find existing workouts and meals
  const workouts = currentPlan?.items.filter(i => i.type === 'workout') || [];
  const meals = currentPlan?.items.filter(i => i.type === 'meal') || [];

  // Circadian rhythm considerations
  const hour = currentTime.getHours();
  let suggestedTime: Date;

  if (goal === 'MUSCLE_GAIN' || goal === 'PERFORMANCE') {
    // Afternoon/evening is best for strength
    suggestedTime = new Date(currentTime);
    suggestedTime.setHours(17, 0, 0, 0);

    reasoning.push('Peak strength and power output occurs 4-6pm due to:');
    reasoning.push('• Body temperature peaks (better muscle activation)');
    reasoning.push('• Testosterone peaks in afternoon');
    reasoning.push('• Reaction time and coordination are optimal');
    reasoning.push('• Pain tolerance is highest (train harder)');

    if (isBefore(currentTime, suggestedTime)) {
      reasoning.push(`\nAim for ${format(suggestedTime, 'h:mm a')} for maximum performance`);
    }

  } else if (goal === 'FAT_LOSS' || goal === 'WEIGHT_LOSS') {
    // Morning fasted cardio or evening resistance
    const isResistance = context.query.toLowerCase().includes('lift') || 
                         context.query.toLowerCase().includes('strength');

    if (isResistance) {
      suggestedTime = new Date(currentTime);
      suggestedTime.setHours(17, 30, 0, 0);
      reasoning.push('Evening resistance training for fat loss:');
      reasoning.push('• Preserves muscle during calorie deficit');
      reasoning.push('• EPOC (afterburn) effect lasts 24-48 hours');
      reasoning.push('• Better performance = better muscle retention');
    } else {
      // Morning cardio
      suggestedTime = new Date(currentTime);
      suggestedTime.setHours(7, 0, 0, 0);
      reasoning.push('Morning cardio for fat loss:');
      reasoning.push('• Enhanced fat oxidation in fasted state');
      reasoning.push('• Doesn\'t interfere with sleep quality');
      reasoning.push('• Boosts metabolism throughout the day');
    }

  } else {
    // General health - flexibility
    suggestedTime = addMinutes(currentTime, 60);
    reasoning.push('For general health, consistency matters more than timing');
    reasoning.push('Choose a time you can stick with long-term');
    reasoning.push('Avoid heavy training within 3 hours of bedtime');
  }

  // Check meal spacing
  if (meals.length > 0) {
    const lastMeal = meals[meals.length - 1];
    const minutesSinceMeal = differenceInMinutes(suggestedTime, new Date(lastMeal.startISO));

    if (minutesSinceMeal < 60) {
      reasoning.push('\n⚠️ Important: Wait 1-2 hours after eating before training');
      reasoning.push('This prevents GI distress and allows proper blood flow to muscles');
      suggestedTime = addMinutes(new Date(lastMeal.startISO), 90);
    }
  }

  // Create conversational answer like Copilot
  const timeStr = format(suggestedTime, 'h:mm a');
  const goalStr = goal.toLowerCase().replace('_', ' ');
  
  let answer = `Based on your ${goalStr} goal, I recommend training around **${timeStr}**.\\n\\n`;
  
  // Add main reasoning (first 3 points)
  if (reasoning.length > 0) {
    answer += reasoning.slice(0, 3).join('\\n');
  }

  // Determine workout type from query
  const lowerQuery = context.query.toLowerCase();
  let workoutTitle = 'Training Session';
  if (lowerQuery.includes('cardio') || lowerQuery.includes('run')) workoutTitle = 'Cardio';
  else if (lowerQuery.includes('strength') || lowerQuery.includes('lift') || lowerQuery.includes('weights')) workoutTitle = 'Strength Training';
  else if (lowerQuery.includes('hiit')) workoutTitle = 'HIIT';
  else if (lowerQuery.includes('yoga')) workoutTitle = 'Yoga';

  const suggestedActivity: Omit<ScheduleItem, 'id'> = {
    type: 'workout',
    title: workoutTitle,
    startISO: suggestedTime.toISOString(),
    endISO: addMinutes(suggestedTime, 60).toISOString(),
    fixed: false,
    isSystemAnchor: false,
    isFixedAnchor: false,
    source: 'user',
    status: 'planned',
    notes: `From AI: ${context.query.substring(0, 100)}`,
  };

  // ALWAYS create plan update for workout queries
  const suggestedPlanUpdate: PlanUpdate = {
    action: 'add',
    newItem: suggestedActivity,
    reason: `I'll schedule ${workoutTitle.toLowerCase()} at ${timeStr} for optimal performance`,
  };

  return {
    answer,
    reasoning,
    suggestedTime,
    suggestedActivity,
    suggestedPlanUpdate,
    confidence: 'high',
    references: [
      'Sedliak et al. (2018) - Diurnal variation in strength training',
      'Chtourou & Souissi (2012) - Time-of-day effects on performance',
    ],
  };
}

/**
 * Analyze sleep queries
 */
function analyzeSleepQuery(context: QueryContext): AIAdvice {
  const { profile, currentTime } = context;
  const reasoning: string[] = [];

  const idealBedtime = new Date(currentTime);
  idealBedtime.setHours(22, 30, 0, 0);

  reasoning.push('Optimal sleep window: 10:30pm - 7:00am');
  reasoning.push('This aligns with natural circadian rhythms:');
  reasoning.push('• Melatonin peaks around 10pm');
  reasoning.push('• Growth hormone releases 11pm-2am (deep sleep)');
  reasoning.push('• Cortisol rises naturally at 6-7am (wake signal)');
  reasoning.push('\nPre-sleep optimization:');
  reasoning.push('• Dim lights 2 hours before bed');
  reasoning.push('• No food 3 hours before sleep');
  reasoning.push('• No caffeine after 2pm');
  reasoning.push('• Room temp 65-68°F');

  const answer = `For optimal recovery and health, aim for **10:30pm bedtime**.\n\n${reasoning.slice(0, 4).join('\n')}\n\nThis maximizes deep sleep and hormonal optimization.`;

  const suggestedActivity: Omit<ScheduleItem, 'id'> = {
    type: 'winddown',
    title: 'Wind-Down Routine',
    startISO: addMinutes(idealBedtime, -30).toISOString(),
    endISO: idealBedtime.toISOString(),
    fixed: false,
    isSystemAnchor: false,
    isFixedAnchor: false,
    source: 'user',
    status: 'planned',
    notes: 'Prepare for sleep - dim lights, no screens',
  };

  const suggestedPlanUpdate: PlanUpdate = {
    action: 'add',
    newItem: suggestedActivity,
    reason: `I'll add a wind-down routine at ${format(addMinutes(idealBedtime, -30), 'h:mm a')} to prepare for sleep`,
  };

  return {
    answer,
    reasoning,
    suggestedTime: idealBedtime,
    suggestedActivity,
    suggestedPlanUpdate,
    confidence: 'high',
    references: [
      'Walker (2017) - Why We Sleep',
      'Czeisler et al. (1999) - Circadian timing system',
    ],
  };
}

/**
 * Analyze walk/movement queries
 */
function analyzeWalkQuery(context: QueryContext): AIAdvice {
  const { profile, currentPlan, currentTime } = context;
  const goal = profile.fitnessGoal || 'MAINTENANCE';
  const reasoning: string[] = [];

  const meals = currentPlan?.items.filter(i => i.type === 'meal') || [];
  const lastMeal = meals[meals.length - 1];

  let suggestedTime = addMinutes(currentTime, 15);

  if (lastMeal && differenceInMinutes(currentTime, new Date(lastMeal.startISO)) <= 60) {
    // Post-meal walk
    suggestedTime = addMinutes(new Date(lastMeal.endISO || lastMeal.startISO), 10);
    reasoning.push('Post-meal walks are incredibly powerful:');
    reasoning.push('• Reduces blood glucose spike by 30-40%');
    reasoning.push('• Improves insulin sensitivity');
    reasoning.push('• Aids digestion and reduces bloating');
    reasoning.push('• 10-15 minutes is sufficient');

    if (goal === 'FAT_LOSS' || goal === 'WEIGHT_LOSS') {
      reasoning.push('\nFor fat loss, this is one of the best habits');
      reasoning.push('Walk after every meal if possible');
    }
  } else {
    // General walk timing
    const hour = currentTime.getHours();

    if (hour < 10) {
      reasoning.push('Morning walks have unique benefits:');
      reasoning.push('• Sunlight exposure sets circadian rhythm');
      reasoning.push('• Boosts mood and alertness');
      reasoning.push('• Fasted walk enhances fat oxidation');
    } else if (hour >= 17 && hour < 20) {
      reasoning.push('Evening walks are excellent for:');
      reasoning.push('• Stress reduction after work');
      reasoning.push('• Improved digestion before dinner');
      reasoning.push('• Better sleep quality');
    } else {
      reasoning.push('Walking is beneficial at any time:');
      reasoning.push('• Breaks up sedentary time');
      reasoning.push('• Improves metabolic health');
      reasoning.push('• Low-impact, low-stress movement');
    }
  }

  const timeStr = format(suggestedTime, 'h:mm a');
  const answer = `Great idea! I'd recommend a walk around **${timeStr}**.\n\n${reasoning.slice(0, 4).join('\n')}`;

  const suggestedActivity: Omit<ScheduleItem, 'id'> = {
    type: 'walk',
    title: '15min Walk',
    startISO: suggestedTime.toISOString(),
    endISO: addMinutes(suggestedTime, 15).toISOString(),
    fixed: false,
    isSystemAnchor: false,
    isFixedAnchor: false,
    source: 'user',
    status: 'planned',
    notes: `From AI: ${context.query.substring(0, 100)}`,
  };

  const suggestedPlanUpdate: PlanUpdate = {
    action: 'add',
    newItem: suggestedActivity,
    reason: `I'll add a 15-minute walk at ${timeStr} to boost your energy`,
  };

  return {
    answer,
    reasoning,
    suggestedTime,
    suggestedActivity,
    suggestedPlanUpdate,
    confidence: 'high',
    references: [
      'Reynolds et al. (2016) - Post-meal walking and glucose',
      'Colberg et al. (2016) - Physical activity and diabetes',
    ],
  };
}

/**
 * Analyze energy queries
 */
function analyzeEnergyQuery(context: QueryContext): AIAdvice {
  const { currentTime } = context;
  const reasoning: string[] = [];
  const hour = currentTime.getHours();

  let answer = '';

  if (hour >= 14 && hour < 16) {
    answer = 'Experiencing the **afternoon dip** - totally normal circadian phenomenon.';
    reasoning.push('The afternoon energy dip (2-4pm) is biological:');
    reasoning.push('• Circadian rhythm naturally dips post-lunch');
    reasoning.push('• Body temperature slightly decreases');
    reasoning.push('• Melatonin rises slightly');
    reasoning.push('\nHow to combat:');
    reasoning.push('• 10-20min power nap (not longer!)');
    reasoning.push('• Brief walk or light movement');
    reasoning.push('• Cold exposure (cold water on face)');
    reasoning.push('• Avoid heavy carbs at lunch');
    reasoning.push('• Stay hydrated');
  } else if (hour >= 6 && hour < 9) {
    answer = 'Morning energy depends on **sleep quality** and **cortisol awakening response**.';
    reasoning.push('To maximize morning alertness:');
    reasoning.push('• Get sunlight within 30min of waking');
    reasoning.push('• Wait 90min before caffeine (let cortisol peak)');
    reasoning.push('• Cold shower or exercise');
    reasoning.push('• Hydrate immediately upon waking');
  } else if (hour >= 22 || hour < 6) {
    answer = 'You should be winding down, not energized.';
    reasoning.push('Late-night alertness disrupts circadian rhythm:');
    reasoning.push('• Blue light suppresses melatonin');
    reasoning.push('• Late eating disrupts sleep');
    reasoning.push('• Stimulation prevents deep sleep');
    reasoning.push('• Wind down 2 hours before bed');
  } else {
    answer = 'Energy should be stable mid-day with proper fueling.';
    reasoning.push('Maintaining steady energy:');
    reasoning.push('• Balanced meals (protein + fiber + healthy fats)');
    reasoning.push('• Avoid blood sugar spikes');
    reasoning.push('• Stay hydrated (even 2% dehydration affects energy)');
    reasoning.push('• Movement breaks every 60-90 minutes');
  }

  return {
    answer,
    reasoning,
    confidence: 'high',
    references: [
      'Huberman Lab - Master Your Sleep & Energy',
      'Waterhouse et al. (2007) - Circadian rhythms and performance',
    ],
  };
}

/**
 * Analyze hydration queries
 */
function analyzeHydrationQuery(context: QueryContext): AIAdvice {
  const { profile, currentTime } = context;
  const reasoning: string[] = [];

  // Estimate based on average adult (70kg/154lbs)
  const estimatedWeight = 70; // kg
  const dailyWaterMl = estimatedWeight * 35; // 35ml per kg bodyweight
  const dailyWaterOz = Math.round(dailyWaterMl / 29.574);

  reasoning.push(`Daily water target: **${dailyWaterOz} oz** (${Math.round(dailyWaterMl / 1000)} liters)`);
  reasoning.push('Based on average bodyweight - adjust for your size and activity level');
  reasoning.push('\nHydration strategy:');
  reasoning.push('• Morning: 16-20oz upon waking (rehydrate from sleep)');
  reasoning.push('• Before meals: 8-16oz 30min before eating');
  reasoning.push('• During training: 8oz every 15-20min');
  reasoning.push('• Throughout day: Sip consistently');
  reasoning.push('\nSigns of dehydration:');
  reasoning.push('• Dark yellow urine');
  reasoning.push('• Headaches or fatigue');
  reasoning.push('• Dry mouth or lips');
  reasoning.push('• Reduced performance');

  const answer = `Aim for **${dailyWaterOz}oz** of water daily. Front-load hydration in the morning, and drink before you feel thirsty.`;

  return {
    answer,
    reasoning,
    confidence: 'high',
    references: [
      'Armstrong et al. (2012) - Hydration and health',
      'Sawka et al. (2007) - Exercise and fluid replacement',
    ],
  };
}

/**
 * Generic query fallback
 */
function analyzeGenericQuery(context: QueryContext): AIAdvice {
  const { profile } = context;
  const goal = profile.fitnessGoal || 'MAINTENANCE';

  const answer = `I can help with **meal timing**, **workout scheduling**, **energy optimization**, and **recovery planning** based on your ${goal.toLowerCase().replace('_', ' ')} goal. Try asking: "When should I eat dinner?" or "Best time to workout?"`;

  const reasoning = [
    'I specialize in physiology-based advice for:',
    '• Meal timing and macronutrient timing',
    '• Workout scheduling for your goals',
    '• Sleep optimization',
    '• Energy and recovery',
    '• Movement and walking strategies',
    '\nAsk me specific questions about your schedule!',
  ];

  return {
    answer,
    reasoning,
    confidence: 'low',
  };
}

/**
 * Generate context-aware quick suggestion
 * Now powered by Quick Questions system
 */
export function getQuickSuggestion(profile: UserProfile, currentTime: Date): string {
  const questions = getQuickQuestions(profile, currentTime, 1);
  
  if (questions.length > 0) {
    const question = questions[0];
    return `${question.emoji} ${question.question}`;
  }
  
  // Fallback
  return 'Consistency is key - stick to your planned schedule today ✨';
}
