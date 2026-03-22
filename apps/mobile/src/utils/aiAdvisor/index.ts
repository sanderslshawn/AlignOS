/**
 * AlignOS AI Advisor Module
 * 
 * Physiology-informed behavioral regulation engine.
 * NOT a generic chatbot — this is a circadian-aligned systems advisor.
 * 
 * Philosophy:
 * - Timing-focused (when matters more than what)
 * - Structure-focused (systems > willpower)
 * - Science-based (circadian biology, meal timing physiology, energy regulation)
 * - Calm authority (no hype, no medical claims)
 * 
 * Usage:
 * ```typescript
 * const response = await getAdvisorResponse(
 *   "When should I eat BBQ chicken?",
 *   userProfile,
 *   currentPlan,
 *   new Date(),
 *   biometrics
 * );
 * ```
 */

import type { UserProfile, DayPlan } from '@physiology-engine/shared';
import { generateResponse, type AdvisorContext, type AdvisorResponse } from './responseGenerator';
import { getContextualQuickQuestions, getQuickQuestionResponse, type QuickQuestion } from './quickQuestions';
import { KNOWLEDGE_BASE, type KnowledgeDomain, type KnowledgeEntry } from './knowledgeBase';

/**
 * Biometric context for advisor
 */
export interface BiometricContext {
  sleepScore?: number;
  stressLevel?: 'low' | 'medium' | 'high';
  hrv?: number;
  restingHeartRate?: number;
}

/**
 * Main entry point for AI Advisor
 * 
 * @param query - User's natural language question
 * @param profile - User profile (wake time, sleep time, fitness goal)
 * @param plan - Current day plan (meals, workouts, schedule)
 * @param currentTime - Current timestamp for context-aware timing
 * @param biometrics - Optional biometric data (sleep score, stress level, HRV)
 * @returns Structured advisor response
 */
export async function getAdvisorResponse(
  query: string,
  profile: UserProfile,
  plan: DayPlan | null,
  currentTime: Date = new Date(),
  biometrics?: BiometricContext
): Promise<AdvisorResponse> {
  const context: AdvisorContext = {
    query,
    profile,
    currentPlan: plan || undefined,
    currentTime,
    sleepScore: biometrics?.sleepScore,
    stressLevel: biometrics?.stressLevel,
    heartRate: biometrics?.restingHeartRate,
  };
  
  return generateResponse(context);
}

/**
 * Get contextual quick questions for current time of day
 * 
 * @param profile - User profile
 * @param currentTime - Current timestamp
 * @param limit - Number of questions to return (default: 4)
 * @returns Array of quick questions with response generators
 */
export function getQuickQuestions(
  profile: UserProfile,
  currentTime: Date = new Date(),
  limit: number = 4
): QuickQuestion[] {
  return getContextualQuickQuestions(profile, currentTime, limit);
}

/**
 * Get response for a specific quick question
 * 
 * @param questionId - ID of the quick question
 * @param profile - User profile
 * @param currentTime - Current timestamp
 * @returns Formatted response text
 */
export function getQuickAnswer(
  questionId: string,
  profile: UserProfile,
  currentTime: Date = new Date()
): string {
  return getQuickQuestionResponse(questionId, profile, currentTime);
}

/**
 * Get all knowledge entries for a specific domain
 * 
 * @param domain - Knowledge domain to retrieve
 * @returns Array of knowledge entries
 */
export function getDomainKnowledge(domain: KnowledgeDomain): KnowledgeEntry[] {
  return KNOWLEDGE_BASE[domain] || [];
}

// Export types and modules
export type { 
  AdvisorResponse, 
  AdvisorContext, 
  KnowledgeDomain, 
  KnowledgeEntry, 
  QuickQuestion 
};

export { KNOWLEDGE_BASE } from './knowledgeBase';
