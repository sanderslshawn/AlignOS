import type { Event, DayState } from '@physiology-engine/shared';

export interface ScoreBreakdown {
  feasibility: number;
  consistency: number;
  metabolicStructure: number;
  sleepProtection: number;
  momentumPreservation: number;
}

export function scoreTimeline(
  events: Event[],
  dayState: DayState,
  warnings: string[]
): { score: number; breakdown: ScoreBreakdown } {
  const breakdown: ScoreBreakdown = {
    feasibility: scoreFeasibility(events, dayState, warnings),
    consistency: scoreConsistency(events, dayState),
    metabolicStructure: scoreMetabolicStructure(events),
    sleepProtection: scoreSleepProtection(events, dayState),
    momentumPreservation: scoreMomentumPreservation(events, dayState),
  };
  
  const score =
    breakdown.feasibility * 0.3 +
    breakdown.consistency * 0.2 +
    breakdown.metabolicStructure * 0.25 +
    breakdown.sleepProtection * 0.15 +
    breakdown.momentumPreservation * 0.1;
  
  return { score, breakdown };
}

function scoreFeasibility(events: Event[], dayState: DayState, warnings: string[]): number {
  let score = 100;
  
  score -= warnings.length * 10;
  
  const constraints = dayState.constraints;
  const conflicts = events.filter((event) => {
    return constraints.some((constraint) => {
      return event.time >= constraint.start && event.time <= constraint.end;
    });
  });
  
  score -= conflicts.length * 15;
  
  return Math.max(0, score);
}

function scoreConsistency(events: Event[], dayState: DayState): number {
  let score = 100;
  
  const meals = events.filter((e) => e.type === 'meal');
  
  if (meals.length < 2) {
    score -= 40;
  } else if (meals.length > 5) {
    score -= 20;
  }
  
  for (let i = 1; i < meals.length; i++) {
    const spacing = (meals[i].time.getTime() - meals[i - 1].time.getTime()) / 60000;
    if (spacing < 120) {
      score -= 15;
    } else if (spacing > 360) {
      score -= 10;
    }
  }
  
  return Math.max(0, score);
}

function scoreMetabolicStructure(events: Event[]): number {
  let score = 100;
  
  const meals = events.filter((e) => e.type === 'meal');
  const walks = events.filter((e) => e.type === 'walk');
  
  if (walks.length === 0) {
    score -= 30;
  }
  
  const postMealWalks = walks.filter((walk) => {
    return meals.some((meal) => {
      const diff = (walk.time.getTime() - meal.time.getTime()) / 60000;
      return diff > 10 && diff < 90;
    });
  });
  
  const postMealWalkRatio = postMealWalks.length / meals.length;
  if (postMealWalkRatio < 0.5) {
    score -= 20;
  }
  
  return Math.max(0, score);
}

function scoreSleepProtection(events: Event[], dayState: DayState): number {
  let score = 100;
  
  if (dayState.sleepQuality <= 5) {
    score -= 20;
  }
  
  const caffeineEvents = events.filter((e) => e.type === 'caffeine');
  if (caffeineEvents.length > 0) {
    const lastCaffeine = caffeineEvents[caffeineEvents.length - 1];
    
    const hoursSinceCaffeine = 16;
    if (hoursSinceCaffeine < 6) {
      score -= 30;
    } else if (hoursSinceCaffeine < 8) {
      score -= 15;
    }
  }
  
  return Math.max(0, score);
}

function scoreMomentumPreservation(events: Event[], dayState: DayState): number {
  let score = 100;
  
  if (dayState.completedEvents.length === 0) {
    return score;
  }
  
  const completedMeals = dayState.completedEvents.filter((e) => e.type === 'meal');
  const plannedMeals = events.filter((e) => e.type === 'meal');
  
  if (completedMeals.length > 0 && plannedMeals.length === 0) {
    score -= 40;
  }
  
  return Math.max(0, score);
}
