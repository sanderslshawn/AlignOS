import type { DayMode, ScheduleItem } from '@physiology-engine/shared';
import type { IconName } from '@physiology-engine/ui';
import type { RecommendationContext } from './recommendationContext';
import type { QuickStatusSignal } from '../types/quickStatus';

export interface MorningBriefingSection {
  label: string;
  value: string;
  icon: IconName;
}

export interface MorningBriefingOutput {
  sections: MorningBriefingSection[];
  bestMove: string;
  primaryActionLabel: 'Build Today' | 'Refresh Today';
}

export interface MorningBriefingDayContext {
  wakeTime: string;
  sleepTime: string;
  workStart?: string;
  workEnd?: string;
  lunchTime?: string;
  dayMode: DayMode | string;
  stressLevel: number;
  sleepScore: number;
  quickStatusSignals: QuickStatusSignal[];
  hasSchedule: boolean;
  timelineItems: ScheduleItem[];
  rhythmProfile?: unknown;
}

export interface MorningBriefingForecastData {
  peakHour: number;
  dipHour: number;
  confidenceLabel: 'High' | 'Med' | 'Low';
}

const normalizeHourLabel = (hour24: number): string => {
  const normalized = ((Math.round(hour24) % 24) + 24) % 24;
  const period = normalized >= 12 ? 'PM' : 'AM';
  const hour12 = (normalized % 12) || 12;
  return `${hour12} ${period}`;
};

const parseHour = (value: string | undefined, fallback: number): number => {
  if (!value) return fallback;
  const parsed = Number.parseInt(value.split(':')[0], 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const mapDayModeLabel = (mode: string): string => {
  switch (mode) {
    case 'tight':
      return 'Tight';
    case 'flex':
      return 'Flex';
    case 'recovery':
      return 'Recovery';
    case 'high-output':
      return 'High Output';
    case 'low-output':
      return 'Low Output';
    default:
      return 'Flex';
  }
};

const findMovementWindow = (items: ScheduleItem[]): string | null => {
  const movement = items.find((item) => item.type === 'workout' || item.type === 'walk');
  if (!movement) return null;

  const minutes = movement.startMin || 0;
  const startHour = Math.floor(minutes / 60);
  const endHour = Math.floor((minutes + (movement.durationMin || 30)) / 60);

  return `${normalizeHourLabel(startHour)}-${normalizeHourLabel(endHour)}`;
};

const inferBestMove = (
  dayContext: MorningBriefingDayContext,
  recommendationContext: RecommendationContext | null,
  dipHourLabel: string,
  movementWindow: string | null
): string => {
  if (dayContext.quickStatusSignals.includes('dehydrated')) {
    return 'Hydrate early and add a 5-minute reset before your dip window.';
  }

  if (dayContext.stressLevel >= 7) {
    return `Protect ${dipHourLabel} with a short walk and lighter cognitive load.`;
  }

  if (dayContext.sleepScore <= 6) {
    return 'Keep effort blocks shorter and move lunch slightly earlier.';
  }

  if (recommendationContext?.quickStatusSignals?.includes('hungry-now')) {
    return 'Use a protein-forward snack before the midday dip.';
  }

  if (movementWindow) {
    return `Keep ${movementWindow} for movement to stabilize afternoon energy.`;
  }

  return `Shift lunch a bit earlier to reduce the ${dipHourLabel} dip.`;
};

export function getMorningBriefing(
  dayContext: MorningBriefingDayContext,
  recommendationContext: RecommendationContext | null,
  forecastData: MorningBriefingForecastData
): MorningBriefingOutput {
  const wakeHour = parseHour(dayContext.wakeTime, 7);
  const sleepHour = parseHour(dayContext.sleepTime, 23);
  const workStartHour = parseHour(dayContext.workStart, wakeHour + 2);
  const workEndHour = parseHour(dayContext.workEnd, Math.max(workStartHour + 6, sleepHour - 2));
  const lunchHour = parseHour(dayContext.lunchTime, 12);
  const rhythmShift = dayContext.rhythmProfile ? 1 : 0;

  const computedFocusStartHour = Math.max(wakeHour + 1, Math.min(workStartHour + 1 + rhythmShift, forecastData.peakHour));
  const computedFocusEndHour = Math.min(workEndHour, computedFocusStartHour + 2);
  const computedDipHour = Math.max(lunchHour + 1, forecastData.dipHour);

  const focusStart = normalizeHourLabel(computedFocusStartHour);
  const focusEnd = normalizeHourLabel(computedFocusEndHour);
  const dipStart = normalizeHourLabel(computedDipHour);
  const dipEnd = normalizeHourLabel((computedDipHour + 1) % 24);
  const movementWindow = findMovementWindow(dayContext.timelineItems);

  const sections: MorningBriefingSection[] = [
    {
      label: 'Day Mode',
      value: mapDayModeLabel(dayContext.dayMode),
      icon: 'sparkles',
    },
    {
      label: 'Best Focus',
      value: `${focusStart}-${focusEnd}`,
      icon: 'focus',
    },
    {
      label: 'Energy Dip',
      value: `${dipStart}-${dipEnd}`,
      icon: 'flash',
    },
  ];

  if (movementWindow) {
    sections.push({
      label: 'Best Move Window',
      value: movementWindow,
      icon: 'walk',
    });
  }

  return {
    sections: sections.slice(0, 4),
    bestMove: inferBestMove(dayContext, recommendationContext, dipStart, movementWindow),
    primaryActionLabel: dayContext.hasSchedule ? 'Refresh Today' : 'Build Today',
  };
}
