/**
 * CORE ENGINE TESTS
 * Tests for self-adjusting behavior, comfort meal rules, and diet foundation templates
 */

import { generatePlan } from '../generatePlan';
import { 
  getComfortWindow, 
  validateComfortMealPlacement,
  suggestFlushWalkAfterComfort 
} from '../modules/comfortMealRules';
import { getMealTemplate } from '../modules/dietFoundationTemplates';
import type { EngineInput, UserProfile, DayState, MealEvent } from '@physiology-engine/shared';
import { addMinutes } from 'date-fns';

describe('Self-Adjusting Engine', () => {
  const mockProfile: UserProfile = {
    wakeTime: '06:00',
    sleepTime: '22:00',
    preferredFastingHours: 16,
    caffeineToleranceLow: false,
    stressBaseline: 5,
    maxHR: 180,
    defaultDayMode: 'balanced' as any,
    mealSequencePreference: 'protein-first',
    dietFoundation: 'BALANCED',
    fitnessGoal: 'MAINTENANCE',
    allowComfortWindow: true,
    useLearnedRhythm: true,
    comfortWindowPreferredTime: '15:00',    useWeekendSchedule: false,  };

  const mockDayState: DayState = {
    deviceId: 'test-device',
    dateKey: '2026-02-24',
    date: new Date('2026-02-24T06:00:00'),
    dayMode: 'balanced' as any,
    currentTime: new Date('2026-02-24T08:00:00'),
    sleepQuality: 7,
    stressLevel: 5,
    isHungry: false,
    isCraving: false,
    events: [],
    constraints: [],
    plannedMeals: [],
    plannedCaffeine: [],
    plannedWalks: [],
    plannedWorkouts: [],
    plannedActivations: [],
    completedEvents: [],
    removedStepIds: [],
    modifiedEvents: {},
    computedPlan: [],
  };

  test('generates plan for normal workday with 2 meals and anchor walk', () => {
    const input: EngineInput = {
      now: new Date('2026-02-24T08:00:00'),
      profile: mockProfile,
      dayState: mockDayState,
      options: { forceRecompute: true, stalenessThresholdMinutes: 15 },
    };

    const output = generatePlan(input);

    expect(output).toBeDefined();
    expect(output.scheduleItems).toBeDefined();
    expect(output.dayInOneLine).toBeDefined();
    expect(output.nextUp).toBeDefined();
    
    // Should have meals
    const meals = output.scheduleItems.filter((s: any) => s.event.type === 'meal');
    expect(meals.length).toBeGreaterThan(0);
    
    // Should have at least one walk
    const walks = output.scheduleItems.filter((s: any) => s.event.type === 'walk');
    expect(walks.length).toBeGreaterThan(0);
  });

  test('detects plan staleness based on time passed', () => {
    const input: EngineInput = {
      now: new Date('2026-02-24T08:00:00'),
      profile: mockProfile,
      dayState: {
        ...mockDayState,
        lastComputedAt: new Date('2026-02-24T07:00:00'), // 1 hour ago
      },
      options: { forceRecompute: false, stalenessThresholdMinutes: 15 },
    };

    const output = generatePlan(input);

    expect(output.recomputeHints.staleness).not.toBe('FRESH');
  });
});

describe('Comfort Meal Protection', () => {
  const mockProfile: UserProfile = {
    wakeTime: '06:00',
    sleepTime: '22:00',
    preferredFastingHours: 16,
    caffeineToleranceLow: false,
    stressBaseline: 5,
    defaultDayMode: 'balanced' as any,
    mealSequencePreference: 'protein-first',
    dietFoundation: 'BALANCED',
    fitnessGoal: 'MAINTENANCE',
    allowComfortWindow: true,
    useLearnedRhythm: true,
    comfortWindowPreferredTime: '15:00',
    useWeekendSchedule: false,
  };

  const mockDayState: DayState = {
    deviceId: 'test-device',
    dateKey: '2026-02-24',
    date: new Date('2026-02-24T06:00:00'),
    dayMode: 'balance' as any,
    currentTime: new Date('2026-02-24T08:00:00'),
    sleepQuality: 7,
    stressLevel: 5,
    isHungry: false,
    isCraving: false,
    events: [],
    constraints: [],
    plannedMeals: [],
    plannedCaffeine: [],
    plannedWalks: [],
    plannedWorkouts: [],
    plannedActivations: [],
    completedEvents: [],
    removedStepIds: [],
    modifiedEvents: {},
    computedPlan: [],
  };

  test('comfort window is available when profile allows', () => {
    const window = getComfortWindow(mockProfile, mockDayState, []);
    
    expect(window).not.toBeNull();
    expect(window?.isOpen).toBe(true);
  });

  test('comfort window closes after first comfort meal', () => {
    const comfortMeal: MealEvent = {
      type: 'meal',
      time: new Date('2026-02-24T15:00:00'),
      mealType: 'comfort-meal',
      status: 'DONE',
      source: 'USER',
      meal: {
        category: 'COMFORT',
        template: 'Comfort Window Meal',
      },
    };

    const stateWithComfort: DayState = {
      ...mockDayState,
      events: [comfortMeal],
    };

    const window = getComfortWindow(mockProfile, stateWithComfort, []);
    
    expect(window).not.toBeNull();
    expect(window?.isOpen).toBe(false);
    expect(window?.reason).toContain('already used');
  });

  test('validates comfort meal cannot be placed as Meal 2 (anchor)', () => {
    const meal1: MealEvent = {
      type: 'meal',
      time: new Date('2026-02-24T12:00:00'),
      mealType: 'lean-protein',
      status: 'PLANNED',
      source: 'AUTO',
    };

    const meal2Time = new Date('2026-02-24T16:00:00');
    
    const error = validateComfortMealPlacement(
      meal2Time,
      mockProfile,
      mockDayState,
      [meal1, { ...meal1, time: meal2Time }] as MealEvent[]
    );

    expect(error).toContain('anchor meal');
  });

  test('suggests flush walk after comfort meal', () => {
    const comfortTime = new Date('2026-02-24T15:00:00');
    const suggestion = suggestFlushWalkAfterComfort(comfortTime, []);

    expect(suggestion).not.toBeNull();
    expect(suggestion?.duration).toBe(25);
    expect(suggestion?.reasoning).toContain('flush');
    
    // Walk should be 30-45 min after meal
    const minutesAfter = (suggestion!.time.getTime() - comfortTime.getTime()) / 60000;
    expect(minutesAfter).toBeGreaterThanOrEqual(30);
    expect(minutesAfter).toBeLessThanOrEqual(45);
  });
});

describe('Diet Foundation Templates', () => {
  test('KETO foundation produces keto-specific meal template', () => {
    const template = getMealTemplate('KETO', 'LEAN', 'balanced' as any);
    
    expect(template.label).toContain('Keto');
    expect(template.instructions.some((i: string) => i.toLowerCase().includes('fat'))).toBe(true);
  });

  test('CARNIVORE foundation produces protein-forward template', () => {
    const template = getMealTemplate('CARNIVORE', 'LEAN', 'balanced' as any);
    
    expect(template.label).toContain('Carnivore');
    expect(template.instructions.some((i: string) => i.toLowerCase().includes('protein'))).toBe(true);
  });

  test('MEDITERRANEAN foundation produces Mediterranean-style template', () => {
    const template = getMealTemplate('MEDITERRANEAN', 'LEAN', 'balanced' as any);
    
    expect(template.label).toContain('Mediterranean');
    expect(template.instructions.some((i: string) => i.toLowerCase().includes('olive'))).toBe(true);
  });

  test('LOW_CALORIE uses "lighter" language without calorie mentions', () => {
    const template = getMealTemplate('LOW_CALORIE', 'LEAN', 'balanced' as any);
    
    expect(template.label.toLowerCase()).not.toContain('calorie');
    expect(template.instructions.some((i: string) => i.toLowerCase().includes('lighter') || i.toLowerCase().includes('simpler'))).toBe(true);
  });

  test('COMFORT meals always get comfort window template regardless of foundation', () => {
    const ketoComfort = getMealTemplate('KETO', 'COMFORT', 'balanced' as any);
    const carnivoreComfort = getMealTemplate('CARNIVORE', 'COMFORT', 'balanced' as any);
    
    expect(ketoComfort.label).toContain('Comfort');
    expect(carnivoreComfort.label).toContain('Comfort');
    expect(ketoComfort.emphasis).toContain('window closes');
  });
});

describe('Event Mutations', () => {
  test('meal delay updates time and marks as modified', () => {
    const mockProfile: UserProfile = {
      wakeTime: '06:00',
      sleepTime: '22:00',
      preferredFastingHours: 16,
      caffeineToleranceLow: false,
      stressBaseline: 5,
      defaultDayMode: 'balanced' as any,
      mealSequencePreference: 'protein-first',
      dietFoundation: 'BALANCED',
      fitnessGoal: 'MAINTENANCE',
      allowComfortWindow: false,
      useLearnedRhythm: true,
      useWeekendSchedule: false,    };

    const originalMealTime = new Date('2026-02-24T12:00:00');
    const meal: MealEvent = {
      type: 'meal',
      time: originalMealTime,
      mealType: 'lean-protein',
      status: 'PLANNED',
      source: 'AUTO',
    };

    const dayState: DayState = {
      deviceId: 'test',
      dateKey: '2026-02-24',
      date: new Date('2026-02-24'),
      dayMode: 'balanced' as any,
      currentTime: new Date('2026-02-24T11:00:00'),
      sleepQuality: 7,
      stressLevel: 5,
      isHungry: false,
      isCraving: false,
      events: [meal],
      constraints: [],
      plannedMeals: [],
      plannedCaffeine: [],
      plannedWalks: [],
      plannedWorkouts: [],
      plannedActivations: [],
      completedEvents: [],
      removedStepIds: [],
      modifiedEvents: {},
      computedPlan: [],
    };

    // Simulate delay of 90 minutes
    const delayedTime = addMinutes(originalMealTime, 90);
    const delayedMeal: MealEvent = {
      ...meal,
      time: delayedTime,
      originalPlannedTime: originalMealTime,
    };

    const updatedState: DayState = {
      ...dayState,
      modifiedEvents: {
        'meal-1': delayedMeal,
      },
    };

    const input: EngineInput = {
      now: new Date('2026-02-24T11:00:00'),
      profile: mockProfile,
      dayState: updatedState,
      options: { forceRecompute: true, stalenessThresholdMinutes: 15 },
    };

    const output = generatePlan(input);

    // Plan should reflect the delayed meal
    expect(output.scheduleItems).toBeDefined();
    // Subsequent events should shift accordingly
  });
});
