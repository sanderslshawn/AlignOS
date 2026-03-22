export interface ScheduleConfidenceInput {
  anchorStability: number;
  sleepConsistency: number;
  mealConsistency: number;
  scheduleDensity: number;
  overlapCount: number;
  driftRisk: number;
}

export interface ScheduleConfidenceOutput {
  score: number;
  label: 'High confidence' | 'Moderate confidence' | 'Fragile plan';
}

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

export function calculateScheduleConfidence(input: ScheduleConfidenceInput): ScheduleConfidenceOutput {
  const anchor = clamp(input.anchorStability, 0, 1);
  const sleep = clamp(input.sleepConsistency, 0, 1);
  const meal = clamp(input.mealConsistency, 0, 1);
  const density = clamp(input.scheduleDensity, 0, 1);
  const overlapPenalty = clamp(input.overlapCount / 6, 0, 1);
  const driftPenalty = clamp(input.driftRisk, 0, 1);

  const weighted =
    anchor * 0.28 +
    sleep * 0.2 +
    meal * 0.2 +
    density * 0.12 +
    (1 - overlapPenalty) * 0.1 +
    (1 - driftPenalty) * 0.1;

  const score = Math.round(clamp(weighted * 100, 0, 100));

  if (score >= 75) return { score, label: 'High confidence' };
  if (score >= 50) return { score, label: 'Moderate confidence' };
  return { score, label: 'Fragile plan' };
}
