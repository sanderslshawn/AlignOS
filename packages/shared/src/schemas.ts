import { z } from 'zod';

// Fitness Goal
export const FitnessGoalSchema = z.enum([
  'FAT_LOSS',
  'WEIGHT_LOSS',
  'MAINTENANCE',
  'MUSCLE_GAIN',
  'PERFORMANCE',
  'GENERAL_HEALTH',
]);
export type FitnessGoal = z.infer<typeof FitnessGoalSchema>;

// Diet Foundation
export const DietFoundationSchema = z.enum([
  'BALANCED',
  'KETO',
  'CARNIVORE',
  'MEDITERRANEAN',
  'LOW_CALORIE',
  'LOW_FAT',
  'LOW_CARB',
  'HIGH_PROTEIN',
]);
export type DietFoundation = z.infer<typeof DietFoundationSchema>;

// Meal Category (for placement rules)
export const MealCategorySchema = z.enum(['LEAN', 'RICHER', 'COMFORT', 'NEUTRAL']);
export type MealCategory = z.infer<typeof MealCategorySchema>;

// Event Source
export const EventSourceSchema = z.enum(['AUTO', 'USER']);
export type EventSource = z.infer<typeof EventSourceSchema>;

// Event Status
export const EventStatusSchema = z.enum(['PLANNED', 'DONE', 'SKIPPED']);
export type EventStatus = z.infer<typeof EventStatusSchema>;

// Day Modes
export const DayModeSchema = z.enum(['tight', 'flex', 'recovery', 'high-output', 'low-output']);
export type DayMode = z.infer<typeof DayModeSchema>;

// Meal Types
export const MealTypeSchema = z.enum(['lean-protein', 'richer-protein', 'carb-heavy', 'comfort-meal']);
export type MealType = z.infer<typeof MealTypeSchema>;

// Meal Properties
const MealPropertiesSchema = z.object({
  insulinImpact: z.number().min(0).max(10),
  digestionLoad: z.number().min(0).max(10),
  comfortFlag: z.boolean(),
  inflammationRisk: z.number().min(0).max(10),
});

export { MealPropertiesSchema };
export type MealProperties = z.infer<typeof MealPropertiesSchema>;

// Caffeine Type
export const CaffeineTypeSchema = z.enum(['espresso', 'coffee', 'tea', 'pre-workout']);
export type CaffeineType = z.infer<typeof CaffeineTypeSchema>;

// HR Zone
export const HRZoneSchema = z.enum(['zone1', 'zone2', 'zone3', 'zone4', 'zone5']);
export type HRZone = z.infer<typeof HRZoneSchema>;

// Activation Routine Type
export const ActivationTypeSchema = z.enum(['pre-walk', 'pre-meal', 'midday-reset', 'night-routine', 'posture-core']);
export type ActivationType = z.infer<typeof ActivationTypeSchema>;

// Events (now with source, status, and category tracking)
export const MealEventSchema = z.object({
  type: z.literal('meal'),
  time: z.date(),
  mealType: MealTypeSchema,
  description: z.string().optional(),
  // New fields for self-adjusting behavior
  source: EventSourceSchema.default('AUTO'),
  status: EventStatusSchema.default('PLANNED'),
  originalPlannedTime: z.date().optional(),
  meal: z.object({
    category: MealCategorySchema.default('NEUTRAL'),
    template: z.string().optional(), // e.g., "protein + fibrous veg + fats"
  }).optional(),
});
export type MealEvent = z.infer<typeof MealEventSchema>;

export const CaffeineEventSchema = z.object({
  type: z.literal('caffeine'),
  time: z.date(),
  caffeineType: CaffeineTypeSchema,
  amount: z.number(),
  source: EventSourceSchema.default('AUTO'),
  status: EventStatusSchema.default('PLANNED'),
  originalPlannedTime: z.date().optional(),
});
export type CaffeineEvent = z.infer<typeof CaffeineEventSchema>;

export const WalkEventSchema = z.object({
  type: z.literal('walk'),
  time: z.date(),
  duration: z.number(),
  hrZone: HRZoneSchema.optional(),
  postMeal: z.boolean().optional(),
  source: EventSourceSchema.default('AUTO'),
  status: EventStatusSchema.default('PLANNED'),
  originalPlannedTime: z.date().optional(),
  hrTarget: z.string().optional(), // e.g., "55-65% (110-130 BPM)"
});
export type WalkEvent = z.infer<typeof WalkEventSchema>;

export const WorkoutEventSchema = z.object({
  type: z.literal('workout'),
  time: z.date(),
  duration: z.number(),
  intensity: z.enum(['light', 'moderate', 'hard', 'very-hard']),
  source: EventSourceSchema.default('AUTO'),
  status: EventStatusSchema.default('PLANNED'),
  originalPlannedTime: z.date().optional(),
});
export type WorkoutEvent = z.infer<typeof WorkoutEventSchema>;

export const ActivationEventSchema = z.object({
  type: z.literal('activation'),
  time: z.date(),
  activationType: ActivationTypeSchema,
  duration: z.number(),
  source: EventSourceSchema.default('AUTO'),
  status: EventStatusSchema.default('PLANNED'),
  originalPlannedTime: z.date().optional(),
});
export type ActivationEvent = z.infer<typeof ActivationEventSchema>;

export const HydrationEventSchema = z.object({
  type: z.literal('hydration'),
  time: z.date(),
  amount: z.number(),
  source: EventSourceSchema.default('AUTO'),
  status: EventStatusSchema.default('PLANNED'),
  originalPlannedTime: z.date().optional(),
});
export type HydrationEvent = z.infer<typeof HydrationEventSchema>;

export const EventSchema = z.discriminatedUnion('type', [
  MealEventSchema,
  CaffeineEventSchema,
  WalkEventSchema,
  WorkoutEventSchema,
  ActivationEventSchema,
  HydrationEventSchema,
]);
export type Event = z.infer<typeof EventSchema>;

// Constraint Block
export const ConstraintBlockSchema = z.object({
  start: z.date(),
  end: z.date(),
  type: z.enum(['work', 'meeting', 'social', 'travel', 'family', 'commute', 'exercise', 'appointment']),
  description: z.string().optional(),
});
export type ConstraintBlock = z.infer<typeof ConstraintBlockSchema>;

// User Profile
export const UserProfileSchema = z.object({
  wakeTime: z.string().regex(/^\d{2}:\d{2}$/),
  sleepTime: z.string().regex(/^\d{2}:\d{2}$/),
  preferredFastingHours: z.number().min(0).max(24),
  caffeineToleranceLow: z.boolean(),
  stressBaseline: z.number().min(1).max(10),
  restingHR: z.number().min(40).max(100).optional(),
  maxHR: z.number().min(100).max(220).optional(),
  defaultDayMode: DayModeSchema,
  mealSequencePreference: z.enum(['protein-first', 'carb-last', 'balanced']),
  // Fitness goal (influences plan generation)
  fitnessGoal: FitnessGoalSchema.default('MAINTENANCE'),
  // Work schedule
  workStartTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  workEndTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  commuteDuration: z.number().min(0).max(180).optional(), // minutes
  // Exercise preferences
  typicalExerciseTimes: z.array(z.string().regex(/^\d{2}:\d{2}$/)).optional(),
  exerciseDays: z.array(z.number().min(0).max(6)).optional(), // 0=Sunday, 6=Saturday
  // Diet foundation (influences meal templates, not nutrition tracking)
  dietFoundation: DietFoundationSchema.default('BALANCED'),
  // Comfort meal preferences
  allowComfortWindow: z.boolean().default(true),
  comfortWindowPreferredTime: z.string().regex(/^\d{2}:\d{2}$/).optional(), // e.g., "15:00"
  // Weekend schedule (different from weekday)
  weekendWakeTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  weekendSleepTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  weekendWorkStartTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  weekendWorkEndTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  useWeekendSchedule: z.boolean().default(false),
});
export type UserProfile = z.infer<typeof UserProfileSchema>;

// Day State (single source of truth for mobile + api)
export const DayStateSchema = z.object({
  // Identity
  deviceId: z.string(),
  dateKey: z.string(), // e.g., "2026-02-24"
  date: z.date(),
  // Current state
  dayMode: DayModeSchema,
  currentTime: z.date(),
  sleepQuality: z.number().min(1).max(10),
  stressLevel: z.number().min(1).max(10),
  currentHR: z.number().min(40).max(200).optional(),
  // All events (unified, with source/status)
  events: z.array(EventSchema).default([]),
  // Legacy planned arrays (kept for backward compatibility, will be migrated)
  plannedMeals: z.array(MealEventSchema).default([]),
  plannedCaffeine: z.array(CaffeineEventSchema).default([]),
  plannedWalks: z.array(WalkEventSchema).default([]),
  plannedWorkouts: z.array(WorkoutEventSchema).default([]),
  plannedActivations: z.array(ActivationEventSchema).default([]),
  constraints: z.array(ConstraintBlockSchema).default([]),
  completedEvents: z.array(EventSchema).default([]),
  isHungry: z.boolean().default(false),
  isCraving: z.boolean().default(false),
  // Track user modifications to generated plan
  removedStepIds: z.array(z.string()).default([]),
  modifiedEvents: z.record(z.string(), EventSchema).default({}),
  // Computed plan metadata
  lastComputedAt: z.date().optional(),
  computedPlan: z.array(PlanStepSchema).default([]),
  planMeta: z.object({
    mode: DayModeSchema.optional(),
    score: z.number().optional(),
    dayOneLiner: z.string().optional(),
    warnings: z.array(z.string()).default([]),
  }).optional(),
});
export type DayState = z.infer<typeof DayStateSchema>;

// Plan Step
export const PlanStepSchema = z.object({
  id: z.string(),
  time: z.date(),
  event: EventSchema,
  reasoning: z.string(),
  isCompleted: z.boolean().default(false),
  isNext: z.boolean().default(false),
});
export type PlanStep = z.infer<typeof PlanStepSchema>;

// Plan Output (extended with recompute hints)
export const PlanOutputSchema = z.object({
  version: z.number(),
  generatedAt: z.date(),
  dayOneLiner: z.string(),
  steps: z.array(PlanStepSchema),
  score: z.number(),
  scoreBreakdown: z.object({
    feasibility: z.number(),
    consistency: z.number(),
    metabolicStructure: z.number(),
    sleepProtection: z.number(),
    momentumPreservation: z.number(),
  }),
  warnings: z.array(z.string()),
  changes: z.array(z.string()),
  // Recompute hints for self-adjusting behavior
  recomputeHints: z.object({
    isStale: z.boolean(),
    nextScheduledEventTime: z.date().optional(),
    staleness: z.enum(['FRESH', 'AGING', 'STALE', 'CRITICAL']),
    reasoningMap: z.record(z.string(), z.string()).optional(),
  }).optional(),
});
export type PlanOutput = z.infer<typeof PlanOutputSchema>;

// Quick Update Types
export const QuickUpdateSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('delay-meal'), minutes: z.number() }),
  z.object({ action: z.literal('hungry') }),
  z.object({ action: z.literal('craving') }),
  z.object({ action: z.literal('caffeine-now') }),
  z.object({ action: z.literal('add-social-meal'), time: z.date(), mealType: MealTypeSchema }),
  z.object({ action: z.literal('workout-skipped'), workoutId: z.string() }),
  z.object({ action: z.literal('workout-added'), time: z.date(), duration: z.number(), intensity: z.string() }),
  z.object({ action: z.literal('walk-shortened'), walkId: z.string(), newDuration: z.number() }),
  z.object({ action: z.literal('walk-extended'), walkId: z.string(), newDuration: z.number() }),
  z.object({ action: z.literal('stress-spike'), newLevel: z.number() }),
]);
export type QuickUpdate = z.infer<typeof QuickUpdateSchema>;

// Demo Scenario
export const DemoScenarioSchema = z.object({
  name: z.string(),
  description: z.string(),
  userProfile: UserProfileSchema,
  dayState: DayStateSchema,
});
export type DemoScenario = z.infer<typeof DemoScenarioSchema>;

// Engine Input/Output (for deterministic core engine)
export const EngineInputSchema = z.object({
  now: z.date(),
  profile: UserProfileSchema,
  dayState: DayStateSchema,
  options: z.object({
    forceRecompute: z.boolean().default(false),
    stalenessThresholdMinutes: z.number().default(15),
  }).optional(),
});
export type EngineInput = z.infer<typeof EngineInputSchema>;

export const EngineOutputSchema = z.object({
  scheduleItems: z.array(PlanStepSchema), // rest-of-day only
  nextUp: PlanStepSchema.optional(),
  dayInOneLine: z.string(),
  reasoningMap: z.record(z.string(), z.string()),
  recomputeHints: z.object({
    isStale: z.boolean(),
    nextScheduledEventTime: z.date().optional(),
    staleness: z.enum(['FRESH', 'AGING', 'STALE', 'CRITICAL']),
  }),
  warnings: z.array(z.string()),
  score: z.number().optional(),
});
export type EngineOutput = z.infer<typeof EngineOutputSchema>;

// Schedule Item (for full-day plan generation)
export const ScheduleItemSchema = z.object({
  id: z.string(),
  type: z.enum(['wake', 'sleep', 'work', 'meal', 'workout', 'walk', 'focus', 'break', 'prep', 'meeting', 'hydration', 'stretch', 'winddown', 'custom']),
  title: z.string(),
  startISO: z.string(), // ISO datetime string
  endISO: z.string(), // ISO datetime string
  fixed: z.boolean().default(false), // locked by user or settings
  source: z.enum(['settings', 'user', 'engine']).default('engine'),
  notes: z.string().optional(),
  meta: z.record(z.any()).optional(), // flexible metadata
});
export type ScheduleItem = z.infer<typeof ScheduleItemSchema>;

// Day Plan (full day schedule)
export const DayPlanSchema = z.object({
  dateISO: z.string(), // YYYY-MM-DD
  items: z.array(ScheduleItemSchema),
  summary: z.string().optional(),
  recommendations: z.array(z.string()).optional(),
});
export type DayPlan = z.infer<typeof DayPlanSchema>;
