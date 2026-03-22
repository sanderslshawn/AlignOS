import type { UserProfile } from '@physiology-engine/shared';
import { formatClockTime, parseClockTime, toSortableMinutes } from '../utils/clockTime';

export type FeatureExplanation = {
  id: 'instant-plan-optimization' | 'science-backed-timing' | 'progress-insights' | 'achievement-tracking';
  icon: 'sparkles' | 'focus' | 'chart' | 'trophy';
  label: string;
  title: string;
  description: string;
  bullets: string[];
  closing: string;
};

const formatMinuteRange = (startMin: number, endMin: number): string => {
  const normalizedStart = ((Math.round(startMin) % (24 * 60)) + (24 * 60)) % (24 * 60);
  const normalizedEnd = ((Math.round(endMin) % (24 * 60)) + (24 * 60)) % (24 * 60);

  const startClock = {
    hour: (Math.floor(normalizedStart / 60) % 12) || 12,
    minute: normalizedStart % 60,
    period: Math.floor(normalizedStart / 60) >= 12 ? ('PM' as const) : ('AM' as const),
  };
  const endClock = {
    hour: (Math.floor(normalizedEnd / 60) % 12) || 12,
    minute: normalizedEnd % 60,
    period: Math.floor(normalizedEnd / 60) >= 12 ? ('PM' as const) : ('AM' as const),
  };

  return `${formatClockTime(startClock)}–${formatClockTime(endClock)}`;
};

const resolveWakeMinutes = (profile?: UserProfile | null): number => {
  const wakeClock = parseClockTime(profile?.wakeClockTime || profile?.wakeTime || null);
  if (wakeClock) return toSortableMinutes(wakeClock);
  return 6 * 60;
};

export function getSystemStatus(profile?: UserProfile | null): string[] {
  const wakeMinutes = resolveWakeMinutes(profile);
  const wakeHour = Math.floor(wakeMinutes / 60);

  const rhythmMessage = wakeHour <= 6
    ? 'Circadian rhythm stabilizing early'
    : wakeHour >= 9
      ? 'Circadian rhythm adapting for a later start'
      : 'Circadian rhythm stabilizing';

  return [
    rhythmMessage,
    'Energy forecast ready',
    'Plan optimized',
  ];
}

export function getTodayInsight(profile?: UserProfile | null): { title: string; subtitle: string } {
  const wakeMinutes = resolveWakeMinutes(profile);
  const focusStartMin = wakeMinutes + 60;
  const focusEndMin = focusStartMin + 90;

  return {
    title: 'Your best focus window today',
    subtitle: formatMinuteRange(focusStartMin, focusEndMin),
  };
}

export const FEATURE_EXPLANATIONS: FeatureExplanation[] = [
  {
    id: 'instant-plan-optimization',
    icon: 'sparkles',
    label: 'Instant plan optimization',
    title: 'Instant Plan Optimization',
    description: 'AlignOS continuously adjusts your schedule based on real-world physiology and your day context.',
    bullets: [
      'circadian rhythm',
      'energy patterns',
      'recovery signals',
      'meal timing',
      'unexpected changes',
    ],
    closing: 'Your plan evolves throughout the day.',
  },
  {
    id: 'science-backed-timing',
    icon: 'focus',
    label: 'Science-backed timing',
    title: 'Science-Backed Timing',
    description: 'Each block is placed to align effort, recovery, and nutrition with your biological timing.',
    bullets: [
      'sleep-wake rhythm alignment',
      'focus and energy windows',
      'caffeine and meal spacing',
      'movement and reset cadence',
    ],
    closing: 'Timing decisions are built for consistency and momentum.',
  },
  {
    id: 'progress-insights',
    icon: 'chart',
    label: 'Progress insights',
    title: 'Progress Insights',
    description: 'AlignOS highlights the patterns that drive better days so you can improve with less guesswork.',
    bullets: [
      'completion consistency',
      'energy trend shifts',
      'recovery quality signals',
      'schedule adherence drift',
    ],
    closing: 'Small adjustments compound into more stable performance.',
  },
  {
    id: 'achievement-tracking',
    icon: 'trophy',
    label: 'Achievement tracking',
    title: 'Achievement Tracking',
    description: 'Progress streaks and milestones reward consistency while preserving flexibility.',
    bullets: [
      'daily momentum streaks',
      'habit completion markers',
      'adaptive consistency goals',
      'recovery-balanced wins',
    ],
    closing: 'You keep momentum even when the day changes.',
  },
];
