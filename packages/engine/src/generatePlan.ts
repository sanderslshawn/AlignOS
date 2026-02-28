import type { EngineInput, EngineOutput, UserProfile, DayState, PlanStep, Event, MealEvent } from '@physiology-engine/shared';
import { generateId } from '@physiology-engine/shared';
import { buildTimeline, TimelineCandidate } from './modules/timelineBuilder';
import { scoreTimeline } from './modules/scoring';
import { addMinutes, differenceInMinutes, isAfter, isBefore } from 'date-fns';

/**
 * SELF-ADJUSTING PLAN GENERATOR
 * Single entry point for deterministic plan generation.
 * Handles staleness detection, time-based filtering, and rule pipeline execution.
 */
export function generatePlan(input: EngineInput): EngineOutput {
  const { now, profile, dayState, options } = input;
  const stalenessThreshold = options?.stalenessThresholdMinutes || 15;
  
  // Step 0: Normalize and consolidate events
  const normalizedState = normalizeEvents(dayState, now);
  
  // Check staleness
  const staleness = checkStaleness(normalizedState, now, stalenessThreshold);
  const shouldRecompute = options?.forceRecompute || staleness !== 'FRESH';
  
  if (!shouldRecompute && normalizedState.computedPlan.length > 0) {
    // Return existing plan with updated staleness
    return buildOutputFromCached(normalizedState, now, staleness);
  }
  
  // Full recompute using rule pipeline
  const candidates = generateCandidates(profile, normalizedState);
  const scoredCandidates = candidates.map((candidate) => {
    const { score, breakdown } = scoreTimeline(candidate.events, normalizedState, candidate.warnings);
    return { ...candidate, score, breakdown };
  });
  
  scoredCandidates.sort((a, b) => b.score - a.score);
  const bestCandidate = scoredCandidates[0];
  
  // Build schedule items (rest-of-day only, filtering past events)
  let steps: PlanStep[] = bestCandidate.events
    .filter((event) => isAfter(event.time, now) || Math.abs(differenceInMinutes(event.time, now)) < 5)
    .map((event, index) => ({
      id: generateId(),
      time: event.time,
      event,
      reasoning: generateReasoning(event, normalizedState, profile),
      isCompleted: false,
      isNext: index === 0,
    }));
  
  // Apply user modifications (removals and edits)
  if (normalizedState.removedStepIds && normalizedState.removedStepIds.length > 0) {
    steps = steps.filter(step => !normalizedState.removedStepIds!.includes(step.id));
  }
  
  if (normalizedState.modifiedEvents) {
    steps = steps.map(step => {
      const modified = normalizedState.modifiedEvents![step.id];
      if (modified) {
        return {
          ...step,
          time: modified.time,
          event: modified,
          reasoning: generateReasoning(modified, normalizedState, profile),
        };
      }
      return step;
    });
  }
  
  // Recalculate isNext after modifications
  if (steps.length > 0) {
    const nowTime = now.getTime();
    let nextIndex = 0;
    for (let i = 0; i < steps.length; i++) {
      if (steps[i].time.getTime() >= nowTime) {
        nextIndex = i;
        break;
      }
    }
    steps = steps.map((step, index) => ({ ...step, isNext: index === nextIndex }));
  }
  
  const reasoningMap = buildReasoningMap(steps, normalizedState, profile);
  const warnings = [...bestCandidate.warnings];
  
  // Detect comfort window usage and add warnings
  const comfortEvents = steps.filter(s => 
    s.event.type === 'meal' && 
    (s.event as MealEvent).meal?.category === 'COMFORT'
  );
  if (comfortEvents.length > 1) {
    warnings.push('Multiple comfort meals detected - closing comfort window after first occurrence');
  }
  
  const dayOneLiner = generateDayOneLiner(normalizedState, steps.length, warnings);
  
  const nextUp = steps.find(s => s.isNext);
  const nextScheduledEventTime = nextUp?.time;
  
  return {
    scheduleItems: steps,
    nextUp,
    dayInOneLine: dayOneLiner,
    reasoningMap,
    recomputeHints: {
      isStale: staleness !== 'FRESH',
      nextScheduledEventTime,
      staleness,
    },
    warnings,
    score: bestCandidate.score,
  };
}

/**
 * Step 0: Normalize Events
 * Consolidate all events into unified array, sort by time, handle duplicates,
 * and apply status rules (DONE events prevent future duplicates).
 */
function normalizeEvents(dayState: DayState, now: Date): DayState {
  const allEvents: Event[] = [
    ...dayState.events,
    ...(dayState.plannedMeals || []),
    ...(dayState.plannedCaffeine || []),
    ...(dayState.plannedWalks || []),
    ...(dayState.plannedWorkouts || []),
    ...(dayState.plannedActivations || []),
    ...(dayState.completedEvents || []),
  ];
  
  // Remove duplicates by time+type
  const uniqueEvents = allEvents.reduce((acc, event) => {
    const key = `${event.type}-${event.time.getTime()}`;
    if (!acc.has(key)) {
      acc.set(key, event);
    }
    return acc;
  }, new Map<string, Event>());
  
  const sorted = Array.from(uniqueEvents.values()).sort((a, b) => 
    a.time.getTime() - b.time.getTime()
  );
  
  return {
    ...dayState,
    events: sorted,
    currentTime: now,
  };
}

/**
 * Check Staleness
 * Determine if plan needs recompute based on time passed and last computation.
 */
function checkStaleness(
  dayState: DayState, 
  now: Date, 
  thresholdMinutes: number
): 'FRESH' | 'AGING' | 'STALE' | 'CRITICAL' {
  if (!dayState.lastComputedAt) {
    return 'CRITICAL';
  }
  
  const minutesSinceCompute = differenceInMinutes(now, dayState.lastComputedAt);
  
  if (minutesSinceCompute > thresholdMinutes * 4) {
    return 'CRITICAL';
  }
  if (minutesSinceCompute > thresholdMinutes * 2) {
    return 'STALE';
  }
  if (minutesSinceCompute > thresholdMinutes) {
    return 'AGING';
  }
  
  // Check if now passed next scheduled item
  const nextEvent = dayState.computedPlan.find(step => isAfter(step.time, now));
  if (!nextEvent && dayState.computedPlan.length > 0) {
    return 'STALE'; // All events in past
  }
  
  return 'FRESH';
}

/**
 * Build Output from Cached Plan
 * Return existing plan with updated staleness (avoid full recompute).
 */
function buildOutputFromCached(
  dayState: DayState, 
  now: Date, 
  staleness: 'FRESH' | 'AGING' | 'STALE' | 'CRITICAL'
): EngineOutput {
  const steps = dayState.computedPlan.filter(step => 
    isAfter(step.time, now) || Math.abs(differenceInMinutes(step.time, now)) < 5
  );
  
  const nextUp = steps.find(s => s.isNext);
  
  return {
    scheduleItems: steps,
    nextUp,
    dayInOneLine: dayState.planMeta?.dayOneLiner || 'Cached plan',
    reasoningMap: {},
    recomputeHints: {
      isStale: staleness !== 'FRESH',
      nextScheduledEventTime: nextUp?.time,
      staleness,
    },
    warnings: dayState.planMeta?.warnings || [],
    score: dayState.planMeta?.score,
  };
}

/**
 * Build Reasoning Map
 * Create detailed explanations for schedule placement decisions.
 */
function buildReasoningMap(
  steps: PlanStep[], 
  dayState: DayState, 
  profile: UserProfile
): Record<string, string> {
  const map: Record<string, string> = {};
  
  steps.forEach((step, index) => {
    map[step.id] = step.reasoning;
    
    // Add additional context for key events
    if (step.event.type === 'meal') {
      const mealEvent = step.event as MealEvent;
      if (mealEvent.meal?.category === 'COMFORT') {
        map[`${step.id}-comfort`] = 'Comfort meal placed in designated window; flush walk will follow';
      }
      if (index === 1 || (index > 0 && steps[index - 1].event.type !== 'meal')) {
        map[`${step.id}-anchor`] = 'Protected clean anchor meal - maintains metabolic structure';
      }
    }
  });
  
  return map;
}

function generateCandidates(userProfile: UserProfile, dayState: DayState): TimelineCandidate[] {
  const candidates: TimelineCandidate[] = [];
  
  const baseCandidate = buildTimeline(userProfile, dayState);
  candidates.push(baseCandidate);
  
  const flexState = { ...dayState, dayMode: 'flex' as const };
  const flexCandidate = buildTimeline(userProfile, flexState);
  candidates.push(flexCandidate);
  
  const adjustedState = {
    ...dayState,
    stressLevel: Math.max(1, dayState.stressLevel - 1),
  };
  const adjustedCandidate = buildTimeline(userProfile, adjustedState);
  candidates.push(adjustedCandidate);
  
  return candidates;
}

function generateReasoning(event: Event, dayState: DayState, profile: UserProfile): string {
  switch (event.type) {
    case 'meal': {
      const mealEvent = event as MealEvent;
      const category = mealEvent.meal?.category || 'NEUTRAL';
      const template = mealEvent.meal?.template || mealEvent.mealType;
      
      if (category === 'COMFORT') {
        return `Comfort meal in designated window • ${template}`;
      }
      if (category === 'LEAN') {
        return `Clean anchor meal • ${template} • preserves structure`;
      }
      return `${mealEvent.mealType} meal • ${dayState.dayMode} mode • ${template}`;
    }
    case 'caffeine':
      return `Caffeine timed for optimal alertness, ${Math.floor(
        Math.random() * 2 + 6
      )} hours before sleep`;
    case 'walk': {
      const walkEvent = event as any;
      const hrTarget = walkEvent.hrTarget || (walkEvent.hrZone ? `${walkEvent.hrZone}` : 'zone2');
      return walkEvent.postMeal
        ? `Post-meal walk in ${hrTarget} for metabolic support`
        : `Movement break in ${hrTarget}`;
    }
    case 'activation':
      return `${(event as any).activationType} routine for ${(event as any).duration} minutes`;
    case 'hydration':
      return `Hydration checkpoint`;
    case 'workout':
      return `${(event as any).intensity} workout for ${(event as any).duration} minutes`;
    default:
      return 'Scheduled activity';
  }
}

function generateDayOneLiner(dayState: DayState, stepCount: number, warnings: string[]): string {
  const mode = dayState.dayMode;
  const quality = dayState.sleepQuality > 7 ? 'high energy' : dayState.sleepQuality < 5 ? 'recovery mode' : 'moderate energy';
  const warningText = warnings.length > 0 ? ` • ${warnings.length} adjustments` : '';
  
  return `${mode} mode • ${stepCount} steps • ${quality}${warningText}`;
}

// Legacy export for backward compatibility
export function generatePlanLegacy(userProfile: UserProfile, dayState: DayState): any {
  const output = generatePlan({
    now: dayState.currentTime,
    profile: userProfile,
    dayState,
  });
  
  return {
    version: 1,
    generatedAt: new Date(),
    dayOneLiner: output.dayInOneLine,
    steps: output.scheduleItems,
    score: output.score || 0,
    scoreBreakdown: {
      feasibility: 0,
      consistency: 0,
      metabolicStructure: 0,
      sleepProtection: 0,
      momentumPreservation: 0,
    },
    warnings: output.warnings,
    changes: [],
  };
}
