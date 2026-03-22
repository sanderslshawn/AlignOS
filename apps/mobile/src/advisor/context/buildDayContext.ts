import type { DayContext } from '../types/advisorResponse';
import { usePlanStore } from '../../store/planStore';
import { hoursSince, formatTime, getCurrentTimeISO, getCurrentTimeFormatted, parseTimeToday, formatTime24 } from '../utils/time';
import { compareByStartMin, ensureStartEnd, minutesTo12h } from '../../utils/time';
import type { ScheduleItem } from '@physiology-engine/shared';
import { QUICK_STATUS_LABELS, normalizeQuickStatusSignals } from '../../types/quickStatus';

/**
 * Build a comprehensive day context for template rendering
 * Extracts data from the app store and computes derived fields
 */
export function buildDayContext(): DayContext {
  const { profile, dayState, fullDayPlan } = usePlanStore.getState();
  
  // Defaults if data is missing
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const nowISO = getCurrentTimeISO();
  const nowLocal = getCurrentTimeFormatted();
  
  // Profile data (with safe defaults)
  const wakeTime = profile?.wakeTime || '07:00';
  const sleepTime = profile?.sleepTime || '23:00';
  const preferredFastingHours = profile?.preferredFastingHours || 14;
  
  // Day state data
  const dayMode = dayState?.dayMode || profile?.defaultDayMode || 'flex';
  const sleepQuality = dayState?.sleepQuality || 7;
  const stressLevel = dayState?.stressLevel || profile?.stressBaseline || 5;
  
  // Calculate bedtime (90min before sleepTime for winddown)
  const sleepDate = parseTimeToday(sleepTime) || new Date();
  const bedtime = formatTime(new Date(sleepDate.getTime() - 90 * 60 * 1000));
  
  // Extract events from plan
  const scheduleItems = [...(fullDayPlan?.items || [])]
    .map(ensureStartEnd)
    .sort(compareByStartMin);

  const pastItems = scheduleItems.filter((item) => item.startMin <= nowMinutes);
  const upcomingItems = scheduleItems.filter((item) => item.startMin > nowMinutes);

  const pastMeals = pastItems.filter((item) => item.type === 'meal');
  const nextMeal = upcomingItems.find((item) => item.type === 'meal');
  const nextWalk = upcomingItems.find((item) => item.type === 'walk');
  const nextWorkout = upcomingItems.find((item) => item.type === 'workout');

  const lastMeal = pastMeals.length > 0 ? pastMeals[pastMeals.length - 1] : null;

  const lastMealTime = lastMeal ? minutesTo12h(lastMeal.startMin) : undefined;
  const lastMealType = lastMeal?.title;
  const hoursSinceLastMeal = lastMeal ? hoursSince(lastMeal.startISO) : undefined;

  const nextMealTime = nextMeal ? minutesTo12h(nextMeal.startMin) : undefined;
  const nextMealType = nextMeal?.title;
  const nextWalkTime = nextWalk ? minutesTo12h(nextWalk.startMin) : undefined;
  const nextWorkoutTime = nextWorkout ? minutesTo12h(nextWorkout.startMin) : undefined;
  
  // Build schedule preview (next 8-12 items)
  const schedulePreview = upcomingItems
    .slice(0, 12)
    .map((item: ScheduleItem) => ({
      time: minutesTo12h((item as ScheduleItem & { startMin: number }).startMin),
      title: item.title,
    }));

  const todaySchedule = scheduleItems
    .slice(0, 16)
    .map((item: ScheduleItem) => `${minutesTo12h((item as ScheduleItem & { startMin: number }).startMin)} — ${item.title}`);

  const timelineEvents = scheduleItems
    .slice(0, 20)
    .map((item: ScheduleItem) => ({
      time: minutesTo12h((item as ScheduleItem & { startMin: number }).startMin),
      title: item.title,
      type: item.type,
      status: item.status,
    }));

  const plannedCount = scheduleItems.length;
  const completedCount = (dayState?.completedEvents?.length || 0) + ((dayState?.events || []).filter((event: any) => event.status === 'DONE').length || 0);
  const momentumScore = plannedCount > 0 ? Math.max(0, Math.min(100, Math.round((completedCount / plannedCount) * 100))) : undefined;

  const signals = normalizeQuickStatusSignals((dayState as any)?.quickStatusSignals).map((signal) => QUICK_STATUS_LABELS[signal]);

  const energyForecastSummary = `Sleep ${sleepQuality}/10 · Stress ${stressLevel}/10 · Mode ${dayMode}`;
  
  return {
    now: nowISO,
    nowLocal,
    wakeTime: formatTime24(wakeTime),
    sleepTime: formatTime24(sleepTime),
    workStartTime: profile?.workStartTime,
    workEndTime: profile?.workEndTime,
    lunchTime: profile?.lunchTime,
    lunchDurationMin: profile?.lunchDurationMin,
    bedtime,
    fastingHours: preferredFastingHours,
    dayMode,
    sleepQuality,
    stressLevel,
    lastMealTime,
    lastMealType,
    hoursSinceLastMeal,
    nextMealTime,
    nextMealType,
    nextWalkTime,
    nextWorkoutTime,
    schedulePreview,
    todaySchedule,
    energyForecastSummary,
    momentumScore,
    signals,
    goal: profile?.fitnessGoal,
    dietFoundation: profile?.dietFoundation,
    timelineEvents,
  };
}

/**
 * Get the current day context as a plain object (for React components)
 * This is a hook-friendly wrapper around buildDayContext
 */
export function useDayContext(): DayContext {
  const store = usePlanStore();
  // Force update when store changes
  return buildDayContext();
}
