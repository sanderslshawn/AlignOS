import type { PresetQuestion } from '../types/advisorResponse';
import presetBank from './presetBank.json';

// Synonym map to handle common variations
const SYNONYMS: Record<string, string[]> = {
  // Treat/comfort foods
  treat: ['dessert', 'candy', 'sweet', 'pudding', 'ice cream', 'chocolate', 'cookie', 'cake', 'pastry', 'donut'],
  comfort: ['cheat', 'indulgent', 'junk', 'unhealthy'],
  
  // Energy states
  tired: ['sleepy', 'exhausted', 'fatigued', 'sluggish', 'drained', 'low energy', 'crash', 'worn out'],
  energy: ['alertness', 'wakeful', 'stamina', 'vitality'],
  
  // Hunger/appetite
  hungry: ['starving', 'appetite', 'craving', 'peckish', 'famished'],
  snack: ['nibble', 'bite', 'munch', 'mini meal'],
  
  // Meals
  breakfast: ['morning meal', 'first meal', 'meal 1'],
  lunch: ['midday meal', 'meal 2', 'second meal'],
  dinner: ['evening meal', 'last meal', 'meal 3', 'supper'],
  
  // Timing
  when: ['what time', 'timing', 'schedule', 'best time'],
  should: ['can i', 'is it ok', 'allowed', 'recommended', 'optimal'],
  
  // Exercise
  workout: ['exercise', 'train', 'training', 'gym', 'lift', 'weights'],
  walk: ['walking', 'stroll', 'movement', 'steps'],
  
  // Caffeine
  coffee: ['caffeine', 'espresso', 'latte', 'americano'],
  
  // Sleep
  sleep: ['bed', 'bedtime', 'rest', 'sleeping'],
  nap: ['siesta', 'rest', 'power nap', 'catnap'],
  
  // Stress
  stress: ['anxious', 'overwhelmed', 'anxiety', 'worried', 'tense', 'pressure'],
};

/**
 * Match a user question to preset questions and return scored results
 */
export interface MatchResult {
  bestMatch: PresetQuestion | null;
  score: number;
  top3: PresetQuestion[];
}

export function matchPreset(question: string): MatchResult {
  const normalizedQuestion = normalize(question);
  const questionTokens = tokenize(normalizedQuestion);
  
  // Score each preset
  const scored = (presetBank as PresetQuestion[]).map(preset => {
    const score = scorePreset(preset, normalizedQuestion, questionTokens);
    return { preset, score };
  });
  
  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);
  
  const bestMatch = scored.length > 0 && scored[0].score > 0 ? scored[0].preset : null;
  const bestScore = scored.length > 0 ? scored[0].score : 0;
  const top3 = scored.slice(0, 3).map(s => s.preset);
  
  return {
    bestMatch,
    score: bestScore,
    top3,
  };
}

/**
 * Score how well a preset matches the question
 */
function scorePreset(
  preset: PresetQuestion,
  normalizedQuestion: string,
  questionTokens: string[]
): number {
  let score = 0;
  
  // 1. Check exact match in utterances (high weight)
  for (const utterance of preset.utterances) {
    const normalizedUtterance = normalize(utterance);
    if (normalizedUtterance === normalizedQuestion) {
      return 1.0; // Perfect match
    }
    
    // Partial exact match (substring)
    if (normalizedQuestion.includes(normalizedUtterance) || normalizedUtterance.includes(normalizedQuestion)) {
      score += 0.8;
    }
  }
  
  // 2. Check keyword overlap with utterances
  const utteranceTokens = preset.utterances.flatMap(u => tokenize(normalize(u)));
  const overlapScore = calculateOverlap(questionTokens, utteranceTokens);
  score += overlapScore * 0.6;
  
  // 3. Check keyword overlap with tags
  const tagTokens = preset.tags.flatMap(tag => tokenize(normalize(tag)));
  const tagOverlapScore = calculateOverlap(questionTokens, tagTokens);
  score += tagOverlapScore * 0.4;
  
  // 4. Check keyword overlap with title
  const titleTokens = tokenize(normalize(preset.title));
  const titleOverlapScore = calculateOverlap(questionTokens, titleTokens);
  score += titleOverlapScore * 0.5;
  
  // 5. Apply synonym matching
  const synonymScore = calculateSynonymScore(questionTokens, utteranceTokens, tagTokens, titleTokens);
  score += synonymScore * 0.3;
  
  // Normalize to 0-1 range
  return Math.min(1.0, score);
}

/**
 * Calculate token overlap ratio
 */
function calculateOverlap(tokens1: string[], tokens2: string[]): number {
  if (tokens1.length === 0 || tokens2.length === 0) return 0;
  
  const set1 = new Set(tokens1);
  const set2 = new Set(tokens2);
  
  let matches = 0;
  for (const token of set1) {
    if (set2.has(token)) {
      matches++;
    }
  }
  
  return matches / Math.max(tokens1.length, tokens2.length);
}

/**
 * Calculate synonym-based matching score
 */
function calculateSynonymScore(
  questionTokens: string[],
  utteranceTokens: string[],
  tagTokens: string[],
  titleTokens: string[]
): number {
  let synonymMatches = 0;
  const allPresetTokens = new Set([...utteranceTokens, ...tagTokens, ...titleTokens]);
  
  for (const qToken of questionTokens) {
    // Check if any synonym of this token appears in preset
    for (const [baseWord, synonyms] of Object.entries(SYNONYMS)) {
      if (qToken === baseWord || synonyms.includes(qToken)) {
        // This question token is a synonym, check if base or any synonym is in preset
        if (allPresetTokens.has(baseWord) || synonyms.some(syn => allPresetTokens.has(syn))) {
          synonymMatches++;
          break;
        }
      }
    }
  }
  
  return questionTokens.length > 0 ? synonymMatches / questionTokens.length : 0;
}

/**
 * Normalize a string: lowercase, trim, remove punctuation
 */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[?.!,;:'"]/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Tokenize a string into words
 */
function tokenize(text: string): string[] {
  return text.split(/\s+/).filter(token => token.length > 0);
}

/**
 * Get routing decision based on score
 */
export type RoutingDecision = 'preset' | 'clarify' | 'llm';

export function getRoutingDecision(score: number): RoutingDecision {
  if (score >= 0.72) return 'preset';
  if (score >= 0.45) return 'clarify';
  return 'llm';
}
