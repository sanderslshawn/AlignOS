// AlignOS Format Utilities
// Never show NaN, undefined, or null in UI

/**
 * Format a number safely - returns "—" if invalid
 */
export function formatNumber(value: number | null | undefined, decimals: number = 0): string {
  if (value === null || value === undefined || isNaN(value) || !isFinite(value)) {
    return '—';
  }
  return value.toFixed(decimals);
}

/**
 * Format a percentage safely - returns "—" if invalid
 */
export function formatPercent(value: number | null | undefined, decimals: number = 0): string {
  if (value === null || value === undefined || isNaN(value) || !isFinite(value)) {
    return '—';
  }
  return `${value.toFixed(decimals)}%`;
}

/**
 * Format time safely in HH:MM format
 */
export function formatTime(date: Date | string | null | undefined): string {
  if (!date) return '—';
  
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return '—';
    
    const hours = d.getHours().toString().padStart(2, '0');
    const minutes = d.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  } catch {
    return '—';
  }
}

/**
 * Format time in 12-hour format with AM/PM
 */
export function formatTime12Hour(date: Date | string | null | undefined): string {
  if (!date) return '—';
  
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return '—';
    
    let hours = d.getHours();
    const minutes = d.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    
    return `${hours}:${minutes} ${ampm}`;
  } catch {
    return '—';
  }
}

/**
 * Format duration in minutes
 */
export function formatDuration(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || isNaN(minutes) || !isFinite(minutes)) {
    return '—';
  }
  
  if (minutes < 60) {
    return `${Math.round(minutes)}m`;
  }
  
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  
  if (mins === 0) {
    return `${hours}h`;
  }
  
  return `${hours}h ${mins}m`;
}

/**
 * Format a score out of 100
 */
export function formatScore(score: number | null | undefined): string {
  return formatNumber(score, 0);
}

/**
 * Safely get a string value
 */
export function safeString(value: string | null | undefined, fallback: string = '—'): string {
  return value || fallback;
}
