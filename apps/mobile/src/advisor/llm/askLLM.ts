import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DayContext, AdvisorResponse } from '../types/advisorResponse';
import { AdvisorResponseSchema } from '../types/advisorResponse';
import { buildSystemPrompt } from './systemPrompt';

// Backend API URL (if available)
const BACKEND_API_URL = process.env.EXPO_PUBLIC_API_URL || '';
const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY || '';

// Local storage for quota tracking
const QUOTA_KEY = 'llm_quota_remaining';

/**
 * Ask the LLM (via backend or direct OpenAI) for an advisor response
 */
export async function askLLM(
  question: string,
  context: DayContext
): Promise<AdvisorResponse> {
  console.log('[Advisor][LLM] request-start', {
    apiBaseUrl: BACKEND_API_URL || '(unset)',
    hasDirectOpenAIKey: !!OPENAI_API_KEY,
    question,
  });

  // Try backend first
  if (BACKEND_API_URL) {
    try {
      console.log('[Advisor][LLM] trying-backend', { apiBaseUrl: BACKEND_API_URL });
      const response = await callBackendAPI(question, context);
      console.log('[Advisor][LLM] backend-success', {
        source: response.source,
        intent: response.intent,
      });
      return response;
    } catch (error) {
      console.warn('[Advisor][LLM] backend-failed-fallback-to-direct', {
        apiBaseUrl: BACKEND_API_URL,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  
  // Fallback to direct OpenAI
  if (OPENAI_API_KEY) {
    try {
      console.log('[Advisor][LLM] trying-direct-openai');
      const response = await callOpenAIDirect(question, context);
      console.log('[Advisor][LLM] direct-openai-success', {
        source: response.source,
        intent: response.intent,
      });
      return response;
    } catch (error) {
      console.error('[Advisor][LLM] direct-openai-failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  
  // No LLM available, return error response
  console.warn('[Advisor][LLM] unavailable-no-backend-or-direct', {
    apiBaseUrl: BACKEND_API_URL || '(unset)',
    hasDirectOpenAIKey: !!OPENAI_API_KEY,
  });
  return createErrorResponse('No LLM service available. Only preset questions are supported.');
}

/**
 * Call backend API endpoint
 */
async function callBackendAPI(
  question: string,
  context: DayContext
): Promise<AdvisorResponse> {
  // Get deviceId from storage
  const deviceId = await AsyncStorage.getItem('deviceId') || 'unknown';
  
  const response = await fetch(`${BACKEND_API_URL}/api/advisor`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      deviceId,
      message: question,
      dayContext: context,
    }),
  });
  
  if (!response.ok) {
    throw new Error(`Backend API error: ${response.status}`);
  }
  
  const data = await response.json();
  
  // Extract response and meta
  const { response: advisorResponse, meta } = data;
  
  // Update local quota tracking if meta is present
  if (meta?.llmRemaining !== undefined) {
    await AsyncStorage.setItem(QUOTA_KEY, String(meta.llmRemaining));
  }
  
  // Validate response with Zod schema
  const validated = AdvisorResponseSchema.parse(advisorResponse);
  return validated;
}

/**
 * Call OpenAI API directly
 */
async function callOpenAIDirect(
  question: string,
  context: DayContext
): Promise<AdvisorResponse> {
  const systemPrompt = buildSystemPrompt(context);
  
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: question },
      ],
      temperature: 0.7,
      max_tokens: 800,
      response_format: { type: 'json_object' },
    }),
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`OpenAI API error: ${response.status} ${JSON.stringify(errorData)}`);
  }
  
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  
  if (!content) {
    throw new Error('No content in OpenAI response');
  }
  
  // Parse JSON response
  let parsed: any;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    throw new Error('Failed to parse OpenAI response as JSON');
  }
  
  // Validate response with Zod schema
  const validated = AdvisorResponseSchema.parse(parsed);
  return validated;
}

/**
 * Create an error response when LLM is unavailable
 */
function createErrorResponse(message: string): AdvisorResponse {
  return {
    source: 'llm',
    intent: 'unknown',
    directAnswer: message,
    nextMoves: [
      { title: 'Browse preset questions', reason: 'Find common answers instantly' },
      { title: 'Check your schedule', reason: 'Review planned activities' },
      { title: 'Try rephrasing', reason: 'Use simpler terminology' },
    ],
    ifThen: [],
    confidence: 'low',
    rationale: 'LLM service unavailable, so no schedule-aware recommendation could be generated.',
    why: 'LLM service is currently unavailable. Try preset questions or check back later.',
    actions: [],
  };
}

/**
 * Create a limit exceeded response
 */
export function createLimitExceededResponse(): AdvisorResponse {
  return {
    source: 'llm',
    intent: 'unknown',
    directAnswer: 'Daily custom question limit reached (5/day). Try preset questions for instant answers.',
    nextMoves: [
      { title: 'Browse preset questions', reason: 'Instant answers for common questions' },
      { title: 'Check your schedule', reason: 'Review meal times, walks, workouts' },
      { title: 'Return tomorrow', reason: 'Daily limit resets at midnight' },
    ],
    ifThen: [
      { if: 'If urgent question', then: 'Rephrase to match preset categories (meals, caffeine, sleep, treats, workouts)' },
    ],
    confidence: 'low',
    rationale: 'Daily LLM quota reached; fallback to preset-guided support.',
    why: 'Custom questions use expensive AI processing. 5/day limit keeps costs sustainable while covering most needs via presets.',
    actions: [],
  };
}

/**
 * Get remaining LLM quota from local storage
 */
export async function getRemainingQuota(): Promise<number | null> {
  try {
    const value = await AsyncStorage.getItem(QUOTA_KEY);
    return value ? parseInt(value, 10) : null;
  } catch (error) {
    console.error('Failed to get remaining quota:', error);
    return null;
  }
}
