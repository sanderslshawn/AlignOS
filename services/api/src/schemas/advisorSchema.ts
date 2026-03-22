/**
 * Advisor Response Schema & Validation
 * Strict output format for all advisor responses (preset/clarify/LLM)
 */

import { z } from 'zod';

// Intent types
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
  'unknown'
]);

export type Intent = z.infer<typeof IntentSchema>;

// Source types
export const SourceSchema = z.enum(['preset', 'clarify', 'llm']);
export type Source = z.infer<typeof SourceSchema>;

// Next move
export const NextMoveSchema = z.object({
  time: z.string().nullable(),
  title: z.string(),
  reason: z.string().nullable()
});

export type NextMove = z.infer<typeof NextMoveSchema>;

// If/Then branch
export const IfThenSchema = z.object({
  if: z.string(),
  then: z.string()
});

export type IfThen = z.infer<typeof IfThenSchema>;

// Insert recommendation
export const InsertSchema = z.object({
  type: z.string(),
  title: z.string(),
  startTime: z.string().nullable(),
  durationMin: z.number().nullable(),
  notes: z.string().nullable()
});

export type Insert = z.infer<typeof InsertSchema>;

// Action button
export const ActionSchema = z.object({
  id: z.string(),
  label: z.string(),
  payload: z.any().nullable()
});

export type Action = z.infer<typeof ActionSchema>;

// Main advisor response
export const AdvisorResponseSchema = z.object({
  source: SourceSchema,
  intent: IntentSchema,
  directAnswer: z.string().max(220),
  nextMoves: z.array(NextMoveSchema).length(3),
  ifThen: z.array(IfThenSchema).max(2),
  why: z.string(),
  rationale: z.string().optional(),
  confidence: z.enum(['high', 'medium', 'low']).optional(),
  inserts: z.array(InsertSchema).optional(),
  actions: z.array(ActionSchema),
  safetyNote: z.string().nullable().optional()
});

export type AdvisorResponse = z.infer<typeof AdvisorResponseSchema>;

// Day context (compact state for LLM prompt)
export const DayContextSchema = z.object({
  now: z.string(),
  nowLocal: z.string(),
  wakeTime: z.string(),
  sleepTime: z.string(),
  bedtime: z.string(),
  fastingHours: z.number(),
  dayMode: z.string(),
  sleepQuality: z.number(),
  stressLevel: z.number(),
  lastMealTime: z.string().optional(),
  lastMealType: z.string().optional(),
  hoursSinceLastMeal: z.number().optional(),
  nextMealTime: z.string().optional(),
  nextMealType: z.string().optional(),
  nextWalkTime: z.string().optional(),
  nextWorkoutTime: z.string().optional(),
  schedulePreview: z.array(z.object({
    time: z.string(),
    title: z.string()
  }))
});

export type DayContext = z.infer<typeof DayContextSchema>;

// API request/response wrappers
export const AdvisorRequestSchema = z.object({
  deviceId: z.string(),
  message: z.string().min(1).max(500),
  dayContext: DayContextSchema
});

export type AdvisorRequest = z.infer<typeof AdvisorRequestSchema>;

export const AdvisorApiResponseSchema = z.object({
  response: AdvisorResponseSchema,
  meta: z.object({
    llmUsedToday: z.number(),
    llmLimit: z.number(),
    llmRemaining: z.number(),
    source: SourceSchema,
    processingTimeMs: z.number(),
    tokensUsed: z.number().optional(),
    error: z.string().optional()
  })
});

export type AdvisorApiResponse = z.infer<typeof AdvisorApiResponseSchema>;

const VALID_CONFIDENCE_LEVELS = new Set(['high', 'medium', 'low']);

const PLACEHOLDER_NEXT_MOVE: NextMove = {
  title: 'Stay with current plan',
  time: '',
  reason: 'No additional move is required right now.'
};

/**
 * Normalize raw LLM payload before strict schema validation.
 */
export function normalizeAdvisorResponsePayload(
  raw: unknown,
  repairedFields: string[] = []
): Record<string, unknown> {
  const normalized: Record<string, unknown> =
    typeof raw === 'object' && raw !== null && !Array.isArray(raw)
      ? { ...(raw as Record<string, unknown>) }
      : {};

  if (normalized.rationale === null) {
    delete normalized.rationale;
    repairedFields.push('removed null rationale');
  }

  if (normalized.confidence === null) {
    delete normalized.confidence;
    repairedFields.push('removed null confidence');
  }

  if (
    typeof normalized.confidence === 'string' &&
    !VALID_CONFIDENCE_LEVELS.has(normalized.confidence)
  ) {
    delete normalized.confidence;
    repairedFields.push('removed invalid confidence');
  }

  if (!('nextMoves' in normalized) || normalized.nextMoves === undefined) {
    normalized.nextMoves = [];
  }

  if (!Array.isArray(normalized.nextMoves)) {
    normalized.nextMoves = [];
  }

  const nextMoves = [...(normalized.nextMoves as unknown[])];

  if (nextMoves.length > 3) {
    normalized.nextMoves = nextMoves.slice(0, 3);
    repairedFields.push('trimmed nextMoves');
  } else {
    const paddedMoves = [...nextMoves];
    if (paddedMoves.length < 3) {
      repairedFields.push('padded nextMoves');
      while (paddedMoves.length < 3) {
        paddedMoves.push({ ...PLACEHOLDER_NEXT_MOVE });
      }
    }
    normalized.nextMoves = paddedMoves;
  }

  return normalized;
}

/**
 * Validate and fix an advisor response
 * Returns a valid response or throws
 */
export function validateAdvisorResponse(data: any): AdvisorResponse {
  try {
    const repairedFields: string[] = [];
    const normalized = normalizeAdvisorResponsePayload(data, repairedFields);

    if (repairedFields.length > 0) {
      console.info('[Advisor][Schema] normalization repaired fields:', JSON.stringify(repairedFields));
    }

    const parsed = AdvisorResponseSchema.parse(normalized);

    if (repairedFields.length > 0) {
      console.info('[Advisor][Schema] validation passed after normalization');
    }

    return parsed;
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      const issues = error.issues.map((issue) => ({
        path: issue.path.join('.'),
        code: issue.code,
        message: issue.message,
      }));
      console.error('Invalid advisor response (schema validation failed):', JSON.stringify(issues));
      const preview = JSON.stringify(data)?.slice(0, 1200);
      console.error('Invalid advisor response payload preview:', preview);
    } else {
      const name = typeof error?.name === 'string' ? error.name : 'UnknownError';
      const message = typeof error?.message === 'string' ? error.message : String(error);
      console.error(`Invalid advisor response (${name}): ${message}`);
    }
    throw error;
  }
}

/**
 * Create a fallback response when LLM fails
 */
export function createFallbackResponse(reason: string): AdvisorResponse {
  return {
    source: 'llm',
    intent: 'unknown',
    directAnswer: `Unable to process your question right now. ${reason}`,
    nextMoves: [
      { time: null, title: 'Try a simpler question', reason: 'Use keywords like "meal", "snack", "sleep"' },
      { time: null, title: 'Check your schedule', reason: 'Review current plan for timing' },
      { time: null, title: 'Browse preset questions', reason: 'Find instant answers to common questions' }
    ],
    ifThen: [],
    confidence: 'low',
    rationale: 'Fallback response returned because the LLM response failed validation or service was unavailable.',
    why: 'The system encountered an issue processing your request. Try rephrasing or use preset questions.',
    actions: [
      { id: 'OPEN_PRESET_CATEGORY', label: 'Browse Presets', payload: null }
    ],
    safetyNote: null
  };
}

/**
 * Create a fallback response when LLM output has formatting/schema drift
 */
export function createFormattingFallbackResponse(reason: string): AdvisorResponse {
  return {
    source: 'llm',
    intent: 'unknown',
    directAnswer: 'I generated a response, but it did not match the expected format.',
    nextMoves: [
      { time: null, title: 'Try your question again', reason: 'A second attempt often returns a fully structured answer.' },
      { time: null, title: 'Ask with one clear goal', reason: 'Short, specific prompts are easier to format correctly.' },
      { time: null, title: 'Use a preset question', reason: 'Preset prompts always return a validated structure.' }
    ],
    ifThen: [],
    confidence: 'low',
    rationale: `Formatting fallback returned because output did not satisfy schema constraints. ${reason}`,
    why: 'The model responded, but the response shape could not be safely applied as-is.',
    actions: [
      { id: 'OPEN_PRESET_CATEGORY', label: 'Browse Presets', payload: null }
    ],
    safetyNote: null
  };
}

/**
 * Create a limit exceeded response
 */
export function createLimitExceededResponse(used: number, limit: number): AdvisorResponse {
  return {
    source: 'llm',
    intent: 'unknown',
    directAnswer: `Daily custom question limit reached (${used}/${limit}). Reset at midnight. Preset questions are unlimited.`,
    nextMoves: [
      { time: null, title: 'Browse preset questions', reason: 'Instant answers for common questions' },
      { time: null, title: 'Check your schedule', reason: 'Review meal times, walks, workouts' },
      { time: null, title: 'Return tomorrow', reason: 'Daily limit resets at midnight' }
    ],
    ifThen: [
      { if: 'If urgent question', then: 'Try rephrasing to match preset categories (meals, caffeine, sleep, treats)' }
    ],
    confidence: 'low',
    rationale: 'Daily LLM quota is exhausted for this device.',
    why: 'Custom questions use expensive AI processing. Daily limits keep costs sustainable while presets cover most needs.',
    actions: [
      { id: 'OPEN_PRESET_CATEGORY', label: 'Browse Presets', payload: null }
    ],
    safetyNote: null
  };
}
