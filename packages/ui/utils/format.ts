/**
 * AlignOS Format Utilities
 * Defensive formatting to prevent NaN/undefined displays
 */

/**
 * Format percentage with fallback
 */
export function formatPercent(value: number | null | undefined, fallback: string = '—'): string {
  if (value === null || value === undefined || isNaN(value)) {
    return fallback;
  }
  return `${Math.round(value)}%`;
}

/**
 * Format number with fallback
 */
export function formatNumber(value: number | null | undefined, fallback: string = '—'): string {
  if (value === null || value === undefined || isNaN(value)) {
    return fallback;
  }
  return value.toLocaleString();
}

/**
 * Format score with fallback
 */
export function formatScore(value: number | null | undefined, max: number = 100, fallback: string = '—'): string {
  if (value === null || value === undefined || isNaN(value)) {
    return fallback;
  }
  return `${Math.round(value)}/${max}`;
}

/**
 * Format decimal with fallback
 */
export function formatDecimal(value: number | null | undefined, decimals: number = 1, fallback: string = '—'): string {
  if (value === null || value === undefined || isNaN(value)) {
    return fallback;
  }
  return value.toFixed(decimals);
}

/**
 * Safe division that returns fallback on invalid result
 */
export function safeDivide(numerator: number, denominator: number, fallback: number = 0): number {
  if (denominator === 0 || isNaN(numerator) || isNaN(denominator)) {
    return fallback;
  }
  const result = numerator / denominator;
  return isNaN(result) ? fallback : result;
}
