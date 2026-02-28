import type { UserProfile, ScheduleItem, DayPlan, FitnessGoal, ConstraintBlock, WorkoutEvent, MealEvent } from '@physiology-engine/shared';
import { generateId } from '@physiology-engine/shared';
import { add, format, parse, isWithinInterval, isBefore, isAfter, addHours, addMinutes } from 'date-fns';

/**
 * FULL-DAY PLAN GENERATION ENGINE
 * Creates a comprehensive day schedule from wake to sleep with:
 * - Fixed blocks from settings (wake, sleep, work)
 * - User-created entries (preserved as-is)
 * - Today's schedule (meetings, obligations, workouts from TodaySetup)
 * - Physiologically-optimized meal timing
 * - Fitness and wellness activities based on fitness goal
 */

interface GenerateDayPlanInput {
  dateISO: string; // YYYY-MM-DD
  settings: UserProfile;
  todayEntries: ScheduleItem[];
  constraints?: ConstraintBlock[];
  plannedWorkouts?: WorkoutEvent[];
  plannedMeals?: MealEvent[];
}

export function generateDayPlan(input: GenerateDayPlanInput): DayPlan {
  const { dateISO, settings, todayEntries, constraints = [], plannedWorkouts = [], plannedMeals = [] } = input;
  let items: ScheduleItem[] = [];
  
  // Parse date
  const date = parse(dateISO, 'yyyy-MM-dd', new Date());
  
  // Step 1: Create wake and sleep blocks
  const wakeTime = parseTimeOnDate(settings.wakeTime, date);
  const sleepTime = parseTimeOnDate(settings.sleepTime, date);
  // Handle sleep rolling into next day
  if (isBefore(sleepTime, wakeTime)) {
    sleepTime.setDate(sleepTime.getDate() + 1);
  }
  
  items.push({
    id: 'wake-' + dateISO,
    type: 'wake',
    title: 'Wake / Start Day',
    startISO: wakeTime.toISOString(),
    endISO: addMinutes(wakeTime, 15).toISOString(),
    fixed: true,
    source: 'settings',
    notes: 'Morning start time from profile',
  });
  
  items.push({
    id: 'sleep-' + dateISO,
    type: 'sleep',
    title: 'Sleep',
    startISO: sleepTime.toISOString(),
    endISO: addHours(sleepTime, 8).toISOString(),
    fixed: true,
    source: 'settings',
    notes: 'Target sleep time from profile',
  });
  
  // Step 2: Add work block if workSchedule defined
  if (settings.workStartTime && settings.workEndTime) {
    const dayOfWeek = date.getDay();
    // Simple heuristic: assume work Mon-Fri unless specified
    const isWorkday = dayOfWeek >= 1 && dayOfWeek <= 5;
    
    if (isWorkday) {
      const workStart = parseTimeOnDate(settings.workStartTime, date);
      const workEnd = parseTimeOnDate(settings.workEndTime, date);
      
      // Add commute if defined
      if (settings.commuteDuration) {
        const morningCommuteStart = addMinutes(workStart, -settings.commuteDuration);
        items.push({
          id: 'commute-morning-' + dateISO,
          type: 'custom',
          title: 'Commute to Work',
          startISO: morningCommuteStart.toISOString(),
          endISO: workStart.toISOString(),
          fixed: false,
          source: 'settings',
        });
        
        const eveningCommuteEnd = addMinutes(workEnd, settings.commuteDuration);
        items.push({
          id: 'commute-evening-' + dateISO,
          type: 'custom',
          title: 'Commute Home',
          startISO: workEnd.toISOString(),
          endISO: eveningCommuteEnd.toISOString(),
          fixed: false,
          source: 'settings',
        });
      }
      
      items.push({
        id: 'work-' + dateISO,
        type: 'work',
        title: 'Work',
        startISO: workStart.toISOString(),
        endISO: workEnd.toISOString(),
        fixed: false,
        source: 'settings',
        notes: 'Work hours from profile',
      });
    }
  }
  
  // Step 3: Add constraints from TodaySetup (meetings, obligations)
  // Filter out work/commute constraints if work is already defined in settings
  const hasWorkInSettings = settings.workStartTime && settings.workEndTime;
  const filteredConstraints = hasWorkInSettings 
    ? constraints.filter(c => c.type !== 'work' && c.type !== 'commute')
    : constraints;
    
  for (const constraint of filteredConstraints) {
    items.push({
      id: generateId(),
      type: constraint.type === 'meeting' ? 'meeting' : 'custom',
      title: constraint.description || 'Scheduled Block',
      startISO: constraint.start.toISOString(),
      endISO: constraint.end.toISOString(),
      fixed: false,
      source: 'user',
      notes: constraint.description,
    });
  }
  
  // Step 4: Add planned workouts from TodaySetup
  for (const workout of plannedWorkouts) {
    items.push({
      id: generateId(),
      type: 'workout',
      title: `${workout.type} Workout (${workout.duration}min)`,
      startISO: workout.time.toISOString(),
      endISO: addMinutes(workout.time, workout.duration).toISOString(),
      fixed: false,
      source: 'user',
      notes: `${workout.intensity} intensity`,
      meta: { workoutType: workout.type, intensity: workout.intensity },
    });
  }
  
  // Step 5: Add planned meals from TodaySetup
  for (const meal of plannedMeals) {
    items.push({
      id: generateId(),
      type: 'meal',
      title: `${meal.mealType.replace('-', ' ')} Meal`,
      startISO: meal.time.toISOString(),
      endISO: addMinutes(meal.time, 45).toISOString(),
      fixed: false,
      source: 'user',
      notes: meal.mealType,
      meta: { mealType: meal.mealType },
    });
  }
  
  // Step 6: Add user-created entries (mark as fixed)
  // User entries will override settings entries with the same ID
  for (const entry of todayEntries) {
    items.push({
      ...entry,
      fixed: false,
      source: 'user',
    });
  }
  
  // Deduplicate by ID and overlapping times - user entries take precedence
  const itemsById = new Map<string, ScheduleItem>();
  
  // First pass: add all items by ID
  for (const item of items) {
    const existing = itemsById.get(item.id);
    // If item exists and current is user-created, or if no existing item, add it
    if (!existing || item.source === 'user') {
      itemsById.set(item.id, item);
    }
  }
  
  // Second pass: remove overlapping duplicates (same type, >80% overlap)
  const uniqueItems: ScheduleItem[] = [];
  const itemsArray = Array.from(itemsById.values());
  
  for (const item of itemsArray) {
    let isDuplicate = false;
    
    for (const existing of uniqueItems) {
      // Check if items are similar (same type or both work-related)
      const isSameType = item.type === existing.type || 
        (isWorkRelated(item.type) && isWorkRelated(existing.type));
      
      if (isSameType) {
        const overlap = calculateOverlap(
          new Date(item.startISO),
          new Date(item.endISO),
          new Date(existing.startISO),
          new Date(existing.endISO)
        );
        
        // If >80% overlap, consider duplicate
        if (overlap > 0.8) {
          isDuplicate = true;
          // Keep user entry over settings/engine entries
          if (item.source === 'user' && existing.source !== 'user') {
            // Replace existing with user entry
            const index = uniqueItems.indexOf(existing);
            uniqueItems[index] = item;
          }
          break;
        }
      }
    }
    
    if (!isDuplicate) {
      uniqueItems.push(item);
    }
  }
  
  items = uniqueItems;
  
  // Step 7: Sort all items by start time
  items.sort((a, b) => new Date(a.startISO).getTime() - new Date(b.startISO).getTime());
  
  // Step 8: Find gaps and insert meals (only if not provided by user)
  const mealItems = insertMeals(wakeTime, sleepTime, items, settings);
  items.push(...mealItems);
  
  // Step 9: Insert fitness/wellness activities based on fitness goal
  const fitnessItems = insertFitnessActivities(wakeTime, sleepTime, items, settings.fitnessGoal || 'MAINTENANCE');
  items.push(...fitnessItems);
  
  // Step 10: Fill remaining gaps with smart recommendations based on fitness goal
  const fillerItems = fillGaps(wakeTime, sleepTime, items, settings.fitnessGoal || 'MAINTENANCE');
  items.push(...fillerItems);
  
  // Final sort
  items.sort((a, b) => new Date(a.startISO).getTime() - new Date(b.startISO).getTime());
  
  // Remove deletion markers (items marked as deleted by user)
  items = items.filter(item => item.notes !== 'deleted-marker');
  
  // Generate summary and recommendations
  const summary = generateSummary(items, settings.fitnessGoal || 'MAINTENANCE');
  const recommendations = generateRecommendations(settings.fitnessGoal || 'MAINTENANCE');
  
  return {
    dateISO,
    items,
    summary,
    recommendations,
  };
}

function parseTimeOnDate(timeStr: string, date: Date): Date {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const result = new Date(date);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

function insertMeals(wakeTime: Date, sleepTime: Date, existingItems: ScheduleItem[], settings: UserProfile): ScheduleItem[] {
  const meals: ScheduleItem[] = [];
  
  // Check if user already has meals
  const hasMeals = existingItems.some(item => item.type === 'meal');
  if (hasMeals) return meals; // Don't duplicate if user added meals
  
  // Breakfast: 60-120 min after wake
  const breakfastTime = addMinutes(wakeTime, 90);
  if (isBeforeSleep(breakfastTime, sleepTime) && !hasConflict(breakfastTime, existingItems, 60)) {
    meals.push({
      id: generateId(),
      type: 'meal',
      title: 'Breakfast',
      startISO: breakfastTime.toISOString(),
      endISO: addMinutes(breakfastTime, 30).toISOString(),
      fixed: false,
      source: 'engine',
      notes: 'Breakfast ~90min after wake',
      meta: { mealType: 'breakfast' },
    });
  }
  
  // Lunch: mid-day (around 12:00-13:00)
  const lunchTime = parseTimeOnDate('12:30', new Date(breakfastTime));
  if (isBeforeSleep(lunchTime, sleepTime) && !hasConflict(lunchTime, existingItems, 60)) {
    meals.push({
      id: generateId(),
      type: 'meal',
      title: 'Lunch',
      startISO: lunchTime.toISOString(),
      endISO: addMinutes(lunchTime, 30).toISOString(),
      fixed: false,
      source: 'engine',
      notes: 'Mid-day meal',
      meta: { mealType: 'lunch' },
    });
  }
  
  // Dinner: 3-4 hours before sleep
  const dinnerTime = addHours(sleepTime, -3.5);
  if (isAfter(dinnerTime, wakeTime) && !hasConflict(dinnerTime, existingItems, 60)) {
    meals.push({
      id: generateId(),
      type: 'meal',
      title: 'Dinner',
      startISO: dinnerTime.toISOString(),
      endISO: addMinutes(dinnerTime, 30).toISOString(),
      fixed: false,
      source: 'engine',
      notes: '3.5hrs before sleep for digestion',
      meta: { mealType: 'dinner' },
    });
  }
  
  return meals;
}

function insertFitnessActivities(wakeTime: Date, sleepTime: Date, existingItems: ScheduleItem[], fitnessGoal: FitnessGoal): ScheduleItem[] {
  const activities: ScheduleItem[] = [];
  
  // Morning light exposure (all fitness goals)
  const morningLightTime = addMinutes(wakeTime, 20);
  if (!hasConflict(morningLightTime, existingItems, 15)) {
    activities.push({
      id: generateId(),
      type: 'custom',
      title: 'Morning Light Exposure',
      startISO: morningLightTime.toISOString(),
      endISO: addMinutes(morningLightTime, 10).toISOString(),
      fixed: false,
      source: 'engine',
      notes: 'Get sunlight for circadian rhythm and metabolic boost',
    });
  }
  
  // Morning mobility/stretching (all goals)
  const morningStretchTime = addMinutes(wakeTime, 35);
  if (!hasConflict(morningStretchTime, existingItems, 15)) {
    activities.push({
      id: generateId(),
      type: 'stretch',
      title: 'Morning Mobility',
      startISO: morningStretchTime.toISOString(),
      endISO: addMinutes(morningStretchTime, 10).toISOString(),
      fixed: false,
      source: 'engine',
      notes: 'Light stretching to wake up the body',
    });
  }
  
  // Early workout for muscle gain/performance goals
  if (fitnessGoal === 'MUSCLE_GAIN' || fitnessGoal === 'PERFORMANCE') {
    const workoutTime = addHours(wakeTime, 2);
    if (!hasConflict(workoutTime, existingItems, 90)) {
      activities.push({
        id: generateId(),
        type: 'workout',
        title: fitnessGoal === 'MUSCLE_GAIN' ? 'Morning Resistance Training' : 'Morning Performance Session',
        startISO: workoutTime.toISOString(),
        endISO: addMinutes(workoutTime, 60).toISOString(),
        fixed: false,
        source: 'engine',
        notes: `60min ${fitnessGoal === 'MUSCLE_GAIN' ? 'strength' : 'performance'} workout - fasted or lightly fueled`,
      });
    }
  }
  
  // Midday movement break (general health, maintenance)
  if (fitnessGoal === 'GENERAL_HEALTH' || fitnessGoal === 'MAINTENANCE') {
    const middayWalk = addHours(wakeTime, 5);
    if (!hasConflict(middayWalk, existingItems, 20)) {
      activities.push({
        id: generateId(),
        type: 'walk',
        title: 'Midday Movement Break',
        startISO: middayWalk.toISOString(),
        endISO: addMinutes(middayWalk, 15).toISOString(),
        fixed: false,
        source: 'engine',
        notes: 'Break up sitting time with light activity',
      });
    }
  }
  
  // Post-meal walks (fat loss, weight loss)
  if (fitnessGoal === 'FAT_LOSS' || fitnessGoal === 'WEIGHT_LOSS') {
    const meals = existingItems.filter(item => item.type === 'meal');
    for (const meal of meals) {
      const walkTime = addMinutes(new Date(meal.endISO), 15);
      if (!hasConflict(walkTime, existingItems, 20)) {
        activities.push({
          id: generateId(),
          type: 'walk',
          title: 'Post-Meal Walk',
          startISO: walkTime.toISOString(),
          endISO: addMinutes(walkTime, 15).toISOString(),
          fixed: false,
          source: 'engine',
          notes: 'Helps with glucose clearance and fat oxidation',
        });
      }
    }
  }
  
  // Evening wind-down (closer to sleep)
  const winddownTime = addMinutes(sleepTime, -45);
  if (isAfter(winddownTime, wakeTime) && !hasConflict(winddownTime, existingItems, 40)) {
    activities.push({
      id: generateId(),
      type: 'winddown',
      title: 'Evening Wind-Down Routine',
      startISO: winddownTime.toISOString(),
      endISO: addMinutes(winddownTime, 30).toISOString(),
      fixed: false,
      source: 'engine',
      notes: 'Reading, stretching, journaling - dim lights, no screens',
    });
  }
  
  // Strategic hydration reminders
  const hydrationTimes = [
    { offset: 180, label: 'Mid-Morning Hydration' },  // 3h after wake
    { offset: 360, label: 'Midday Hydration' },       // 6h after wake
    { offset: 540, label: 'Afternoon Hydration' },    // 9h after wake
  ];
  
  for (const { offset, label } of hydrationTimes) {
    const hydrationTime = addMinutes(wakeTime, offset);
    if (isBefore(hydrationTime, sleepTime) && !hasConflict(hydrationTime, existingItems, 5)) {
      activities.push({
        id: generateId(),
        type: 'hydration',
        title: label,
        startISO: hydrationTime.toISOString(),
        endISO: addMinutes(hydrationTime, 2).toISOString(),
        fixed: false,
        source: 'engine',
        notes: 'Drink 300-500ml water',
      });
    }
  }
  
  return activities;
}

function fillGaps(wakeTime: Date, sleepTime: Date, existingItems: ScheduleItem[], fitnessGoal: FitnessGoal): ScheduleItem[] {
  const fillers: ScheduleItem[] = [];
  const sorted = [...existingItems].sort((a, b) => 
    new Date(a.startISO).getTime() - new Date(b.startISO).getTime()
  );
  
  // Find gaps > 30 minutes and fill with fitness-goal optimized activities
  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i];
    const next = sorted[i + 1];
    const gapStart = new Date(current.endISO);
    const gapEnd = new Date(next.startISO);
    const gapMinutes = (gapEnd.getTime() - gapStart.getTime()) / 60000;
    
    if (gapMinutes > 30) {
      const hourOfDay = gapStart.getHours();
      const isEvening = hourOfDay >= 17 && hourOfDay < 21;
      const isAfternoon = hourOfDay >= 13 && hourOfDay < 17;
      const isMorning = hourOfDay >= 6 && hourOfDay < 12;
      const isPreSleep = hourOfDay >= 21;
      
      // Smart gap filling based on time of day and fitness goal
      const gapActivities = getGapActivities(gapStart, gapMinutes, fitnessGoal, isEvening, isAfternoon, isMorning, isPreSleep);
      
      fillers.push(...gapActivities);
    }
  }
  
  return fillers;
}

function getGapActivities(
  gapStart: Date, 
  gapMinutes: number, 
  fitnessGoal: FitnessGoal,
  isEvening: boolean,
  isAfternoon: boolean,
  isMorning: boolean,
  isPreSleep: boolean
): ScheduleItem[] {
  const activities: ScheduleItem[] = [];
  let currentTime = gapStart;
  let remainingMinutes = gapMinutes - 10; // Leave 10min buffer
  
  // Pre-sleep: Always wind-down activities
  if (isPreSleep) {
    if (remainingMinutes >= 30) {
      activities.push({
        id: generateId(),
        type: 'winddown',
        title: 'Evening Wind-Down',
        startISO: addMinutes(currentTime, 5).toISOString(),
        endISO: addMinutes(currentTime, 5 + Math.min(remainingMinutes, 45)).toISOString(),
        fixed: false,
        source: 'engine',
        notes: 'Reading, stretching, or light activity before bed',
      });
    }
    return activities;
  }
  
  // Evening: Fitness-goal specific activities
  if (isEvening && remainingMinutes >= 45) {
    switch (fitnessGoal) {
      case 'MUSCLE_GAIN':
      case 'PERFORMANCE':
        // Evening workout if gap is large enough
        if (remainingMinutes >= 90) {
          activities.push({
            id: generateId(),
            type: 'workout',
            title: fitnessGoal === 'MUSCLE_GAIN' ? 'Evening Resistance Training' : 'Evening Training Session',
            startISO: addMinutes(currentTime, 10).toISOString(),
            endISO: addMinutes(currentTime, 70).toISOString(),
            fixed: false,
            source: 'engine',
            notes: `60min ${fitnessGoal === 'MUSCLE_GAIN' ? 'strength' : 'performance'} workout - optimal evening window`,
          });
          currentTime = addMinutes(currentTime, 70);
          remainingMinutes -= 60;
        }
        break;
        
      case 'FAT_LOSS':
      case 'WEIGHT_LOSS':
        // Evening cardio or active recovery
        if (remainingMinutes >= 60) {
          activities.push({
            id: generateId(),
            type: 'walk',
            title: 'Evening Activity Walk',
            startISO: addMinutes(currentTime, 10).toISOString(),
            endISO: addMinutes(currentTime, 40).toISOString(),
            fixed: false,
            source: 'engine',
            notes: '30min brisk walk - great for fat loss and glucose management',
          });
          currentTime = addMinutes(currentTime, 40);
          remainingMinutes -= 30;
        }
        break;
        
      case 'GENERAL_HEALTH':
      case 'MAINTENANCE':
        // Balanced evening activities
        if (remainingMinutes >= 60) {
          activities.push({
            id: generateId(),
            type: 'walk',
            title: 'Evening Movement',
            startISO: addMinutes(currentTime, 10).toISOString(),
            endISO: addMinutes(currentTime, 35).toISOString(),
            fixed: false,
            source: 'engine',
            notes: '25min walk or light activity for general wellness',
          });
          currentTime = addMinutes(currentTime, 35);
          remainingMinutes -= 25;
        }
        break;
    }
    
    // Add stretching/mobility after workout
    if (remainingMinutes >= 20 && activities.length > 0 && activities[activities.length - 1].type === 'workout') {
      activities.push({
        id: generateId(),
        type: 'stretch',
        title: 'Post-Workout Stretching',
        startISO: currentTime.toISOString(),
        endISO: addMinutes(currentTime, 15).toISOString(),
        fixed: false,
        source: 'engine',
        notes: 'Recovery and flexibility work',
      });
      currentTime = addMinutes(currentTime, 15);
      remainingMinutes -= 15;
    }
  }
  
  // Afternoon: Goal-specific activities
  if (isAfternoon && remainingMinutes >= 30) {
    switch (fitnessGoal) {
      case 'MUSCLE_GAIN':
      case 'PERFORMANCE':
        if (remainingMinutes >= 90) {
          activities.push({
            id: generateId(),
            type: 'workout',
            title: 'Afternoon Training',
            startISO: addMinutes(currentTime, 10).toISOString(),
            endISO: addMinutes(currentTime, 70).toISOString(),
            fixed: false,
            source: 'engine',
            notes: '60min workout - peak performance window',
          });
          currentTime = addMinutes(currentTime, 70);
          remainingMinutes -= 60;
        }
        break;
        
      case 'FAT_LOSS':
      case 'WEIGHT_LOSS':
        if (remainingMinutes >= 45) {
          activities.push({
            id: generateId(),
            type: 'walk',
            title: 'Afternoon Movement',
            startISO: addMinutes(currentTime, 10).toISOString(),
            endISO: addMinutes(currentTime, 35).toISOString(),
            fixed: false,
            source: 'engine',
            notes: '25min activity - helps energy and fat oxidation',
          });
          currentTime = addMinutes(currentTime, 35);
          remainingMinutes -= 25;
        }
        break;
    }
  }
  
  // Fill remaining time with focus/rest blocks
  if (remainingMinutes >= 30) {
    const fillType = remainingMinutes > 60 ? 'focus' : 'break';
    const fillDuration = Math.min(remainingMinutes, 90);
    
    activities.push({
      id: generateId(),
      type: fillType,
      title: fillType === 'focus' ? 'Focus / Deep Work' : 'Flexible Time',
      startISO: currentTime.toISOString(),
      endISO: addMinutes(currentTime, fillDuration).toISOString(),
      fixed: false,
      source: 'engine',
      notes: `${Math.floor(fillDuration)}min ${fillType === 'focus' ? 'for productive work' : 'for rest and recovery'}`,
    });
  }
  
  return activities;
}

function hasConflict(time: Date, items: ScheduleItem[], durationMinutes: number): boolean {
  const proposedEnd = addMinutes(time, durationMinutes);
  
  for (const item of items) {
    const itemStart = new Date(item.startISO);
    const itemEnd = new Date(item.endISO);
    
    // Check for overlap
    if (
      isWithinInterval(time, { start: itemStart, end: itemEnd }) ||
      isWithinInterval(proposedEnd, { start: itemStart, end: itemEnd }) ||
      (isBefore(time, itemStart) && isAfter(proposedEnd, itemEnd))
    ) {
      return true;
    }
  }
  
  return false;
}

function isBeforeSleep(time: Date, sleepTime: Date): boolean {
  return isBefore(time, sleepTime);
}

function isWorkRelated(type: string): boolean {
  return type === 'work' || type === 'commute';
}

function calculateOverlap(start1: Date, end1: Date, start2: Date, end2: Date): number {
  const latestStart = start1 > start2 ? start1 : start2;
  const earliestEnd = end1 < end2 ? end1 : end2;
  
  if (latestStart >= earliestEnd) return 0; // No overlap
  
  const overlapMs = earliestEnd.getTime() - latestStart.getTime();
  const duration1 = end1.getTime() - start1.getTime();
  const duration2 = end2.getTime() - start2.getTime();
  const minDuration = Math.min(duration1, duration2);
  
  return overlapMs / minDuration;
}

function generateSummary(items: ScheduleItem[], fitnessGoal: FitnessGoal): string {
  const mealCount = items.filter(i => i.type === 'meal').length;
  const workoutCount = items.filter(i => i.type === 'workout').length;
  const walkCount = items.filter(i => i.type === 'walk').length;
  const hasWork = items.some(i => i.type === 'work');
  
  let summary = `${items.length} activities scheduled`;
  if (hasWork) summary += ' including work';
  if (mealCount > 0) summary += `, ${mealCount} meals`;
  if (workoutCount > 0) summary += `, ${workoutCount} workout${workoutCount > 1 ? 's' : ''}`;
  if (walkCount > 0) summary += `, ${walkCount} walks`;
  summary += `. Optimized for ${fitnessGoal.toLowerCase().replace('_', ' ')}.`;
  
  return summary;
}

function generateRecommendations(fitnessGoal: FitnessGoal): string[] {
  const recommendations: string[] = [];
  
  switch (fitnessGoal) {
    case 'FAT_LOSS':
    case 'WEIGHT_LOSS':
      recommendations.push('Evening walks are optimal for fat oxidation - use the time after work');
      recommendations.push('Take 10-15min walks after each meal to manage blood glucose');
      recommendations.push('Prioritize protein at each meal to maintain muscle during fat loss');
      recommendations.push('Earlier dinner (3-4hrs before sleep) improves overnight fat burning');
      recommendations.push('Morning sunlight exposure boosts metabolism and circadian rhythm');
      recommendations.push('Fill evening gaps with movement activities rather than sitting');
      break;
    case 'MUSCLE_GAIN':
      recommendations.push('Evening training window (5-7pm) is optimal for strength gains');
      recommendations.push('Fuel adequately 1-2hrs before resistance training sessions');
      recommendations.push('Post-workout stretching and mobility work aids recovery');
      recommendations.push('Space meals 3-4 hours apart for optimal protein synthesis');
      recommendations.push('Prioritize 7-9hrs sleep for muscle repair and growth');
      recommendations.push('Use evening gaps for training and active recovery');
      break;
    case 'PERFORMANCE':
      recommendations.push('Afternoon and evening are peak performance windows for training');
      recommendations.push('Time carbohydrate intake around training sessions for fuel');
      recommendations.push('Active recovery and mobility work prevent overtraining');
      recommendations.push('Stay hydrated throughout the day for performance');
      recommendations.push('Evening gaps are perfect for skill work and conditioning');
      break;
    case 'MAINTENANCE':
    case 'GENERAL_HEALTH':
      recommendations.push('Use evening time for walks, stretching, or light activities');
      recommendations.push('Maintain consistent meal timing for metabolic health');
      recommendations.push('Balance movement throughout the day, not just workouts');
      recommendations.push('Evening wind-down routine improves sleep quality');
      recommendations.push('Fill gaps with a mix of productive work and active breaks');
      break;
  }
  
  // Add universal recommendations
  recommendations.push('Tap any activity to adjust timing or add your own events');
  
  return recommendations;
}
