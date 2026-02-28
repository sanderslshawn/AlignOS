import type { MealType, MealProperties } from '@physiology-engine/shared';

export function classifyMeal(mealType: MealType): MealProperties {
  switch (mealType) {
    case 'lean-protein':
      return {
        insulinImpact: 2,
        digestionLoad: 3,
        comfortFlag: false,
        inflammationRisk: 1,
      };
    case 'richer-protein':
      return {
        insulinImpact: 4,
        digestionLoad: 6,
        comfortFlag: false,
        inflammationRisk: 3,
      };
    case 'carb-heavy':
      return {
        insulinImpact: 8,
        digestionLoad: 5,
        comfortFlag: false,
        inflammationRisk: 5,
      };
    case 'comfort-meal':
      return {
        insulinImpact: 9,
        digestionLoad: 8,
        comfortFlag: true,
        inflammationRisk: 7,
      };
  }
}

export function shouldSequenceProteinFirst(dayMode: string, stressLevel: number): boolean {
  if (dayMode === 'high-output' || dayMode === 'tight') {
    return true;
  }
  if (stressLevel >= 7) {
    return true;
  }
  return false;
}

export function shouldSequenceCarbLast(dayMode: string, sleepQuality: number): boolean {
  if (dayMode === 'recovery') {
    return false;
  }
  if (sleepQuality <= 5) {
    return false;
  }
  return true;
}
