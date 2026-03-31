import type { AdvisorResponse } from './types/advisorResponse';
import type { PresetQuestion } from './types/advisorResponse';
import { buildDayContext } from './context/buildDayContext';
import { matchPreset, getRoutingDecision } from './presets/matchPreset';
import { renderTemplate } from './presets/renderTemplate';
import { canAskCustomQuestion, incrementCustomUsed, cleanupOldLimits } from './limits/dailyLimit';
import { askLLM, createLimitExceededResponse } from './llm/askLLM';
import presetBankData from './presets/presetBank.json';

export type AskAdvisorOptions = {
  forcePreset?: boolean;
  requestSource?: 'starter-prompt' | 'free-text';
  context?: any;
};

const presetBank = presetBankData as PresetQuestion[];

function normalize(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[?.!,;:'"]/g, '')
    .replace(/\s+/g, ' ');
}

function findDirectPresetMatch(question: string): PresetQuestion | null {
  const normalizedQuestion = normalize(question);
  for (const preset of presetBank) {
    if (normalize(preset.title) === normalizedQuestion) {
      return preset;
    }

    if (preset.utterances.some((utterance) => normalize(utterance) === normalizedQuestion)) {
      return preset;
    }
  }

  return null;
}

/**
 * Main advisor router
 * Handles the complete flow: context → matching → clarify/preset/LLM
 */
export async function ask(question: string, options?: AskAdvisorOptions): Promise<AdvisorResponse> {
  return askWithOptions(question, options);
}

export async function askWithOptions(question: string, options?: AskAdvisorOptions): Promise<AdvisorResponse> {
  // Clean up old limit keys periodically (async, don't block)
  cleanupOldLimits().catch(err => console.warn('Failed to clean up old limits:', err));
  
  // Step 1: Build current day context (allow caller-provided context override)
  const context = options?.context ?? buildDayContext();
  const hasBackendApi = Boolean((process.env.EXPO_PUBLIC_API_URL || '').trim());

  if (options?.forcePreset) {
    const directPreset = findDirectPresetMatch(question);
    if (directPreset) {
      console.log('[Advisor][Router] forced-starter-preset', {
        requestText: question,
        requestSource: options.requestSource || 'free-text',
        forcePreset: true,
        presetMatched: true,
        llmFallbackAttempted: false,
        finalResponseSource: 'preset',
        title: directPreset.title,
      });
      return renderTemplate(directPreset, context);
    }

    const forcedMatch = matchPreset(question);
    if (forcedMatch.bestMatch) {
      console.log('[Advisor][Router] force-preset-best-match', {
        requestText: question,
        requestSource: options.requestSource || 'free-text',
        forcePreset: true,
        presetMatched: true,
        llmFallbackAttempted: false,
        finalResponseSource: 'preset',
        matchScore: Number(forcedMatch.score.toFixed(3)),
        bestPresetTitle: forcedMatch.bestMatch.title,
      });
      return renderTemplate(forcedMatch.bestMatch, context);
    }
  }
  
  // Step 2: Match against preset bank
  const { bestMatch, score, top3 } = matchPreset(question);
  const decision = getRoutingDecision(score);

  console.log('[Advisor][Router] route-decision', {
    requestText: question,
    requestSource: options?.requestSource || 'free-text',
    forcePreset: !!options?.forcePreset,
    matchScore: Number(score.toFixed(3)),
    decision,
    presetMatched: !!bestMatch,
    llmFallbackAttempted: decision === 'llm',
    bestPresetTitle: bestMatch?.title || null,
    finalResponseSource: decision === 'preset' ? 'preset' : decision === 'clarify' ? 'clarify' : 'llm',
  });
  
  // Step 3: Route based on score
  switch (decision) {
    case 'preset':
      // High confidence match — use preset template
      if (!bestMatch) {
        // Shouldn't happen, but fail gracefully
        return createClarifyResponse(top3, question);
      }
      console.log('[Advisor][Router] using-preset', { title: bestMatch.title });
      return renderTemplate(bestMatch, context);
    
    case 'clarify':
      // Medium confidence — offer suggestions
      console.log('[Advisor][Router] clarify-needed', { suggestions: top3.slice(0, 3).map((preset) => preset.title) });
      return createClarifyResponse(top3, question);
    
    case 'llm':
      // Low confidence — call LLM if quota available
      console.log('[Advisor][Router] routing-to-llm');
      
      // Check local daily limit only when no backend API is configured.
      // When backend exists, backend-side limits are the source of truth.
      if (!hasBackendApi) {
        const canAsk = await canAskCustomQuestion();
        if (!canAsk) {
          console.log('[Advisor][Router] llm-limit-exceeded');
          return createLimitExceededResponse();
        }
      }
      
      // Call LLM
      try {
        const response = await askLLM(question, context);
        console.log('[Advisor][Router] llm-response', {
          source: response.source,
          intent: response.intent,
          llmFallbackAttempted: true,
        });

        // Increment usage counter only for successful custom LLM answers
        if (response.source === 'llm' && response.intent !== 'unknown') {
          await incrementCustomUsed();
        }
        
        return response;
      } catch (error) {
        console.error('[Advisor][Router] llm-call-failed', error);
        // Return clarify as fallback
        return createClarifyResponse(top3, question);
      }
  }
}

/**
 * Create a clarify response with top 3 suggestions
 */
function createClarifyResponse(
  top3: any[],
  originalQuestion: string
): AdvisorResponse {
  const suggestions = top3.map(preset => preset.title);
  
  return {
    source: 'clarify',
    intent: 'unknown',
    directAnswer: `Did you mean one of these? Tap a suggestion or rephrase your question for a custom answer.`,
    nextMoves: suggestions.slice(0, 3).map(title => ({
      title,
      reason: 'Tap to get instant answer',
    })),
    ifThen: [
      {
        if: 'None of these match',
        then: 'Rephrase your question or use different keywords',
      },
    ],
    rationale: `Question was not a high-confidence preset match: "${originalQuestion.slice(0, 80)}"`,
    confidence: 'low',
    why: 'Your question is ambiguous. Pick a suggestion for an instant preset answer, or rephrase for a custom AI response.',
    actions: [],
  };
}

/**
 * Export helper to get remaining custom questions (for UI display)
 */
export { getRemainingCustomQuestions, getCustomQuestionsUsedToday } from './limits/dailyLimit';

/**
 * Export preset bank for browsing UI (optional feature)
 */
export { default as presetBank } from './presets/presetBank.json';
