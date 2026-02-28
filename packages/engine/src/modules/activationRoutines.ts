import type { ActivationType } from '@physiology-engine/shared';
import { addMinutes } from 'date-fns';

export function getActivationDuration(type: ActivationType): number {
  switch (type) {
    case 'pre-walk':
      return 5;
    case 'pre-meal':
      return 3;
    case 'midday-reset':
      return 8;
    case 'night-routine':
      return 10;
    case 'posture-core':
      return 7;
  }
}

export function shouldAddPreWalkActivation(walkDuration: number, dayMode: string): boolean {
  if (dayMode === 'recovery' || dayMode === 'low-output') {
    return false;
  }
  
  return walkDuration >= 20;
}

export function shouldAddPreMealActivation(stressLevel: number, mealType: string): boolean {
  if (stressLevel >= 7) {
    return true;
  }
  
  if (mealType === 'comfort-meal') {
    return true;
  }
  
  return false;
}

export function getMiddayResetTime(wakeTime: Date, sleepTime: Date): Date {
  const totalMinutes = (sleepTime.getTime() - wakeTime.getTime()) / 60000;
  const middayOffset = totalMinutes / 2;
  
  return addMinutes(wakeTime, middayOffset);
}

export function getNightRoutineTime(sleepTime: Date): Date {
  return addMinutes(sleepTime, -30);
}
