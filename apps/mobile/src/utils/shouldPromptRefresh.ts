import type { DayPlan, UserProfile } from '@physiology-engine/shared';

export interface MajorScheduleSettings {
  wakeTime?: string;
  sleepTime?: string;
  workStartTime?: string;
  workEndTime?: string;
  lunchTime?: string;
  defaultDayMode?: string;
  fitnessGoal?: string;
}

export function getMajorSettingsFingerprint(settings: MajorScheduleSettings | null | undefined): string {
  if (!settings) return '';
  return JSON.stringify({
    wakeTime: settings.wakeTime || '',
    sleepTime: settings.sleepTime || '',
    workStartTime: settings.workStartTime || '',
    workEndTime: settings.workEndTime || '',
    lunchTime: settings.lunchTime || '',
    defaultDayMode: settings.defaultDayMode || '',
    fitnessGoal: settings.fitnessGoal || '',
  });
}

export function shouldPromptRefresh(
  existingPlan: DayPlan | null | undefined,
  currentSettings: UserProfile | null | undefined,
  storedSettingsFingerprint: string | null | undefined,
  todayISO: string
): boolean {
  if (!existingPlan || !currentSettings) return false;
  if (existingPlan.dateISO !== todayISO) return false;
  if (!storedSettingsFingerprint) return false;

  const currentFingerprint = getMajorSettingsFingerprint(currentSettings);
  return currentFingerprint !== storedSettingsFingerprint;
}
