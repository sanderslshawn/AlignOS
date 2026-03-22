import type { DayContext, PresetQuestion, AdvisorResponse, NextMove, IfThen, Insert, Action } from '../types/advisorResponse';
import { formatTime, addHoursToTime, addMinutesToTime, parseTimeToday } from '../utils/time';

/**
 * Render a preset question template with day context data
 * Replaces all {variable} placeholders with actual values
 */
export function renderTemplate(
  preset: PresetQuestion,
  context: DayContext
): AdvisorResponse {
  // Build extended context with computed variables
  const extendedContext = buildExtendedContext(context);
  
  // Render each template field
  const directAnswer = renderString(preset.answerTemplate, extendedContext);
  const nextMoves = renderNextMoves(preset.nextMovesTemplate, extendedContext);
  const ifThen = renderIfThen(preset.ifThenTemplate || [], extendedContext);
  const why = renderString(preset.whyTemplate, extendedContext);
  const actions = [...(preset.actionsTemplate || [])];
  const inserts = preset.insertsTemplate ? renderInserts(preset.insertsTemplate, extendedContext) : undefined;

  if (inserts && inserts.length > 0 && !actions.some((action) => action.id === 'ADD_INSERTS_TO_PLAN')) {
    actions.unshift({
      id: 'ADD_INSERTS_TO_PLAN',
      label: 'Add to Plan',
      payload: { inserts },
    });
  }
  
  return {
    source: 'preset',
    intent: preset.intent,
    directAnswer: truncate(directAnswer, 220),
    nextMoves,
    ifThen,
    confidence: 'high',
    rationale: why,
    why,
    actions,
    inserts,
  };
}

/**
 * Build extended context with computed/derived variables
 */
function buildExtendedContext(context: DayContext): Record<string, string> {
  const {
    nowLocal,
    wakeTime,
    sleepTime,
    bedtime,
    fastingHours,
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
  } = context;
  
  // Computed meal timing windows
  const wakeDate = parseTimeToday(wakeTime);
  const sleepDate = parseTimeToday(sleepTime);
  
  const hoursSinceWake = wakeDate ? Math.floor((new Date().getTime() - wakeDate.getTime()) / (1000 * 60 * 60)) : 1;
  const optimalBreakfastTime = wakeDate ? formatTime(addHoursToTime(wakeDate, 1.5)) : '8:30am';
  const breakfastPrepTime = wakeDate ? formatTime(addMinutesToTime(addHoursToTime(wakeDate, 1.5), -20)) : '8:10am';
  const postBreakfastWalk = wakeDate ? formatTime(addHoursToTime(wakeDate, 2)) : '9:00am';
  
  const optimalLunchTime = wakeDate ? formatTime(addHoursToTime(wakeDate, 5.5)) : '12:30pm';
  const lunchPrepTime = wakeDate ? formatTime(addMinutesToTime(addHoursToTime(wakeDate, 5.5), -15)) : '12:15pm';
  const postLunchWalk = wakeDate ? formatTime(addHoursToTime(wakeDate, 6)) : '1:00pm';
  
  const dinnerDeadline = sleepDate ? formatTime(addHoursToTime(sleepDate, -3)) : '8:00pm';
  const optimalDinnerTime = sleepDate ? formatTime(addHoursToTime(sleepDate, -4)) : '7:00pm';
  const postDinnerWalk = sleepDate ? formatTime(addHoursToTime(sleepDate, -3.5)) : '7:30pm';
  const winddownStart = sleepDate ? formatTime(addHoursToTime(sleepDate, -1.5)) : '9:30pm';
  const bedtimePrep = sleepDate ? formatTime(addMinutesToTime(sleepDate, -90 - 10)) : bedtime;
  
  // Caffeine timing
  const firstCaffeineTime = wakeDate ? formatTime(addHoursToTime(wakeDate, 1.5)) : '8:30am';
  const secondCaffeineTime = wakeDate ? formatTime(addHoursToTime(wakeDate, 5)) : '12:00pm';
  const caffeineCutoff = sleepDate ? formatTime(addHoursToTime(sleepDate, -8)) : '3:00pm';
  const caffeineAdvice = getCaffeineAdvice(new Date(), wakeDate, sleepDate);
  
  // Workout timing
  const morningWorkout = wakeDate ? formatTime(addHoursToTime(wakeDate, 2)) : '9:00am';
  const afternoonWorkout = wakeDate ? formatTime(addHoursToTime(wakeDate, 8)) : '3:00pm';
  const workoutTime = nextWorkoutTime || morningWorkout;
  const postWorkoutMeal = workoutTime ? formatTime(addMinutesToTime(parseTimeToday(workoutTime) || new Date(), 60)) : nextMealTime || '12:00pm';
  
  // Treat/comfort meal timing
  const treatWindowStart = lastMealTime ? formatTime(addHoursToTime(parseTimeToday(lastMealTime) || new Date(), 2)) : optimalLunchTime;
  const treatWindowEnd = lastMealTime ? formatTime(addHoursToTime(parseTimeToday(lastMealTime) || new Date(), 3)) : optimalDinnerTime;
  const nextProteinMeal = nextMealTime || optimalDinnerTime;
  const postTreatWalk = treatWindowStart ? formatTime(addMinutesToTime(parseTimeToday(treatWindowStart) || new Date(), 75)) : '3:00pm';
  
  // Snack rules based on day mode
  const snackRule = getSnackRule(dayMode);
  
  // Fasting window
  const breakfastTime = optimalBreakfastTime;
  const lunchTime = optimalLunchTime;
  
  // Post-meal walk
  const postMealWalk = nextMealTime ? formatTime(addMinutesToTime(parseTimeToday(nextMealTime) || new Date(), 15)) : '1:15pm';
  
  return {
    now: context.now,
    nowLocal,
    wakeTime,
    sleepTime,
    bedtime,
    fastingHours: String(fastingHours),
    dayMode,
    sleepQuality: String(sleepQuality),
    stressLevel: String(stressLevel),
    lastMealTime: lastMealTime || 'N/A',
    lastMealType: lastMealType || 'N/A',
    hoursSinceLastMeal: hoursSinceLastMeal ? String(hoursSinceLastMeal) : 'N/A',
    nextMealTime: nextMealTime || 'N/A',
    nextMealType: nextMealType || 'N/A',
    nextWalkTime: nextWalkTime || 'N/A',
    nextWorkoutTime: nextWorkoutTime || 'N/A',
    hoursSinceWake: String(hoursSinceWake),
    optimalBreakfastTime,
    breakfastPrepTime,
    postBreakfastWalk,
    optimalLunchTime,
    lunchPrepTime,
    postLunchWalk,
    optimalDinnerTime,
    dinnerDeadline,
    postDinnerWalk,
    winddownStart,
    bedtimePrep,
    firstCaffeineTime,
    secondCaffeineTime,
    caffeineCutoff,
    caffeineAdvice,
    morningWorkout,
    afternoonWorkout,
    workoutTime,
    postWorkoutMeal,
    treatWindowStart,
    treatWindowEnd,
    nextProteinMeal,
    postTreatWalk,
    snackRule,
    breakfastTime,
    lunchTime,
    postMealWalk,
  };
}

/**
 * Replace {variables} in a string template
 */
function renderString(template: string, context: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    return context[key] || match;
  });
}

/**
 * Render NextMove array with variable substitution
 */
function renderNextMoves(templates: any[], context: Record<string, string>): NextMove[] {
  return templates.slice(0, 3).map(template => ({
    time: template.time ? renderString(template.time, context) : undefined,
    title: renderString(template.title, context),
    reason: template.reason ? renderString(template.reason, context) : undefined,
  }));
}

/**
 * Render IfThen array with variable substitution
 */
function renderIfThen(templates: any[], context: Record<string, string>): IfThen[] {
  return templates.slice(0, 2).map(template => ({
    if: renderString(template.if, context),
    then: renderString(template.then, context),
  }));
}

/**
 * Render Insert array with variable substitution
 */
function renderInserts(templates: any[], context: Record<string, string>): Insert[] {
  return templates.map(template => ({
    type: template.type,
    title: renderString(template.title, context),
    startTime: template.startTime ? renderString(template.startTime, context) : undefined,
    durationMin: template.durationMin,
    notes: template.notes ? renderString(template.notes, context) : undefined,
  }));
}

/**
 * Get snack rule based on day mode
 */
function getSnackRule(dayMode: string): string {
  switch (dayMode) {
    case 'tight':
      return 'No snacks — meals only. Tight mode optimizes for fat oxidation';
    case 'flex':
      return 'Protein-only snacks allowed if >3h since last meal';
    case 'recovery':
      return 'Flexible snacking OK — prioritize recovery over structure';
    case 'high-output':
      return 'Pre/post-workout snacks encouraged to support performance';
    case 'low-output':
      return 'Minimal snacks — low energy demand';
    default:
      return 'Standard meal spacing (no snacks)';
  }
}

/**
 * Get caffeine advice based on current time relative to wake and sleep
 */
function getCaffeineAdvice(now: Date, wakeDate: Date | undefined, sleepDate: Date | undefined): string {
  if (!wakeDate || !sleepDate) return 'Optimal caffeine window';
  
  const hoursSinceWake = (now.getTime() - wakeDate.getTime()) / (1000 * 60 * 60);
  const hoursUntilSleep = (sleepDate.getTime() - now.getTime()) / (1000 * 60 * 60);
  
  if (hoursSinceWake < 1.5) {
    return 'Too early — wait 90min after waking';
  }
  
  if (hoursUntilSleep < 8) {
    return 'Too late — past cutoff for quality sleep';
  }
  
  return 'Within optimal window';
}

/**
 * Truncate string to max length, ending at word boundary
 */
function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  
  const truncated = str.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  
  if (lastSpace > maxLength * 0.8) {
    return truncated.substring(0, lastSpace) + '...';
  }
  
  return truncated + '...';
}
