/**
 * LLM Client for Advisor
 * Handles OpenAI API calls with proper error handling
 */

import OpenAI from 'openai';
import { z } from 'zod';
import type { DayContext, AdvisorResponse } from '../schemas/advisorSchema';
import { validateAdvisorResponse, createFallbackResponse, createFormattingFallbackResponse } from '../schemas/advisorSchema';
import { buildSystemPrompt, ADVISOR_MODEL, ADVISOR_MAX_TOKENS, ADVISOR_TEMPERATURE } from './advisorPrompt';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || ''
});

export interface LLMCallResult {
  response: AdvisorResponse;
  tokensUsed: number;
  latencyMs: number;
  error?: string;
}

/**
 * Call LLM to get advisor response
 */
export async function callLLM(
  message: string,
  context: DayContext
): Promise<LLMCallResult> {
  const startTime = Date.now();
  
  // Check API key
  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY not configured');
    return {
      response: createFallbackResponse('LLM service not configured'),
      tokensUsed: 0,
      latencyMs: Date.now() - startTime,
      error: 'Missing API key'
    };
  }
  
  try {
    const systemPrompt = buildSystemPrompt(context);
    
    const completion = await openai.chat.completions.create({
      model: ADVISOR_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ],
      temperature: ADVISOR_TEMPERATURE,
      max_tokens: ADVISOR_MAX_TOKENS,
      response_format: { type: 'json_object' }
    });
    
    const latencyMs = Date.now() - startTime;
    const content = completion.choices[0]?.message?.content;
    const tokensUsed = completion.usage?.total_tokens || 0;
    
    if (!content) {
      throw new Error('No content in LLM response');
    }
    
    // Parse JSON
    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch (error) {
      console.error('Failed to parse LLM JSON:', content);
      throw new Error('Invalid JSON from LLM');
    }
    
    // Validate with schema
    const validated = validateAdvisorResponse(parsed);
    
    return {
      response: validated,
      tokensUsed,
      latencyMs
    };
    
  } catch (error: any) {
    const latencyMs = Date.now() - startTime;
    const errorName = typeof error?.name === 'string' ? error.name : 'UnknownError';
    const errorMessage = typeof error?.message === 'string' ? error.message : String(error);
    const errorStatus = typeof error?.status === 'number' ? error.status : undefined;
    const errorCode = typeof error?.code === 'string' ? error.code : undefined;

    const isSchemaValidationError = error instanceof z.ZodError;
    const isFormattingError =
      isSchemaValidationError ||
      errorMessage.includes('Invalid JSON from LLM') ||
      errorMessage.includes('No content in LLM response');

    const isProviderFailure =
      !isFormattingError &&
      (
        typeof errorStatus === 'number' ||
        ['APIConnectionError', 'APIError', 'AuthenticationError', 'RateLimitError', 'PermissionDeniedError', 'NotFoundError', 'InternalServerError', 'TimeoutError'].includes(errorName) ||
        /rate[_ -]?limit|timeout|network|econn|enotfound|auth|model|provider/i.test(errorMessage)
      );

    console.error('[Advisor][LLM] call failed', JSON.stringify({
      errorName,
      errorMessage,
      errorStatus,
      errorCode,
      latencyMs,
      model: ADVISOR_MODEL,
      isFormattingError,
      isProviderFailure,
    }));

    if (isFormattingError) {
      return {
        response: createFormattingFallbackResponse('Response formatting drift after generation.'),
        tokensUsed: 0,
        latencyMs,
        error: errorMessage
      };
    }

    return {
      response: createFallbackResponse(
        errorMessage.includes('rate_limit')
          ? 'Rate limit reached. Try again shortly.'
          : isProviderFailure
            ? 'Service temporarily unavailable.'
            : 'Unable to complete request due to provider error.'
      ),
      tokensUsed: 0,
      latencyMs,
      error: errorMessage
    };
  }
}

/**
 * Check if LLM is available
 */
export function isLLMAvailable(): boolean {
  return !!process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.startsWith('sk-');
}
