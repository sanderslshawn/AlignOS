import { useMemo } from 'react';
import { format } from 'date-fns';
import type { DayPlan, UserProfile } from '@physiology-engine/shared';
import { shouldPromptRefresh } from '../utils/shouldPromptRefresh';

export type TodayEntryState =
  | 'HAS_VALID_PLAN'
  | 'HAS_PLAN_BUT_INPUTS_CHANGED'
  | 'NO_PLAN'
  | 'NEEDS_REFRESH_FROM_NOW';

interface Params {
  fullDayPlan: DayPlan | null;
  profile: UserProfile | null;
  settingsFingerprint: string | null;
  staleness: 'FRESH' | 'AGING' | 'STALE' | 'CRITICAL';
}

export function getTodayEntryState(params: Params): TodayEntryState {
  const { fullDayPlan, profile, settingsFingerprint, staleness } = params;
  const todayISO = format(new Date(), 'yyyy-MM-dd');

  if (!fullDayPlan || fullDayPlan.dateISO !== todayISO) {
    return 'NO_PLAN';
  }

  if (shouldPromptRefresh(fullDayPlan, profile, settingsFingerprint, todayISO)) {
    return 'HAS_PLAN_BUT_INPUTS_CHANGED';
  }

  if (staleness === 'STALE' || staleness === 'CRITICAL') {
    return 'NEEDS_REFRESH_FROM_NOW';
  }

  return 'HAS_VALID_PLAN';
}

export function useTodayEntryState(params: Params): TodayEntryState {
  return useMemo(
    () => getTodayEntryState(params),
    [params.fullDayPlan, params.profile, params.settingsFingerprint, params.staleness]
  );
}
