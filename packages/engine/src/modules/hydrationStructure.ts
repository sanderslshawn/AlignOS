import { addMinutes } from 'date-fns';
import type { UserProfile, DayState, Event } from '@physiology-engine/shared';
import { parseTimeString } from '@physiology-engine/shared';

export interface HydrationEvent {
  time: Date;
  amount: number;
  reasoning: string;
}

export function generateHydrationSchedule(
  profile: UserProfile,
  dayState: DayState,
  meals: Event[]
): HydrationEvent[] {
  const wakeTime = parseTimeString(profile.wakeTime, dayState.date);
const sleepTime = parseTimeString(profile.sleepTime, dayState.date);
  
  const schedule: HydrationEvent[] = [];
  
  schedule.push({
    time: addMinutes(wakeTime, 15),
    amount: 500,
    reasoning: 'Morning hydration to break overnight fast',
  });
  
  const mealEvents = meals.filter((e) => e.type === 'meal');
  mealEvents.forEach((meal) => {
    schedule.push({
      time: addMinutes(meal.time, -30),
      amount: 300,
      reasoning: 'Pre-meal hydration',
    });
  });
  
  const midDay = addMinutes(wakeTime, (differenceInMinutes(sleepTime, wakeTime) / 2));
  schedule.push({
    time: midDay,
    amount: 400,
    reasoning: 'Midday hydration checkpoint',
  });
  
  schedule.push({
    time: addMinutes(sleepTime, -120),
    amount: 250,
    reasoning: 'Evening hydration (reduced to minimize sleep disruption)',
  });
  
  return schedule.sort((a, b) => a.time.getTime() - b.time.getTime());
}

function differenceInMinutes(end: Date, start: Date): number {
  return (end.getTime() - start.getTime()) / 60000;
}
