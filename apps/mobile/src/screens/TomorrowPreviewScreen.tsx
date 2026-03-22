import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DayPlan, ScheduleItem, UserProfile } from '@physiology-engine/shared';
import { addDays, format } from 'date-fns';
import { usePlanStore } from '../store/planStore';
import { getApiBaseUrl } from '../utils/apiBaseUrl';
import { minutesTo12h, minutesToHHmm, parseTimeToMinutes } from '../utils/time';
import { buildTimelinePlan } from '../utils/planGenerator';
import { toISOWithClockTime } from '../utils/clockTime';
import { loadRhythmProfile, type UserRhythmProfile } from '../engine/rhythmIntelligence';
import { generatePredictiveDay, type PredictiveDayOutput } from '../engine/predictiveDay';
import { buildRecommendationContext } from '../utils/recommendationContext';
import { generateRecommendationsFromContext } from '../utils/recommendationEngine';
import { useTheme, Card, PrimaryButton, SecondaryButton, AppIcon } from '@physiology-engine/ui';
import TooltipModal from '../components/help/TooltipModal';
import WhyThisModal from '../components/help/WhyThisModal';
import { useFeatureDiscovery } from '../hooks/useFeatureDiscovery';
import { groupTomorrowItemsBySection } from '../utils/groupTomorrowItemsBySection';
import { calculateScheduleConfidence } from '../utils/calculateScheduleConfidence';
import { dedupeBehaviorBlocks } from '../utils/dedupeBehaviorBlocks';

interface TomorrowPayload {
  dateKey?: string;
  dateISO?: string;
  wakeTime: string;
  sleepTime: string;
  workStartTime?: string;
  workEndTime?: string;
  anchors: Array<{ title: string; time: string }>;
  suggestions?: string[];
  items?: ScheduleItem[];
  predictive?: PredictiveDayOutput;
}

function itemDateISO(item: Pick<ScheduleItem, 'startISO'>, fallbackDateISO: string): string {
  if (typeof item.startISO === 'string' && item.startISO.includes('T')) {
    return item.startISO.split('T')[0];
  }
  return fallbackDateISO;
}

function sortByStart(items: ScheduleItem[]): ScheduleItem[] {
  return [...items].sort((left, right) => (left.startMin || 0) - (right.startMin || 0));
}

function dedupeTomorrowItems(items: ScheduleItem[], dateISO: string): ScheduleItem[] {
  const dayItems = items.filter((i) => itemDateISO(i, dateISO) === dateISO);
  return dedupeBehaviorBlocks(sortByStart(dayItems), { dateISO });
}

function sanitizePreviewPayload(payload: TomorrowPayload, dateISO: string): TomorrowPayload {
  const sanitizedItems = dedupeTomorrowItems(payload.items || [], dateISO);

  const anchors = sanitizedItems
    .filter(
      (item) =>
        item.type === 'wake' ||
        item.type === 'work' ||
        item.type === 'lunch' ||
        item.type === 'meal' ||
        item.type === 'snack' ||
        item.type === 'walk' ||
        item.type === 'workout' ||
        item.type === 'sleep'
    )
    .slice(0, 10)
    .map((item) => ({
      title: item.title,
      time: minutesToHHmm(item.startMin || 0),
    }));

  return {
    ...payload,
    dateISO,
    items: sanitizedItems,
    anchors,
  };
}

const hasFunctionalPreviewData = (payload: TomorrowPayload | null | undefined, dateISO: string): payload is TomorrowPayload => {
  return !!payload && Array.isArray(payload.items) && payload.items.filter((item) => itemDateISO(item, dateISO) === dateISO).length > 0;
};

function inferMomentumScoreFromToday(plan: DayPlan | null): number {
  if (!plan?.items?.length) return 72;
  const actionable = plan.items.filter((item) => item.type !== 'wake' && item.type !== 'sleep');
  if (!actionable.length) return 72;
  const completed = actionable.filter((item) => item.status === 'actual' || item.origin === 'actual').length;
  const skipped = actionable.filter((item) => item.status === 'skipped').length;
  const raw = 75 + completed * 4 - skipped * 6;
  return Math.max(25, Math.min(95, raw));
}

function inferMealConsistencyFromToday(plan: DayPlan | null): number {
  if (!plan?.items?.length) return 0.7;
  const meals = plan.items.filter((item) => item.type === 'meal' || item.type === 'lunch' || item.type === 'snack');
  if (meals.length < 2) return 0.7;
  const sorted = [...meals].sort((a, b) => (a.startMin || 0) - (b.startMin || 0));
  const gaps: number[] = [];
  for (let index = 1; index < sorted.length; index++) {
    gaps.push((sorted[index].startMin || 0) - (sorted[index - 1].startMin || 0));
  }
  const avgGap = gaps.reduce((sum, value) => sum + value, 0) / gaps.length;
  const spread = gaps.reduce((sum, value) => sum + Math.abs(value - avgGap), 0) / gaps.length;
  return Math.max(0.2, Math.min(1, 1 - spread / 180));
}

function mapPlanToPreviewWithContext(
  plan: DayPlan,
  profile: UserProfile,
  context: {
    dayState?: { dayMode?: string; stressLevel?: number; sleepQuality?: number } | null;
    rhythmProfile?: UserRhythmProfile | null;
    momentumScore?: number;
    todayPlan?: DayPlan | null;
  }
): TomorrowPayload {
  const recommendationContext = buildRecommendationContext({
    dateISO: plan.dateISO,
    profile,
    dayState: null,
    plan,
    todayEntries: plan.items,
  });

  const recommendationOutput = generateRecommendationsFromContext(recommendationContext);
  const tomorrowOnlyItems = dedupeTomorrowItems(plan.items || [], plan.dateISO);

  const anchors = tomorrowOnlyItems
    .filter(
      (item) =>
        item.type === 'wake' ||
        item.type === 'work' ||
        item.type === 'lunch' ||
        item.type === 'meal' ||
        item.type === 'snack' ||
        item.type === 'workout' ||
        item.type === 'walk' ||
        item.type === 'sleep'
    )
    .slice(0, 10)
    .map((item) => ({
      title: item.title,
      time: minutesToHHmm(item.startMin || 0),
    }));

  const mealAnchors = anchors.filter((anchor) => /meal|lunch|snack/i.test(anchor.title));
  const todayItems = context.todayPlan?.items || [];
  const todayActionable = todayItems.filter((item) => item.type !== 'wake' && item.type !== 'sleep');
  const completed = todayActionable.filter((item) => item.status === 'actual' || item.origin === 'actual').length;
  const skipped = todayActionable.filter((item) => item.status === 'skipped').length;
  const completionRate = todayActionable.length ? completed / todayActionable.length : 0.72;

  const predictive = generatePredictiveDay({
    wakeTime: profile.wakeTime,
    sleepTime: profile.sleepTime,
    workSchedule: {
      start: profile.workStartTime,
      end: profile.workEndTime,
    },
    mealTimes: {
      firstMeal: mealAnchors[0]?.time,
      lunch: mealAnchors.find((anchor) => /lunch/i.test(anchor.title))?.time || mealAnchors[1]?.time,
      dinner: mealAnchors[2]?.time,
    },
    rhythmProfile: context.rhythmProfile,
    momentumScore: context.momentumScore,
    stressLevel: context.dayState?.stressLevel,
    sleepScore: context.dayState?.sleepQuality,
    fitnessGoal: profile.fitnessGoal,
    dayMode: (context.dayState?.dayMode as UserProfile['defaultDayMode']) || profile.defaultDayMode,
    dietFoundation: profile.dietFoundation,
    mealSequence: profile.mealSequencePreference,
    completionRate,
    skippedItems: skipped,
    fastingHours: profile.preferredFastingHours,
    mealTimingConsistency: inferMealConsistencyFromToday(context.todayPlan || null),
    rhythmStability: context.rhythmProfile?.wakeConsistency,
  });

  return {
    dateISO: plan.dateISO,
    wakeTime: profile.wakeTime,
    sleepTime: profile.sleepTime,
    workStartTime: profile.workStartTime,
    workEndTime: profile.workEndTime,
    anchors,
    suggestions: recommendationOutput.cards.length ? recommendationOutput.cards : plan.recommendations || [],
    items: tomorrowOnlyItems,
    predictive,
  };
}

function mapPlanToPreview(
  plan: DayPlan,
  profile: UserProfile,
  context?: {
    dayState?: { dayMode?: string; stressLevel?: number; sleepQuality?: number } | null;
    rhythmProfile?: UserRhythmProfile | null;
    momentumScore?: number;
    todayPlan?: DayPlan | null;
  }
): TomorrowPayload {
  return mapPlanToPreviewWithContext(plan, profile, context || {});
}

function withPredictive(
  payload: TomorrowPayload,
  profile: UserProfile,
  context: {
    dayState?: { dayMode?: string; stressLevel?: number; sleepQuality?: number } | null;
    rhythmProfile?: UserRhythmProfile | null;
    momentumScore?: number;
    todayPlan?: DayPlan | null;
  }
): TomorrowPayload {
  if (payload.predictive) return payload;

  const pseudoPlan: DayPlan = {
    dateISO: payload.dateISO || format(addDays(new Date(), 1), 'yyyy-MM-dd'),
    items: dedupeTomorrowItems(payload.items || [], payload.dateISO || format(addDays(new Date(), 1), 'yyyy-MM-dd')),
    recommendations: payload.suggestions || [],
    summary: 'Tomorrow preview',
  } as DayPlan;

  return mapPlanToPreviewWithContext(pseudoPlan, profile, context);
}

export default function TomorrowPreviewScreen() {
  const { colors, typography, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const { getTomorrowPreview, deviceId, profile, fullDayPlan, dayState } = usePlanStore();
  const API_BASE_URL = getApiBaseUrl();

  const [preview, setPreview] = useState<TomorrowPayload | null>(null);
  const [rhythmProfile, setRhythmProfile] = useState<UserRhythmProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [showWhyThis, setShowWhyThis] = useState(false);
  const discovery = useFeatureDiscovery('predictive-day', 3);

  const tomorrowDateISO = format(addDays(new Date(), 1), 'yyyy-MM-dd');
  const tomorrowStorageKey = `tomorrowPreview_${tomorrowDateISO}`;

  const toDisplayTime = (value?: string) => {
    const parsed = parseTimeToMinutes(value);
    if (parsed === null) return value || '';
    return minutesTo12h(parsed);
  };

  const sections = useMemo(
    () => groupTomorrowItemsBySection(preview?.items || [], tomorrowDateISO),
    [preview?.items, tomorrowDateISO]
  );

  const confidence = useMemo(() => {
    const items = preview?.items || [];
    if (!items.length) {
      return calculateScheduleConfidence({
        anchorStability: 0.72,
        sleepConsistency: rhythmProfile?.wakeConsistency ?? 0.7,
        mealConsistency: 0.7,
        scheduleDensity: 0.6,
        overlapCount: 0,
        driftRisk: 0.35,
      });
    }

    const actionable = items.filter((item) => item.type !== 'wake' && item.type !== 'sleep');
    let overlapCount = 0;
    const sorted = [...items].sort((a, b) => (a.startMin || 0) - (b.startMin || 0));
    for (let i = 1; i < sorted.length; i++) {
      const prevEnd = sorted[i - 1].endMin || ((sorted[i - 1].startMin || 0) + (sorted[i - 1].durationMin || 5));
      const currentStart = sorted[i].startMin || 0;
      if (currentStart < prevEnd) overlapCount += 1;
    }

    const mealConsistency = inferMealConsistencyFromToday(fullDayPlan);
    const density = Math.min(1, actionable.length / 10);
    const driftRisk = Math.min(1, ((dayState?.stressLevel || 5) / 10) * 0.5 + (1 - mealConsistency) * 0.5);

    return calculateScheduleConfidence({
      anchorStability: 0.8,
      sleepConsistency: rhythmProfile?.wakeConsistency ?? 0.72,
      mealConsistency,
      scheduleDensity: density,
      overlapCount,
      driftRisk,
    });
  }, [preview?.items, rhythmProfile?.wakeConsistency, fullDayPlan, dayState?.stressLevel]);

  const getFallbackPreview = async () => {
    if (!profile) {
      const fallback = await getTomorrowPreview();
      setPreview(sanitizePreviewPayload(fallback, tomorrowDateISO));
      return;
    }

    const generated = buildTimelinePlan({
      dateISO: tomorrowDateISO,
      settings: profile,
      todayEntries: [],
      constraints: dayState?.constraints,
      plannedMeals: dayState?.plannedMeals,
      plannedWorkouts: dayState?.plannedWorkouts,
      mutationIntent: 'GENERATE_TOMORROW',
      baseItems: [],
    });

    const fallback = mapPlanToPreview(generated, profile, {
      dayState,
      rhythmProfile,
      momentumScore: inferMomentumScoreFromToday(fullDayPlan),
      todayPlan: fullDayPlan,
    });

    setPreview(sanitizePreviewPayload(fallback, tomorrowDateISO));
  };

  const fetchWithTimeout = async (url: string, init?: RequestInit, timeoutMs = 5000) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timeoutId);
    }
  };

  const syncPreviewToApi = async (payload: TomorrowPayload) => {
    if (!deviceId) return;
    await fetchWithTimeout(`${API_BASE_URL}/day/${deviceId}/tomorrow/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile, preview: payload }),
    });
  };

  const loadPreview = async () => {
    setIsLoading(true);
    try {
      const localRhythm = await loadRhythmProfile(deviceId);
      setRhythmProfile(localRhythm);

      const localSaved = await AsyncStorage.getItem(tomorrowStorageKey);
      if (localSaved) {
        const payload = sanitizePreviewPayload(JSON.parse(localSaved) as TomorrowPayload, tomorrowDateISO);
        if (!payload.predictive && profile) {
          const refreshed = withPredictive(payload, profile, {
            dayState,
            rhythmProfile: localRhythm,
            momentumScore: inferMomentumScoreFromToday(fullDayPlan),
            todayPlan: fullDayPlan,
          });
          const sanitized = sanitizePreviewPayload(refreshed, tomorrowDateISO);
          setPreview(sanitized);
          await AsyncStorage.setItem(tomorrowStorageKey, JSON.stringify(sanitized));
        } else {
          setPreview(payload);
        }
        return;
      }

      if (deviceId) {
        const response = await fetchWithTimeout(`${API_BASE_URL}/day/${deviceId}/tomorrow`);
        if (response.ok) {
          const payload = sanitizePreviewPayload((await response.json()) as TomorrowPayload, tomorrowDateISO);
          if (hasFunctionalPreviewData(payload, tomorrowDateISO)) {
            const hydrated = profile
              ? withPredictive(payload, profile, {
                  dayState,
                  rhythmProfile: localRhythm,
                  momentumScore: inferMomentumScoreFromToday(fullDayPlan),
                  todayPlan: fullDayPlan,
                })
              : payload;
            const sanitized = sanitizePreviewPayload(hydrated, tomorrowDateISO);
            setPreview(sanitized);
            await AsyncStorage.setItem(tomorrowStorageKey, JSON.stringify(sanitized));
            return;
          }
        }
      }

      await getFallbackPreview();
    } catch (error) {
      console.warn('[TomorrowPreview] Failed to load API preview, using local fallback', error);
      await getFallbackPreview();
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateTomorrow = async () => {
    if (!profile) {
      await getFallbackPreview();
      return;
    }

    setIsLoading(true);
    try {
      const generatedPlan = buildTimelinePlan({
        dateISO: tomorrowDateISO,
        settings: profile,
        todayEntries: [],
        constraints: dayState?.constraints,
        plannedMeals: dayState?.plannedMeals,
        plannedWorkouts: dayState?.plannedWorkouts,
        mutationIntent: 'GENERATE_TOMORROW',
        baseItems: [],
      });

      const localPayload = sanitizePreviewPayload(
        mapPlanToPreview(generatedPlan, profile, {
          dayState,
          rhythmProfile,
          momentumScore: inferMomentumScoreFromToday(fullDayPlan),
          todayPlan: fullDayPlan,
        }),
        tomorrowDateISO
      );

      setPreview(localPayload);
      await AsyncStorage.setItem(tomorrowStorageKey, JSON.stringify(localPayload));

      if (deviceId) {
        await syncPreviewToApi(localPayload);
      }
    } catch (error) {
      console.warn('[TomorrowPreview] Generate API unavailable, using local fallback', error);
      await getFallbackPreview();
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyTodayStructure = async () => {
    if (!profile || !fullDayPlan) return;

    const wakeMin = parseTimeToMinutes(profile.wakeTime) ?? 420;
    const sleepMin = parseTimeToMinutes(profile.sleepTime) ?? 1380;
    const todayWakeMin = fullDayPlan.items.find((item) => item.type === 'wake')?.startMin ?? wakeMin;
    const offsetFromTodayWake = wakeMin - todayWakeMin;

    const copyable = fullDayPlan.items.filter((item) => {
      const itemDay = itemDateISO(item, fullDayPlan.dateISO || format(new Date(), 'yyyy-MM-dd'));
      return itemDay === (fullDayPlan.dateISO || format(new Date(), 'yyyy-MM-dd')) && item.type !== 'wake' && item.type !== 'sleep';
    });

    const copiedEntries: ScheduleItem[] = copyable.map((item) => {
      const rawStart = (item.startMin ?? wakeMin) + offsetFromTodayWake;
      const duration = Math.max(5, item.durationMin || ((item.endMin ?? rawStart + 5) - rawStart));
      const clampedStart = Math.max(wakeMin + 5, Math.min(rawStart, sleepMin - duration - 5));
      const clampedEnd = clampedStart + duration;

      const startHour24 = Math.floor(clampedStart / 60);
      const startMinute = clampedStart % 60;
      const endHour24 = Math.floor(clampedEnd / 60);
      const endMinute = clampedEnd % 60;

      const startClock = {
        hour: (startHour24 % 12) || 12,
        minute: startMinute,
        period: (startHour24 >= 12 ? 'PM' : 'AM') as 'AM' | 'PM',
      };
      const endClock = {
        hour: (endHour24 % 12) || 12,
        minute: endMinute,
        period: (endHour24 >= 12 ? 'PM' : 'AM') as 'AM' | 'PM',
      };

      return {
        ...item,
        id: `tomorrow-copy-${item.id}`,
        startMin: clampedStart,
        endMin: clampedEnd,
        durationMin: duration,
        startTime: startClock,
        endTime: endClock,
        startISO: toISOWithClockTime(`${tomorrowDateISO}T00:00:00.000Z`, startClock),
        endISO: toISOWithClockTime(`${tomorrowDateISO}T00:00:00.000Z`, endClock),
        source: 'user',
        status: 'planned',
        fixed: false,
        locked: false,
        deletable: item.type !== 'wake' && item.type !== 'sleep',
      } as ScheduleItem;
    });

    const generatedPlan = buildTimelinePlan({
      dateISO: tomorrowDateISO,
      settings: profile,
      todayEntries: [],
      constraints: dayState?.constraints,
      plannedMeals: dayState?.plannedMeals,
      plannedWorkouts: dayState?.plannedWorkouts,
      mutationIntent: 'COPY_TODAY_STRUCTURE',
      baseItems: copiedEntries,
    });

    const localPayload = sanitizePreviewPayload(
      mapPlanToPreview(generatedPlan, profile, {
        dayState,
        rhythmProfile,
        momentumScore: inferMomentumScoreFromToday(fullDayPlan),
        todayPlan: fullDayPlan,
      }),
      tomorrowDateISO
    );

    setPreview(localPayload);
    await AsyncStorage.setItem(tomorrowStorageKey, JSON.stringify(localPayload));

    if (deviceId) {
      try {
        await syncPreviewToApi(localPayload);
      } catch (error) {
        console.warn('[TomorrowPreview] Failed to sync copied structure to API; local preview is saved', error);
      }
    }
  };

  useEffect(() => {
    void loadPreview();
  }, []);

  const renderSection = (title: string, items: ScheduleItem[]) => {
    if (!items.length) return null;

    return (
      <View style={{ marginTop: spacing.md }}>
        <Text style={[typography.bodyM, { color: colors.textSecondary, fontWeight: '600', marginBottom: spacing.xs }]}>{title}</Text>
        {items.map((item) => (
          <Text key={item.id} style={[typography.bodyM, { color: colors.textMuted, marginBottom: 4 }]}>
            • {minutesTo12h(item.startMin || 0)} {item.title}
          </Text>
        ))}
      </View>
    );
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}
    >
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
          <AppIcon name="calendar" size={18} color={colors.textPrimary} />
          <Text style={[typography.titleM, { color: colors.textPrimary, marginLeft: spacing.sm }]}>Tomorrow Preview</Text>
          <Text onPress={() => setShowTooltip(true)} style={[typography.caption, { color: colors.accentPrimary, marginLeft: spacing.sm }]}>?</Text>
        </View>

        {discovery.shouldShow(1) ? (
          <Card>
            <Text style={[typography.caption, { color: colors.textSecondary }]}>
              Predictive Day estimates your best windows tomorrow based on today’s completion, rhythm stability, and anchors.
            </Text>
            <Text
              onPress={() => void discovery.advanceLevel()}
              style={[typography.caption, { color: colors.accentPrimary, marginTop: spacing.xs }]}
            >
              Dismiss
            </Text>
          </Card>
        ) : null}

        {preview ? (
          <>
            <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.sm }]}>Predicted Day</Text>

            <View style={styles.predictiveGrid}>
              <View style={[styles.predictiveCell, { borderColor: colors.borderSubtle, backgroundColor: colors.surface }]}>
                <Text style={[typography.caption, { color: colors.textMuted }]}>Predicted Day Mode</Text>
                <Text style={[typography.bodyM, { color: colors.textPrimary, fontWeight: '700', marginTop: 2 }]}>
                  {preview.predictive?.predictedDayMode || 'Balanced Execution Day'}
                </Text>
              </View>
              <View style={[styles.predictiveCell, { borderColor: colors.borderSubtle, backgroundColor: colors.surface }]}>
                <Text style={[typography.caption, { color: colors.textMuted }]}>Tomorrow Plan Confidence</Text>
                <Text style={[typography.bodyM, { color: colors.textPrimary, fontWeight: '700', marginTop: 2 }]}>
                  {confidence.score}/100 · {confidence.label}
                </Text>
              </View>
              <View style={[styles.predictiveCell, { borderColor: colors.borderSubtle, backgroundColor: colors.surface }]}>
                <Text style={[typography.caption, { color: colors.textMuted }]}>Best Focus Window</Text>
                <Text style={[typography.bodyM, { color: colors.textPrimary, fontWeight: '700', marginTop: 2 }]}>
                  {preview.predictive?.bestFocusWindow || '7:00 AM-8:30 AM'}
                </Text>
              </View>
              <View style={[styles.predictiveCell, { borderColor: colors.borderSubtle, backgroundColor: colors.surface }]}>
                <Text style={[typography.caption, { color: colors.textMuted }]}>Likely Dip</Text>
                <Text style={[typography.bodyM, { color: colors.textPrimary, fontWeight: '700', marginTop: 2 }]}>
                  {preview.predictive?.likelyDipWindow || '1:00 PM'}
                </Text>
              </View>
            </View>

            {preview.predictive?.estimatedEnergyCurve?.length ? (
              <View style={[styles.bestMoveCard, { borderColor: colors.borderSubtle, backgroundColor: colors.surface }]}>
                <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.xs }]}>Estimated Energy Curve</Text>
                <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
                  {preview.predictive.estimatedEnergyCurve.map((value, index) => (
                    <View
                      key={`energy-${index}`}
                      style={{
                        flex: 1,
                        marginRight: index === preview.predictive!.estimatedEnergyCurve!.length - 1 ? 0 : 4,
                        height: 6 + Math.round((value / 100) * 34),
                        borderRadius: 6,
                        backgroundColor: colors.accentPrimary,
                        opacity: 0.25 + value / 150,
                      }}
                    />
                  ))}
                </View>
              </View>
            ) : null}

            <View style={[styles.bestMoveCard, { borderColor: colors.borderSubtle, backgroundColor: colors.surface }]}>
              <Text style={[typography.caption, { color: colors.textMuted }]}>Best Move</Text>
              <Text style={[typography.bodyM, { color: colors.textPrimary, marginTop: 4 }]}>
                {preview.predictive?.bestMove || 'Keep lunch on time and add a short post-meal walk'}
              </Text>
              <Text onPress={() => setShowWhyThis(true)} style={[typography.caption, { color: colors.accentPrimary, marginTop: 6 }]}>
                Why this?
              </Text>
              {preview.predictive?.topRisk ? (
                <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 6 }]}>
                  {preview.predictive.topRisk}
                </Text>
              ) : null}
            </View>

            <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.md, marginBottom: spacing.xs }]}>Tomorrow Anchors</Text>
            <Text style={[typography.bodyM, { color: colors.textSecondary, marginBottom: spacing.xs }]}>Wake: {toDisplayTime(preview.wakeTime)}</Text>
            <Text style={[typography.bodyM, { color: colors.textSecondary, marginBottom: spacing.sm }]}>Sleep: {toDisplayTime(preview.sleepTime)}</Text>
            {preview.workStartTime && preview.workEndTime ? (
              <Text style={[typography.bodyM, { color: colors.textSecondary, marginBottom: spacing.sm }]}>
                Work: {toDisplayTime(preview.workStartTime)} - {toDisplayTime(preview.workEndTime)}
              </Text>
            ) : null}

            {preview.anchors.slice(0, 8).map((anchor, index) => (
              <Text
                key={`${anchor.title}-${index}`}
                style={[typography.bodyM, { color: colors.textMuted, marginBottom: 4 }]}
              >
                • {toDisplayTime(anchor.time)} {anchor.title}
              </Text>
            ))}

            {renderSection('Morning', sections.morning)}
            {renderSection('Midday', sections.midday)}
            {renderSection('Afternoon', sections.afternoon)}
            {renderSection('Evening', sections.evening)}

            {preview.suggestions?.length ? (
              <View style={{ marginTop: spacing.md }}>
                <Text style={[typography.bodyM, { color: colors.textSecondary, fontWeight: '600', marginBottom: spacing.xs }]}>Tomorrow suggestions</Text>
                {preview.suggestions.slice(0, 4).map((suggestion, index) => (
                  <Text key={`${suggestion}-${index}`} style={[typography.bodyM, { color: colors.textMuted, marginBottom: 4 }]}>• {suggestion}</Text>
                ))}
              </View>
            ) : null}
          </>
        ) : (
          <Text style={[typography.bodyM, { color: colors.textMuted }]}>Loading preview...</Text>
        )}

        <PrimaryButton onPress={handleGenerateTomorrow} style={{ marginTop: spacing.lg }}>
          {isLoading ? 'Generating...' : 'Generate Tomorrow Plan'}
        </PrimaryButton>
        <SecondaryButton onPress={handleCopyTodayStructure} style={{ marginTop: spacing.sm }}>
          Copy Today Structure
        </SecondaryButton>
      </Card>

      <TooltipModal
        visible={showTooltip}
        onClose={() => setShowTooltip(false)}
        title="Predictive Day"
        description="This section projects likely day mode, focus windows, confidence, and dip risk for tomorrow from your rhythm and completion patterns."
      />

      <WhyThisModal
        visible={showWhyThis}
        onClose={() => setShowWhyThis(false)}
        title="Best Move explanation"
        explanation="Best Move is selected from forecasted risk windows and opportunity windows where a small action has high impact on tomorrow’s stability."
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  predictiveGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  predictiveCell: {
    width: '48%',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  bestMoveCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
  },
});