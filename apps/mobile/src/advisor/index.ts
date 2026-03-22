/**
 * AlignOS Hybrid AI Advisor
 * 
 * A cost-optimized advisor system that combines:
 * - 100 preset questions (instant, no API cost)
 * - 5 custom LLM questions per day (metered)
 * - Unified response format
 * 
 * @module advisor
 */

// Main router (primary entry point)
export { ask, askWithOptions, getRemainingCustomQuestions, getCustomQuestionsUsedToday, presetBank } from './router';
export type { AskAdvisorOptions } from './router';

// Types (for TypeScript consumers)
export type {
  AdvisorResponse,
  Intent,
  NextMove,
  IfThen,
  Insert,
  Action,
  DayContext,
  PresetQuestion,
} from './types/advisorResponse';

// Context builder (for manual context retrieval)
export { buildDayContext, useDayContext } from './context/buildDayContext';

// Preset matching (for custom UI flows)
export { matchPreset, getRoutingDecision } from './presets/matchPreset';
export type { MatchResult, RoutingDecision } from './presets/matchPreset';

// Template rendering (for custom preset workflows)
export { renderTemplate } from './presets/renderTemplate';

// Daily limits (for displaying quota in UI)
export {
  canAskCustomQuestion,
  resetDailyLimit,
  cleanupOldLimits,
} from './limits/dailyLimit';

// LLM (for direct LLM calls if needed)
export { askLLM, createLimitExceededResponse } from './llm/askLLM';
export { buildSystemPrompt } from './llm/systemPrompt';

// Time utilities (for custom template rendering)
export {
  hoursSince,
  formatTime,
  formatTime24,
  addHoursToTime,
  addMinutesToTime,
  clampToBeforeBedtime,
  getCurrentTimeFormatted,
  getCurrentTimeISO,
} from './utils/time';
