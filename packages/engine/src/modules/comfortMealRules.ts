import type { DayState, Event, MealEvent, UserProfile, ConstraintBlock } from '@physiology-engine/shared';
import { isAfter, isBefore, addMinutes, parseISO, format } from 'date-fns';

/**
 * COMFORT MEAL PROTECTION RULES
 * Ensures comfort meals never collide with protected anchor meal (Meal 2)
 * and prevents stacking of multiple comfort/treat events.
 */

export interface ComfortWindow {
  start: Date;
  end: Date;
  isOpen: boolean;
  reason: string;
}

/**
 * Determine if comfort window is available and where it should be placed.
 * Returns null if no comfort window allowed.
 */
export function getComfortWindow(
  profile: UserProfile,
  dayState: DayState,
  constraints: ConstraintBlock[]
): ComfortWindow | null {
  if (!profile.allowComfortWindow) {
    return null;
  }
  
  // Check if comfort window already used (comfort event already exists with status DONE or PLANNED)
  const existingComfort = dayState.events.find(e => 
    e.type === 'meal' && 
    (e as MealEvent).meal?.category === 'COMFORT' &&
    (e.status === 'DONE' || e.status === 'PLANNED')
  );
  
  if (existingComfort) {
    return {
      start: existingComfort.time,
      end: addMinutes(existingComfort.time, 180), // 3 hour block after comfort
      isOpen: false,
      reason: 'Comfort window already used - closing to preserve momentum',
    };
  }
  
  // Determine comfort window timing (default mid-afternoon if not specified)
  const preferredTime = profile.comfortWindowPreferredTime || '15:00';
  const [hours, minutes] = preferredTime.split(':').map(Number);
  
  const baseDate = dayState.date;
  const windowStart = new Date(baseDate);
  windowStart.setHours(hours, minutes, 0, 0);
  
  // Window is 2 hours long
  const windowEnd = addMinutes(windowStart, 120);
  
  // Check if window conflicts with constraints
  const hasConflict = constraints.some(c => 
    (isAfter(c.start, windowStart) && isBefore(c.start, windowEnd)) ||
    (isAfter(c.end, windowStart) && isBefore(c.end, windowEnd)) ||
    (isBefore(c.start, windowStart) && isAfter(c.end, windowEnd))
  );
  
  if (hasConflict) {
    // Try to shift window earlier or later
    const shiftedStart = addMinutes(windowStart, -60);
    const shiftedEnd = addMinutes(shiftedStart, 120);
    
    const hasShiftedConflict = constraints.some(c => 
      (isAfter(c.start, shiftedStart) && isBefore(c.start, shiftedEnd)) ||
      (isAfter(c.end, shiftedStart) && isBefore(c.end, shiftedEnd))
    );
    
    if (!hasShiftedConflict) {
      return {
        start: shiftedStart,
        end: shiftedEnd,
        isOpen: true,
        reason: 'Comfort window available (shifted to avoid conflicts)',
      };
    }
    
    return null; // No viable window
  }
  
  return {
    start: windowStart,
    end: windowEnd,
    isOpen: true,
    reason: 'Comfort window available',
  };
}

/**
 * Check if a comfort meal can be placed at proposed time.
 * Returns error message if not allowed, null if OK.
 */
export function validateComfortMealPlacement(
  proposedTime: Date,
  profile: UserProfile,
  dayState: DayState,
  allMeals: MealEvent[]
): string | null {
  // Rule 1: Only one comfort meal per day
  const existingComfort = dayState.events.find(e => 
    e.type === 'meal' && 
    (e as MealEvent).meal?.category === 'COMFORT' &&
    e.status !== 'SKIPPED'
  );
  
  if (existingComfort) {
    return 'Comfort window already used today - closing to maintain momentum';
  }
  
  // Rule 2: Comfort cannot be Meal 2 (anchor meal)
  // Assume Meal 2 is the second scheduled meal of the day
  const sortedMeals = [...allMeals].sort((a, b) => a.time.getTime() - b.time.getTime());
  if (sortedMeals.length >= 2) {
    const meal2 = sortedMeals[1];
    const timeDiff = Math.abs(proposedTime.getTime() - meal2.time.getTime());
    
    if (timeDiff < 30 * 60 * 1000) { // Within 30 minutes
      return 'Cannot use comfort meal as anchor meal (Meal 2) - must be clean/lean';
    }
  }
  
  // Rule 3: Must be within comfort window if profile restricts it
  const window = getComfortWindow(profile, dayState, dayState.constraints);
  if (window && !window.isOpen) {
    return window.reason;
  }
  
  if (window && window.isOpen) {
    if (isBefore(proposedTime, window.start) || isAfter(proposedTime, window.end)) {
      return `Comfort meals must be within designated window (${format(window.start, 'HH:mm')} - ${format(window.end, 'HH:mm')})`;
    }
  }
  
  return null; // OK to place
}

/**
 * Suggest flush walk after comfort meal to help "close the window"
 * and smooth afternoon energy.
 */
export function suggestFlushWalkAfterComfort(
  comfortMealTime: Date,
  constraints: ConstraintBlock[]
): { time: Date; duration: number; reasoning: string } | null {
  // Suggest walk 30-45 minutes after comfort meal
  const walkTime = addMinutes(comfortMealTime, 35);
  const walkEnd = addMinutes(walkTime, 25); // 25-minute flush walk
  
  // Check if conflicts with constraints
  const hasConflict = constraints.some(c => 
    (isAfter(c.start, walkTime) && isBefore(c.start, walkEnd)) ||
    (isAfter(c.end, walkTime) && isBefore(c.end, walkEnd)) ||
    (isBefore(c.start, walkTime) && isAfter(c.end, walkEnd))
  );
  
  if (hasConflict) {
    return null; // Can't fit walk, skip suggestion
  }
  
  return {
    time: walkTime,
    duration: 25,
    reasoning: 'Flush walk after comfort meal - helps close window and smooth energy',
  };
}

/**
 * Block additional comfort events within N hours of existing comfort.
 * Returns true if should block.
 */
export function shouldBlockComfortStacking(
  proposedTime: Date,
  existingComfortTime: Date,
  blockWindowHours: number = 3
): boolean {
  const timeDiff = Math.abs(proposedTime.getTime() - existingComfortTime.getTime());
  const blockWindowMs = blockWindowHours * 60 * 60 * 1000;
  
  return timeDiff < blockWindowMs;
}
