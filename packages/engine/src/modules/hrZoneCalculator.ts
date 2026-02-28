import type { HRZone, UserProfile, DayState } from '@physiology-engine/shared';

/**
 * Calculate HR zones based on max HR
 * Zones based on % of max HR:
 * Zone 1: 50-60%
 * Zone 2: 60-70%
 * Zone 3: 70-80%
 * Zone 4: 80-90%
 * Zone 5: 90-100%
 */
export function calculateHRZones(maxHR: number) {
  return {
    zone1: { min: Math.round(maxHR * 0.5), max: Math.round(maxHR * 0.6) },
    zone2: { min: Math.round(maxHR * 0.6), max: Math.round(maxHR * 0.7) },
    zone3: { min: Math.round(maxHR * 0.7), max: Math.round(maxHR * 0.8) },
    zone4: { min: Math.round(maxHR * 0.8), max: Math.round(maxHR * 0.9) },
    zone5: { min: Math.round(maxHR * 0.9), max: maxHR },
  };
}

/**
 * Recommend HR zone based on context
 */
export function recommendHRZone(
  profile: UserProfile,
  dayState: DayState,
  isPostMeal: boolean,
  timeOfDay: 'morning' | 'midday' | 'afternoon' | 'evening'
): HRZone {
  // Post-meal walks: Zone 2 for metabolic benefit
  if (isPostMeal) {
    return 'zone2';
  }

  // High stress: Stay in Zone 1-2
  if (dayState.stressLevel >= 7) {
    return 'zone1';
  }

  // Poor sleep: Stay in Zone 1-2
  if (dayState.sleepQuality <= 5) {
    return timeOfDay === 'morning' ? 'zone1' : 'zone2';
  }

  // Recovery mode: Zone 1-2 only
  if (dayState.dayMode === 'recovery') {
    return timeOfDay === 'evening' ? 'zone1' : 'zone2';
  }

  // High-output mode: Allow higher zones if energy is good
  if (dayState.dayMode === 'high-output' && dayState.sleepQuality >= 7) {
    if (timeOfDay === 'morning' || timeOfDay === 'midday') {
      return 'zone3';
    }
    return 'zone2';
  }

  // Default: Zone 2 for most walks
  return 'zone2';
}

/**
 * Get descriptive text for HR zone
 */
export function getHRZoneDescription(zone: HRZone, maxHR?: number): string {
  const descriptions = {
    zone1: 'Easy recovery pace',
    zone2: 'Comfortable aerobic pace',
    zone3: 'Moderate steady effort',
    zone4: 'Hard tempo effort',
    zone5: 'Maximum effort',
  };

  if (maxHR) {
    const zones = calculateHRZones(maxHR);
    const range = zones[zone];
    return `${descriptions[zone]} (${range.min}-${range.max} bpm)`;
  }

  return descriptions[zone];
}
