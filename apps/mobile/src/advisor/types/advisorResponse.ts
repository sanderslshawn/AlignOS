/**
 * AlignOS Hybrid Advisor Response Schema
 * Unified format for preset, clarify, and LLM responses
 */

import { z } from 'zod';

export const IntentSchema = z.enum([
  'meal_timing',
  'snack',
  'comfort_meal',
  'caffeine',
  'workout',
  'sleep',
  'stress',
  'schedule_adjustment',
  'low_energy',
  'fasting',
  'unknown',
]);

export type Intent = z.infer<typeof IntentSchema>;

export const NextMoveSchema = z.object({
  time: z.string().nullable().optional(),
  title: z.string(),
  reason: z.string().nullable().optional(),
});

export const IfThenSchema = z.object({
  if: z.string(),
  then: z.string(),
});

export const InsertSchema = z.object({
  type: z.string(),
  title: z.string(),
  startTime: z.string().nullable().optional(),
  durationMin: z.number().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const ActionSchema = z.object({
  id: z.string(),
  label: z.string(),
  payload: z.any().nullable().optional(),
});

export const AdvisorResponseSchema = z.object({
  source: z.enum(['preset', 'clarify', 'llm']),
  intent: IntentSchema,
  directAnswer: z.string().max(220),
  nextMoves: z.array(NextMoveSchema).length(3),
  ifThen: z.array(IfThenSchema).max(2),
  why: z.string(),
  rationale: z.string().optional(),
  confidence: z.enum(['high', 'medium', 'low']).optional(),
  inserts: z.array(InsertSchema).optional(),
  actions: z.array(ActionSchema),
});

export type AdvisorResponse = z.infer<typeof AdvisorResponseSchema>;
export type NextMove = z.infer<typeof NextMoveSchema>;
export type IfThen = z.infer<typeof IfThenSchema>;
export type Insert = z.infer<typeof InsertSchema>;
export type Action = z.infer<typeof ActionSchema>;

/**
 * Day context for rendering templates
 */
export interface DayContext {
  now: string;
  nowLocal: string;
  wakeTime: string;
  sleepTime: string;
  workStartTime?: string;
  workEndTime?: string;
  lunchTime?: string;
  lunchDurationMin?: number;
  bedtime: string;
  fastingHours: number;
  dayMode: string;
  sleepQuality: number;
  stressLevel: number;
  lastMealTime?: string;
  lastMealType?: string;
  hoursSinceLastMeal?: number;
  nextMealTime?: string;
  nextMealType?: string;
  nextWalkTime?: string;
  nextWorkoutTime?: string;
  schedulePreview: Array<{ time: string; title: string }>;
  todaySchedule?: string[];
  energyForecastSummary?: string;
  momentumScore?: number;
  signals?: string[];
  goal?: string;
  dietFoundation?: string;
  timelineEvents?: Array<{ time: string; title: string; type?: string; status?: string }>;
}

/**
 * Preset question structure
 */
export interface PresetQuestion {
  id: string;
  title: string;
  tags: string[];
  utterances: string[];
  intent: Intent;
  answerTemplate: string;
  nextMovesTemplate: Array<{
    time?: string;
    title: string;
    reason?: string;
  }>;
  ifThenTemplate?: Array<{
    if: string;
    then: string;
  }>;
  actionsTemplate?: Array<{
    id: string;
    label: string;
    payload?: any;
  }>;
  whyTemplate: string;
  insertsTemplate?: Array<{
    type: string;
    title: string;
    startTime?: string;
    durationMin?: number;
    notes?: string;
  }>;
}
