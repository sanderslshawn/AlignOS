import type { ScheduleItem, UserProfile } from '@physiology-engine/shared';
import type { UserRhythmProfile } from './rhythmIntelligence';

export interface PrepareTomorrowInput {
  profile: UserProfile;
  rhythmProfile: UserRhythmProfile | null;
  momentumScore: number;
  todayItems: ScheduleItem[];
}

export interface TomorrowPrepOutput {
  focusWindow: string;
  dipWindow: string;
  workoutWindow: string;
  recommendations: string[];
}

const hhmmToMinutes = (value?: string): number => {
  if (!value) return 7 * 60;
  const [hourText, minuteText] = value.split(':');
  const hour = Number.parseInt(hourText || '7', 10);
  const minute = Number.parseInt(minuteText || '0', 10);
  return hour * 60 + minute;
};

const minutesToHHmm = (minutes: number): string => {
  const normalized = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const hour = Math.floor(normalized / 60);
  const minute = normalized % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
};

export function prepareTomorrowPlan(input: PrepareTomorrowInput): TomorrowPrepOutput {
  const wakeMin = hhmmToMinutes(input.profile.wakeTime);
  const focusStart = wakeMin + 60;
  const focusEnd = focusStart + 90;

  const dipStart = input.rhythmProfile?.energyCrashWindow?.split('-')[0]
    ? hhmmToMinutes(input.rhythmProfile.energyCrashWindow.split('-')[0])
    : wakeMin + 6 * 60;

  const workoutWindowMin = input.rhythmProfile?.preferredWalkTime
    ? hhmmToMinutes(input.rhythmProfile.preferredWalkTime)
    : wakeMin + 10 * 60;

  const recommendations = [
    input.momentumScore < 60
      ? 'Reduce cognitive overload blocks and protect lunch timing.'
      : 'Protect your current anchors to preserve rising momentum.',
    input.rhythmProfile?.wakeConsistency && input.rhythmProfile.wakeConsistency < 0.75
      ? 'Aim for a tighter wake window tomorrow.'
      : 'Keep your wake timing consistent for focus carryover.',
  ];

  return {
    focusWindow: `${minutesToHHmm(focusStart)}-${minutesToHHmm(focusEnd)}`,
    dipWindow: `${minutesToHHmm(dipStart)}-${minutesToHHmm(dipStart + 60)}`,
    workoutWindow: `${minutesToHHmm(workoutWindowMin)}-${minutesToHHmm(workoutWindowMin + 60)}`,
    recommendations,
  };
}
