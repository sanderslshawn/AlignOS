/**
 * AlignOS AI Advisor - Quick Questions
 * 
 * Pre-loaded intelligent responses for common queries.
 * Provides instant, context-aware answers to frequent questions.
 */

import { format, addMinutes } from 'date-fns';
import type { UserProfile } from '@physiology-engine/shared';

export interface QuickQuestion {
  id: string;
  question: string;
  emoji: string;
  responseGenerator: (profile: UserProfile, currentTime: Date) => string;
}

/**
 * Quick question templates with dynamic context
 */
export const QUICK_QUESTIONS: QuickQuestion[] = [
  {
    id: 'workout_timing',
    question: 'Best time to strength train?',
    emoji: '',
    responseGenerator: (profile, currentTime) => {
      const wakeTime = new Date(profile.wakeTime);
      const optimalStart = addMinutes(wakeTime, 3 * 60);
      const optimalEnd = addMinutes(wakeTime, 6 * 60);
      
      return `**Optimal: ${format(optimalStart, 'h:mm a')} - ${format(optimalEnd, 'h:mm a')}**\n\n` +
        `Body temperature and muscle activation peak 3-6 hours post-wake. ` +
        `Neuromuscular system fully online, hormone profile supports training.\n\n` +
        `Avoid training within 4 hours of sleep — it elevates cortisol and delays sleep onset.`;
    },
  },
  {
    id: 'meal_timing',
    question: 'When should I eat?',
    emoji: '',
    responseGenerator: (profile) => {
      const goal = profile.fitnessGoal || 'GENERAL_HEALTH';
      
      if (goal === 'FAT_LOSS' || goal === 'WEIGHT_LOSS') {
        return `**For fat loss: Front-load calories**\n\n` +
          `• **Breakfast**: Largest meal (high protein)\n` +
          `• **Lunch**: Moderate (protein + carbs)\n` +
          `• **Dinner**: Smallest (protein + veggies)\n\n` +
          `Space meals 3-4 hours apart. Insulin sensitivity peaks in morning — use it.`;
      } else if (goal === 'MUSCLE_GAIN') {
        return `**For muscle gain: Protein every 3-4 hours**\n\n` +
          `• **Pre-workout**: 60-90 min before (protein + carbs)\n` +
          `• **Post-workout**: Within 30 min (protein priority)\n` +
          `• **Other meals**: Every 3-4 hours\n\n` +
          `Consistency > timing. Keep muscle protein synthesis elevated.`;
      } else {
        return `**For general health: Align with circadian rhythm**\n\n` +
          `• **Breakfast**: Within 1-2 hours of waking\n` +
          `• **Lunch**: Midday\n` +
          `• **Dinner**: 3-4 hours before sleep\n\n` +
          `Front-load calories. Space meals 3-4 hours. Avoid late eating.`;
      }
    },
  },
  {
    id: 'afternoon_fatigue',
    question: 'Why am I tired at 3pm?',
    emoji: '😴',
    responseGenerator: () => {
      return `**Natural circadian dip (7-9 hours post-wake)**\n\n` +
        `This is adenosine buildup + potential post-lunch glucose drop. It's normal.\n\n` +
        `**Quick fix:**\n` +
        `• 10-15 min walk (clears adenosine)\n` +
        `• Hydrate (16 oz water)\n` +
        `• Avoid caffeine if past 2 PM\n\n` +
        `**Prevention:**\n` +
        `• Don't overeat at lunch\n` +
        `• Avoid solo carbs (pair with protein)`;
    },
  },
  {
    id: 'skip_breakfast',
    question: 'Should I skip breakfast?',
    emoji: '🌅',
    responseGenerator: (profile) => {
      const goal = profile.fitnessGoal || 'GENERAL_HEALTH';
      
      if (goal === 'MUSCLE_GAIN') {
        return `**No — not for muscle gain**\n\n` +
          `Fasting reduces anabolic window. You need consistent protein intake every 3-4 hours.\n\n` +
          `Skipping breakfast means fewer opportunities to elevate muscle protein synthesis.\n\n` +
          `If you prefer later breakfast: eat within 2 hours of waking.`;
      } else if (goal === 'FAT_LOSS' || goal === 'WEIGHT_LOSS') {
        return `**Maybe — depends on your circadian type**\n\n` +
          `If you're naturally hungry in AM: eat (don't fight biology).\n` +
          `If not hungry: 12-14 hour fast is fine.\n\n` +
          `Key: Don't compensate by overeating at lunch. Keep structure.`;
      } else {
        return `**Listen to your body**\n\n` +
          `If hungry: eat protein-dominant breakfast.\n` +
          `If not: wait, but eat within 2-3 hours of waking.\n\n` +
          `Consistency matters more than specific timing. Avoid extreme fasting (16+ hours) unless experienced.`;
      }
    },
  },
  {
    id: 'late_dinner',
    question: 'Is late dinner bad?',
    emoji: '🌙',
    responseGenerator: (profile) => {
      const sleepTime = new Date(profile.sleepTime);
      const latestMeal = addMinutes(sleepTime, -3 * 60);
      
      return `**Yes — it disrupts sleep and metabolism**\n\n` +
        `Eating within 3 hours of sleep:\n` +
        `• Delays melatonin onset\n` +
        `• Impairs glucose metabolism\n` +
        `• Reduces sleep quality\n` +
        `• Elevates cortisol\n\n` +
        `**Your deadline: ${format(latestMeal, 'h:mm a')}**\n` +
        `(3 hours before ${format(sleepTime, 'h:mm a')} sleep)`;
    },
  },
  {
    id: 'fasting_duration',
    question: 'How long should I fast?',
    emoji: '⏱️',
    responseGenerator: (profile) => {
      const goal = profile.fitnessGoal || 'GENERAL_HEALTH';
      
      if (goal === 'MUSCLE_GAIN') {
        return `**Minimum fasting only (12 hours max)**\n\n` +
          `Longer fasts reduce anabolic window and impair muscle growth.\n\n` +
          `Focus on consistent protein intake rather than extended fasting.`;
      } else if (goal === 'FAT_LOSS' || goal === 'WEIGHT_LOSS') {
        return `**12-14 hours for fat loss**\n\n` +
          `Example: Dinner at 7 PM → Breakfast at 9 AM (14 hours)\n\n` +
          `This improves insulin sensitivity without sacrificing muscle. Longer fasts (16+) aren't necessary and may increase stress.`;
      } else {
        return `**12-hour minimum for circadian alignment**\n\n` +
          `Natural overnight fast supports:\n` +
          `• Cellular cleanup (autophagy)\n` +
          `• Insulin sensitivity\n` +
          `• Circadian rhythm\n\n` +
          `Don't force extreme fasting. Consistency > duration.`;
      }
    },
  },
  {
    id: 'caffeine_sleep',
    question: 'Is caffeine hurting my sleep?',
    emoji: '☕',
    responseGenerator: (profile) => {
      const sleepTime = new Date(profile.sleepTime);
      const lastCaffeine = addMinutes(sleepTime, -8 * 60);
      
      return `**Yes — if consumed after 2 PM**\n\n` +
        `Caffeine has a 5-6 hour half-life. Even if you "fall asleep fine," it disrupts sleep architecture.\n\n` +
        `**Your cutoff: ${format(lastCaffeine, 'h:mm a')}**\n` +
        `(8 hours before ${format(sleepTime, 'h:mm a')} sleep)\n\n` +
        `"Tolerance" is a myth — sleep studies show disruption even in habitual users.`;
    },
  },
  {
    id: 'morning_workout',
    question: 'Should I workout in the morning?',
    emoji: '🏃',
    responseGenerator: (profile) => {
      const wakeTime = new Date(profile.wakeTime);
      const earliestWorkout = addMinutes(wakeTime, 2 * 60);
      
      return `**Depends on your chronotype**\n\n` +
        `**Early types**: Yes — you'll perform well after 2 hours post-wake.\n\n` +
        `**Late types**: No — your body temp and muscle activation peak in afternoon.\n\n` +
        `**Minimum**: Wait ${format(earliestWorkout, 'h:mm a')} (2 hours post-wake) to avoid injury risk.\n\n` +
        `If forced to train early: extend warm-up by 10 minutes.`;
    },
  },
];

/**
 * Get contextual quick questions based on current state
 */
export function getContextualQuickQuestions(
  profile: UserProfile,
  currentTime: Date,
  limit: number = 4
): QuickQuestion[] {
  const currentHour = currentTime.getHours();
  const wakeHour = new Date(profile.wakeTime).getHours();
  const hoursSinceWake = currentHour - wakeHour;
  
  // Prioritize questions based on time of day
  const prioritized: QuickQuestion[] = [];
  
  // Morning (0-3 hours post-wake): breakfast, caffeine, workout
  if (hoursSinceWake >= 0 && hoursSinceWake < 3) {
    prioritized.push(
      QUICK_QUESTIONS.find(q => q.id === 'skip_breakfast')!,
      QUICK_QUESTIONS.find(q => q.id === 'caffeine_sleep')!,
      QUICK_QUESTIONS.find(q => q.id === 'morning_workout')!,
      QUICK_QUESTIONS.find(q => q.id === 'meal_timing')!
    );
  }
  // Afternoon (7-9 hours post-wake): energy dip, workout timing
  else if (hoursSinceWake >= 7 && hoursSinceWake < 10) {
    prioritized.push(
      QUICK_QUESTIONS.find(q => q.id === 'afternoon_fatigue')!,
      QUICK_QUESTIONS.find(q => q.id === 'caffeine_sleep')!,
      QUICK_QUESTIONS.find(q => q.id === 'workout_timing')!,
      QUICK_QUESTIONS.find(q => q.id === 'meal_timing')!
    );
  }
  // Evening: dinner, sleep, fasting
  else if (hoursSinceWake >= 10) {
    prioritized.push(
      QUICK_QUESTIONS.find(q => q.id === 'late_dinner')!,
      QUICK_QUESTIONS.find(q => q.id === 'fasting_duration')!,
      QUICK_QUESTIONS.find(q => q.id === 'caffeine_sleep')!,
      QUICK_QUESTIONS.find(q => q.id === 'meal_timing')!
    );
  }
  // Default: general questions
  else {
    prioritized.push(
      QUICK_QUESTIONS.find(q => q.id === 'meal_timing')!,
      QUICK_QUESTIONS.find(q => q.id === 'workout_timing')!,
      QUICK_QUESTIONS.find(q => q.id === 'afternoon_fatigue')!,
      QUICK_QUESTIONS.find(q => q.id === 'caffeine_sleep')!
    );
  }
  
  return prioritized.slice(0, limit);
}

/**
 * Get response for a specific quick question
 */
export function getQuickQuestionResponse(
  questionId: string,
  profile: UserProfile,
  currentTime: Date
): string {
  const question = QUICK_QUESTIONS.find(q => q.id === questionId);
  if (!question) {
    return 'Question not found.';
  }
  
  return question.responseGenerator(profile, currentTime);
}
