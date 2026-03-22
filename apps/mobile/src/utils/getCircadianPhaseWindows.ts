import type { ClockTime } from '@physiology-engine/shared';
import { parseClockTime, toSortableMinutes } from './clockTime';

export interface CircadianPhaseWindow {
  key: 'activation' | 'cognitivePeak' | 'metabolicStabilization' | 'physicalOpportunity' | 'windDown';
  label: string;
  startMin: number;
  endMin: number;
}

function toMinutes(input: ClockTime | string | undefined, fallbackMin: number): number {
  if (!input) return fallbackMin;
  if (typeof input === 'string') {
    const parsed = parseClockTime(input);
    return parsed ? toSortableMinutes(parsed) : fallbackMin;
  }
  return toSortableMinutes(input);
}

function clampRange(startMin: number, endMin: number, floor: number, ceil: number): { startMin: number; endMin: number } {
  const safeStart = Math.max(floor, Math.min(startMin, ceil));
  const safeEnd = Math.max(safeStart + 5, Math.min(endMin, ceil));
  return { startMin: safeStart, endMin: safeEnd };
}

export function getCircadianPhaseWindows(wakeTime: ClockTime | string | undefined, sleepTime: ClockTime | string | undefined): CircadianPhaseWindow[] {
  const wakeMin = toMinutes(wakeTime, 7 * 60);
  const sleepMinRaw = toMinutes(sleepTime, 23 * 60);
  const sleepMin = sleepMinRaw <= wakeMin ? wakeMin + 16 * 60 : sleepMinRaw;

  const dayStart = wakeMin;
  const dayEnd = sleepMin;

  const activation = clampRange(wakeMin, wakeMin + 120, dayStart, dayEnd);
  const cognitivePeak = clampRange(wakeMin + 120, wakeMin + 360, dayStart, dayEnd);
  const metabolic = clampRange(wakeMin + 360, wakeMin + 540, dayStart, dayEnd);
  const physical = clampRange(wakeMin + 540, wakeMin + 720, dayStart, dayEnd);
  const windDown = clampRange(sleepMin - 180, sleepMin, dayStart, dayEnd);

  return [
    { key: 'activation', label: 'Activation Window', ...activation },
    { key: 'cognitivePeak', label: 'Cognitive Peak', ...cognitivePeak },
    { key: 'metabolicStabilization', label: 'Metabolic Stabilization', ...metabolic },
    { key: 'physicalOpportunity', label: 'Physical Opportunity', ...physical },
    { key: 'windDown', label: 'Wind-Down', ...windDown },
  ];
}
