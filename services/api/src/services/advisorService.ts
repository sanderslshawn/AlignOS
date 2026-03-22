/**
 * Advisor Service
 * Orchestrates the advisor request flow: quota check → LLM call → usage tracking
 */

import type { DayContext, AdvisorResponse, AdvisorApiResponse } from '../schemas/advisorSchema';
import { createLimitExceededResponse } from '../schemas/advisorSchema';
import { callLLM, isLLMAvailable } from './llmClient';
import { getUsageToday, incrementUsage, getRemainingQuota, getDailyLimit } from './usageStore';

export interface ProcessingMeta {
  llmUsedToday: number;
  llmLimit: number;
  llmRemaining: number;
  source: 'llm' | 'fallback';
  processingTimeMs: number;
  tokensUsed?: number;
  error?: string;
}

/**
 * Process an advisor request end-to-end
 */
export async function processAdvisorRequest(
  deviceId: string,
  message: string,
  context: DayContext
): Promise<AdvisorApiResponse> {
  const startTime = Date.now();
  
  try {
    // Check if LLM is configured
    if (!isLLMAvailable()) {
      const used = await getUsageToday(deviceId);
      const limit = getDailyLimit();
      
      return {
        response: createLimitExceededResponse(used, limit),
        meta: {
          llmUsedToday: used,
          llmLimit: limit,
          llmRemaining: 0,
          source: 'llm',
          processingTimeMs: Date.now() - startTime,
          error: 'LLM not configured'
        }
      };
    }
    
    // Check quota
    const used = await getUsageToday(deviceId);
    const remaining = await getRemainingQuota(deviceId);
    const limit = getDailyLimit();
    
    if (remaining <= 0) {
      return {
        response: createLimitExceededResponse(used, limit),
        meta: {
          llmUsedToday: used,
          llmLimit: limit,
          llmRemaining: 0,
          source: 'llm',
          processingTimeMs: Date.now() - startTime
        }
      };
    }
    
    // Call LLM
    const result = await callLLM(message, context);
    
    // If LLM succeeded, increment usage
    if (!result.error) {
      await incrementUsage(deviceId);
    }
    
    // Build response
    return {
      response: result.response,
      meta: {
        llmUsedToday: result.error ? used : used + 1,
        llmLimit: limit,
        llmRemaining: result.error ? remaining : remaining - 1,
        source: 'llm',
        processingTimeMs: Date.now() - startTime,
        tokensUsed: result.tokensUsed,
        error: result.error
      }
    };
    
  } catch (error: any) {
    console.error('Advisor service error:', error.message);
    
    const used = await getUsageToday(deviceId);
    const limit = getDailyLimit();
    
    return {
      response: createLimitExceededResponse(used, limit),
      meta: {
        llmUsedToday: used,
        llmLimit: limit,
        llmRemaining: await getRemainingQuota(deviceId),
        source: 'llm',
        processingTimeMs: Date.now() - startTime,
        error: error.message
      }
    };
  }
}
