import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { addMinutes, differenceInMinutes, format } from 'date-fns';
import type { ScheduleItem } from '@physiology-engine/shared';
import { usePlanStore } from '../store/planStore';
import EditScheduleItemModal from '../components/EditScheduleItemModal';
import LogActualEventModal, { type ActualLogInput } from '../components/LogActualEventModal';
import TooltipModal from '../components/help/TooltipModal';
import WhyThisModal from '../components/help/WhyThisModal';
import { canDeleteScheduleItem } from '../engine/normalizeTimeline';
import { clockTimeFromISO, formatClockTime, parseClockTime } from '../utils/clockTime';
import { useTodayEntryState } from '../hooks/useTodayEntryState';
import { useFeatureDiscovery } from '../hooks/useFeatureDiscovery';
import { useTheme, Card, Pill, IconButton, PrimaryButton, AppIcon } from '@physiology-engine/ui';
import { safeRenderTimeline } from '../utils/safeRenderTimeline';
import { groupEarlierAndCompletedToday } from '../utils/groupEarlierAndCompletedToday';
import { detectScheduleDrift } from '../utils/detectScheduleDrift';
import { sortScheduleItems } from '../utils/scheduleSort';

const iconByType: Record<string, any> = {
  wake: 'sunrise',
  sleep: 'sleep',
  work: 'work',
  meal: 'meal',
  lunch: 'meal',
  snack: 'snack',
  workout: 'workout',
  walk: 'walk',
  focus: 'focus',
  break: 'break',
  meeting: 'meeting',
  hydration: 'water',
  stretch: 'stretch',
  winddown: 'winddown',
  custom: 'calendar',
};

function categoryForItem(
  item: ScheduleItem
): 'movement' | 'focus' | 'meals' | 'recovery' | 'work' | 'sleep' | 'other' {
  if (item.type === 'walk' || item.type === 'workout') return 'movement';
  if (item.type === 'focus') return 'focus';
  if (item.type === 'meal' || item.type === 'lunch' || item.type === 'snack') return 'meals';
  if (
    item.type === 'break' ||
    item.type === 'stretch' ||
    (item.title || '').toLowerCase().includes('recovery')
  ) {
    return 'recovery';
  }
  if (item.type === 'work' || item.type === 'meeting') return 'work';
  if (item.type === 'wake' || item.type === 'sleep') return 'sleep';
  return 'other';
}

export default function TimelineScreen({ navigation }: any) {
  const { colors, typography, spacing, radius } = useTheme();
  const {
    profile,
    dayState,
    fullDayPlan,
    todayPlanSettingsFingerprint,
    checkStaleness,
    generateFullDayPlan,
    refreshFromNow,
    updateTodayEntry,
    deleteTodayEntry,
    addTodayEntry,
    setTodayEntries,
    autoRefreshEnabled,
    pendingRecommendations,
    applyRecommendation,
    applyAllRecommendations,
    declineRecommendation,
    declineAllRecommendations,
  } = usePlanStore();

  const [editingItem, setEditingItem] = useState<ScheduleItem | null>(null);
  const [showLogModal, setShowLogModal] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [dismissRefreshPrompt, setDismissRefreshPrompt] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [showWhyThis, setShowWhyThis] = useState(false);
  const [showCompletedSection, setShowCompletedSection] = useState(false);
  const [draftItem, setDraftItem] = useState<ScheduleItem | null>(null);
  const lastAutoRealignAtRef = useRef(0);

  const discovery = useFeatureDiscovery('timeline-actions', 3);

  const todayISO = format(new Date(), 'yyyy-MM-dd');
  const yesterdayISO = format(addMinutes(new Date(), -24 * 60), 'yyyy-MM-dd');

  const staleness = checkStaleness();
  const entryState = useTodayEntryState({
    fullDayPlan,
    profile,
    settingsFingerprint: todayPlanSettingsFingerprint,
    staleness,
  });

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const todayItems = useMemo(() => {
    if (!fullDayPlan || !profile) return [] as ScheduleItem[];

    const wakeTime =
      profile.wakeClockTime ||
      parseClockTime(profile.wakeTime) || {
        hour: 7,
        minute: 0,
        period: 'AM' as const,
      };

    const sleepTime =
      profile.sleepClockTime ||
      parseClockTime(profile.sleepTime) || {
        hour: 11,
        minute: 0,
        period: 'PM' as const,
      };

    const safeItems = safeRenderTimeline(fullDayPlan.items, wakeTime, sleepTime, todayISO);

    return sortScheduleItems(safeItems);
  }, [fullDayPlan, profile, todayISO]);

  const pendingItems = todayItems.filter(
    (item) =>
      item.status !== 'actual' &&
      item.origin !== 'actual' &&
      item.status !== 'skipped'
  );

  const liveNow =
    pendingItems.find((item) => {
      const start = item.startMin || 0;
      const end = item.endMin || start + (item.durationMin || 5);
      return start <= nowMinutes && nowMinutes <= end;
    }) || null;

  const futureItems = pendingItems.filter((item) => (item.startMin || 0) > nowMinutes);
  const nowItem = liveNow || futureItems[0] || null;
  const futureAfterNow = futureItems.filter((item) => !nowItem || item.id !== nowItem.id);
  const comingUp = futureAfterNow.slice(0, 4);
  const laterToday = futureAfterNow.slice(4);

  const completedAndEarlier = useMemo(
    () => groupEarlierAndCompletedToday(todayItems, nowMinutes, todayISO),
    [todayItems, nowMinutes, todayISO]
  );

  const drift = useMemo(() => detectScheduleDrift(now, todayItems), [now, todayItems]);

  useEffect(() => {
    if (!drift.hasDrift || !autoRefreshEnabled) return;

    const elapsed = Date.now() - lastAutoRealignAtRef.current;
    if (elapsed < 10 * 60 * 1000) return;

    lastAutoRealignAtRef.current = Date.now();
    refreshFromNow().catch((error) => {
      console.warn('[Timeline] Auto re-align failed', error);
    });
  }, [drift.hasDrift, autoRefreshEnabled, refreshFromNow]);

  const updatedAtMinutesAgo = useMemo(() => {
    const updatedAt = todayItems
      .map((item) => item.updatedAt)
      .filter(Boolean)
      .map((iso) => new Date(iso as string))
      .filter((date) => !Number.isNaN(date.getTime()))
      .sort((a, b) => b.getTime() - a.getTime())[0];

    if (!updatedAt) return null;
    return Math.max(0, differenceInMinutes(new Date(), updatedAt));
  }, [todayItems]);

  const refreshToday = async () => {
    setIsBusy(true);
    try {
      await generateFullDayPlan({
        intent: 'REGENERATE',
        baseItems: [],
      });
      setDismissRefreshPrompt(false);
    } finally {
      setIsBusy(false);
    }
  };

  const handleRefreshFromNow = async () => {
    setIsBusy(true);
    try {
      await refreshFromNow();
    } finally {
      setIsBusy(false);
    }
  };

  const handleSaveItem = async (item: ScheduleItem) => {
    setIsBusy(true);
    try {
      await updateTodayEntry(item.id, item);
      setEditingItem(null);
    } finally {
      setIsBusy(false);
    }
  };

  const createDraftEvent = (template: 'meeting' | 'appointment' | 'errand' | 'commute' | 'custom'): ScheduleItem => {
    const nowDate = new Date();
    const start = addMinutes(nowDate, 30);
    const duration = template === 'meeting' || template === 'appointment' ? 60 : template === 'commute' ? 30 : 45;
    const end = addMinutes(start, duration);
    const startMin = start.getHours() * 60 + start.getMinutes();
    const endMin = end.getHours() * 60 + end.getMinutes();

    const type: ScheduleItem['type'] =
      template === 'meeting' ? 'meeting' : template === 'commute' ? 'commute' : 'custom';

    const titleMap: Record<typeof template, string> = {
      meeting: 'Meeting',
      appointment: 'Appointment',
      errand: 'Errand',
      commute: 'Commute',
      custom: 'Custom Event',
    };

    return {
      id: `draft-${Date.now()}`,
      type,
      title: titleMap[template],
      startISO: start.toISOString(),
      endISO: end.toISOString(),
      startMin,
      endMin,
      durationMin: duration,
      isSystemAnchor: false,
      isFixedAnchor: template !== 'custom',
      fixed: template !== 'custom',
      locked: false,
      deletable: true,
      source: 'user',
      status: 'planned',
      meta: {
        isAnchor: template !== 'custom',
        anchorTemplate: template,
      },
    };
  };

  const handleOpenAddEvent = () => {
    Alert.alert('Add Event', 'Choose event type', [
      { text: 'Meeting', onPress: () => setDraftItem(createDraftEvent('meeting')) },
      { text: 'Appointment', onPress: () => setDraftItem(createDraftEvent('appointment')) },
      { text: 'Errand', onPress: () => setDraftItem(createDraftEvent('errand')) },
      { text: 'Commute', onPress: () => setDraftItem(createDraftEvent('commute')) },
      { text: 'Custom Event', onPress: () => setDraftItem(createDraftEvent('custom')) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleCreateItem = async (item: ScheduleItem) => {
    setIsBusy(true);
    try {
      const { id: _ignoredId, ...entry } = item;
      await addTodayEntry({
        ...entry,
        source: 'user',
        status: item.status || 'planned',
        isSystemAnchor: false,
        isFixedAnchor: Boolean(item.isFixedAnchor || item.fixed || (item.meta && (item.meta as any).isAnchor)),
        fixed: Boolean(item.isFixedAnchor || item.fixed || (item.meta && (item.meta as any).isAnchor)),
        locked: Boolean(item.locked),
        meta: {
          ...(item.meta || {}),
          isAnchor: Boolean(item.isFixedAnchor || item.fixed || (item.meta && (item.meta as any).isAnchor)),
        },
      });
      setDraftItem(null);
    } finally {
      setIsBusy(false);
    }
  };

  const handleDeleteSpecificItem = async (item: ScheduleItem) => {
    if (!canDeleteScheduleItem(item)) {
      Alert.alert('Cannot delete', 'System anchors cannot be deleted from the timeline.');
      return;
    }

    setIsBusy(true);
    try {
      await deleteTodayEntry(item.id);
      if (editingItem?.id === item.id) {
        setEditingItem(null);
      }
    } finally {
      setIsBusy(false);
    }
  };

  const handleDeleteItem = async () => {
    if (!editingItem) return;
    await handleDeleteSpecificItem(editingItem);
  };

  const handleLogActual = async (input: ActualLogInput) => {
    const start = new Date(input.time);
    const duration =
      input.durationMin ||
      (input.type === 'walk'
        ? 20
        : input.type === 'workout'
          ? 35
          : input.type === 'meal'
            ? 30
            : input.type === 'snack'
              ? 15
              : 15);

    const startMin = start.getHours() * 60 + start.getMinutes();

    setIsBusy(true);
    try {
      await addTodayEntry({
        type: input.type === 'caffeine' ? 'custom' : input.type,
        title:
          input.type === 'meal'
            ? `Meal (${input.mealType || 'lean-protein'})`
            : input.type === 'snack'
              ? 'Snack'
              : input.type === 'walk'
                ? 'Walk'
                : input.type === 'workout'
                  ? 'Workout'
                  : 'Caffeine',
        startISO: start.toISOString(),
        endISO: addMinutes(start, duration).toISOString(),
        startMin,
        endMin: startMin + duration,
        durationMin: duration,
        isSystemAnchor: false,
        isFixedAnchor: false,
        fixed: false,
        locked: false,
        deletable: true,
        source: 'user',
        status: 'actual',
      });
      setShowLogModal(false);
    } finally {
      setIsBusy(false);
    }
  };

  const markDone = async (item: ScheduleItem) => {
    setIsBusy(true);
    try {
      await updateTodayEntry(item.id, {
        status: 'actual',
        origin: 'actual',
        completedAt: new Date().toISOString(),
      });
    } finally {
      setIsBusy(false);
    }
  };

  const addWalkNow = async () => {
    const startMin = now.getHours() * 60 + now.getMinutes();
    setIsBusy(true);
    try {
      await addTodayEntry({
        type: 'walk',
        title: '10min Walk',
        startISO: now.toISOString(),
        endISO: addMinutes(now, 10).toISOString(),
        startMin,
        endMin: startMin + 10,
        durationMin: 10,
        isSystemAnchor: false,
        isFixedAnchor: false,
        fixed: false,
        locked: false,
        deletable: true,
        source: 'user',
        status: 'planned',
      });
    } finally {
      setIsBusy(false);
    }
  };

  const buildToday = async () => {
    setIsBusy(true);
    try {
      await setTodayEntries([]);
      await generateFullDayPlan({
        intent: 'REGENERATE',
        baseItems: [],
      });
    } finally {
      setIsBusy(false);
    }
  };

  const nowProgress = useMemo(() => {
    if (!nowItem) return null;
    const start = nowItem.startMin || 0;
    const end = nowItem.endMin || start + (nowItem.durationMin || 5);
    const duration = Math.max(5, end - start);
    const elapsed = Math.max(0, Math.min(duration, nowMinutes - start));
    return {
      elapsed,
      duration,
      ratio: Math.max(0, Math.min(1, elapsed / duration)),
    };
  }, [nowItem, nowMinutes]);

  const accentColorForItem = (item: ScheduleItem) => {
    const category = categoryForItem(item);
    if (category === 'movement') return colors.success;
    if (category === 'focus') return colors.accentPrimary;
    if (category === 'meals') return colors.warning || colors.accentPrimary;
    if (category === 'recovery') return colors.textSecondary;
    if (category === 'work') return colors.textPrimary;
    if (category === 'sleep') return colors.textMuted;
    return colors.borderSubtle;
  };

  const renderTimelineItem = (item: ScheduleItem) => {
    const startClock = item.startTime || clockTimeFromISO(item.startISO);
    const timeLabel = startClock ? formatClockTime(startClock) : '12:00 AM';

    const statusLabel =
      item.status === 'actual' || item.origin === 'actual'
        ? 'Completed'
        : item.status === 'adjusted'
          ? 'Adjusted'
          : item.status === 'skipped'
            ? 'Skipped'
            : 'Scheduled';

    return (
      <TouchableOpacity
        key={item.id}
        onPress={() => setEditingItem(item)}
        onLongPress={() =>
          Alert.alert(item.title, 'Choose an action', [
            { text: 'Mark Done', onPress: () => void markDone(item) },
            ...(canDeleteScheduleItem(item)
              ? [
                  {
                    text: 'Delete',
                    style: 'destructive' as const,
                    onPress: () => void handleDeleteSpecificItem(item),
                  },
                ]
              : []),
            { text: 'Cancel', style: 'cancel' },
          ])
        }
        style={[
          styles.itemRow,
          {
            borderColor: colors.borderSubtle,
            borderLeftColor: accentColorForItem(item),
            borderLeftWidth: 3,
            backgroundColor: colors.surfaceElevated,
          },
        ]}
      >
        <View style={styles.timeCol}>
          <Text style={[typography.caption, { color: colors.textMuted }]}>{timeLabel}</Text>
        </View>

        <View style={styles.bodyCol}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <AppIcon name={iconByType[item.type] || 'calendar'} size={14} color={colors.textSecondary} />
            <Text
              style={[
                typography.bodyM,
                {
                  color: colors.textPrimary,
                  marginLeft: spacing.xs,
                  fontWeight: '600',
                },
              ]}
            >
              {item.title}
            </Text>
          </View>

          <Text
            style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}
            numberOfLines={1}
          >
            {statusLabel}
          </Text>
        </View>

        {item.status === 'actual' || item.origin === 'actual' ? (
          <AppIcon name="checkCircle" size={18} color={colors.success} />
        ) : item.status === 'skipped' ? (
          <AppIcon name="close" size={18} color={colors.textMuted} />
        ) : (
          <TouchableOpacity onPress={() => void markDone(item)}>
            <AppIcon name="check" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  if (!profile) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.centered}>
          <Text style={[typography.bodyM, { color: colors.textSecondary }]}>Set up your profile first.</Text>
          <PrimaryButton onPress={() => navigation.navigate('Onboarding')} style={{ marginTop: spacing.lg }}>
            Set Up Profile
          </PrimaryButton>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View style={styles.headerTop}>
          <View>
            <Text style={[typography.titleL, { color: colors.textPrimary }]}>Today</Text>
            <Text style={[typography.caption, { color: colors.textMuted }]}>{format(new Date(), 'EEEE, MMM d')}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <IconButton icon="chart" onPress={() => navigation.navigate('Insights')} variant="subtle" />
            <IconButton icon="settings" onPress={() => navigation.navigate('Settings')} variant="subtle" />
          </View>
        </View>

        <View style={styles.rowWrap}>
          <Pill label={dayState?.dayMode || profile.defaultDayMode || 'flex'} variant="accent" style={{ marginRight: spacing.xs, marginBottom: spacing.xs }} />
          <Pill label={`Sleep ${dayState?.sleepQuality || 7}/10`} variant="muted" style={{ marginRight: spacing.xs, marginBottom: spacing.xs }} />
          <Pill label={`Stress ${dayState?.stressLevel || 5}/10`} variant="muted" style={{ marginRight: spacing.xs, marginBottom: spacing.xs }} />
          <Pill label={`Fast ${profile.preferredFastingHours || 14}h`} variant="muted" style={{ marginRight: spacing.xs, marginBottom: spacing.xs }} />
          <Pill label={`Momentum ${staleness}`} variant="muted" style={{ marginBottom: spacing.xs }} />
        </View>

        <View style={styles.rowWrap}>
          <TouchableOpacity onPress={() => navigation.navigate('History', { dateISO: yesterdayISO })} style={{ marginRight: spacing.xs }}>
            <Pill label="Yesterday" variant="muted" />
          </TouchableOpacity>
          <Pill label="Today" variant="accent" style={{ marginRight: spacing.xs }} />
          <TouchableOpacity onPress={() => navigation.navigate('Tomorrow')}>
            <Pill label="Tomorrow" variant="muted" />
          </TouchableOpacity>
        </View>

        {updatedAtMinutesAgo !== null && (
          <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs }]}>
            Updated {updatedAtMinutesAgo} min ago
          </Text>
        )}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: spacing['2xl'] }}>
        {discovery.shouldShow(1) ? (
          <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
            <Card>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>
                Tip: Use “Refresh from now” after delays to re-align the rest of your day.
              </Text>
              <TouchableOpacity onPress={() => void discovery.advanceLevel()} style={{ marginTop: spacing.xs }}>
                <Text style={[typography.caption, { color: colors.accentPrimary }]}>Dismiss</Text>
              </TouchableOpacity>
            </Card>
          </View>
        ) : null}

        {entryState === 'NO_PLAN' ? (
          <View style={{ padding: spacing.lg }}>
            <Card>
              <Text style={[typography.bodyM, { color: colors.textPrimary, fontWeight: '700' }]}>
                Build Today
              </Text>
              <Text style={[typography.caption, { color: colors.textSecondary, marginTop: spacing.xs }]}>
                No active plan found for today. Build once, then adapt continuously.
              </Text>
              <PrimaryButton onPress={() => void buildToday()} style={{ marginTop: spacing.md }}>
                {isBusy ? 'Building...' : 'Build Today'}
              </PrimaryButton>
              <TouchableOpacity onPress={() => navigation.navigate('TodaySetup')} style={{ marginTop: spacing.sm }}>
                <Text style={[typography.caption, { color: colors.accentPrimary }]}>
                  Open Morning Briefing setup
                </Text>
              </TouchableOpacity>
            </Card>
          </View>
        ) : (
          <>
            {drift.hasDrift ? (
              <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
                <Card>
                  <Text style={[typography.bodyM, { color: colors.textPrimary, fontWeight: '700' }]}>
                    Your day drifted slightly
                  </Text>
                  <Text style={[typography.caption, { color: colors.textSecondary, marginTop: spacing.xs }]}>
                    {drift.reason || 'Schedule drift detected.'}
                  </Text>
                  <TouchableOpacity
                    style={{
                      borderWidth: 1,
                      borderColor: colors.accentPrimary,
                      borderRadius: radius.md,
                      paddingHorizontal: spacing.md,
                      paddingVertical: spacing.sm,
                      marginTop: spacing.sm,
                      alignSelf: 'flex-start',
                    }}
                    onPress={() => void handleRefreshFromNow()}
                  >
                    <Text style={[typography.caption, { color: colors.accentPrimary }]}>Re-align day</Text>
                  </TouchableOpacity>
                </Card>
              </View>
            ) : null}

            {pendingRecommendations.length > 0 ? (
              <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
                <Card>
                  <Text style={[typography.bodyM, { color: colors.textPrimary, fontWeight: '700' }]}>
                    Suggested anchor-safe adjustments
                  </Text>
                  <Text style={[typography.caption, { color: colors.textSecondary, marginTop: spacing.xs }]}>
                    We preserved your fixed events. Apply suggestions to optimize open windows.
                  </Text>

                  <View style={{ marginTop: spacing.sm }}>
                    {pendingRecommendations.map((recommendation) => (
                      <View
                        key={recommendation.id}
                        style={{
                          borderWidth: 1,
                          borderColor: colors.borderSubtle,
                          borderRadius: radius.md,
                          padding: spacing.sm,
                          marginBottom: spacing.xs,
                        }}
                      >
                        <Text style={[typography.bodyM, { color: colors.textPrimary, fontWeight: '600' }]}>
                          {recommendation.title}
                        </Text>
                        <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                          {recommendation.description}
                        </Text>
                        <View style={{ flexDirection: 'row', marginTop: spacing.xs }}>
                          <TouchableOpacity onPress={() => void applyRecommendation(recommendation.id)} style={{ marginRight: spacing.md }}>
                            <Text style={[typography.caption, { color: colors.accentPrimary }]}>Accept</Text>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => declineRecommendation(recommendation.id)}>
                            <Text style={[typography.caption, { color: colors.textSecondary }]}>Decline</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                  </View>

                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.xs }}>
                    <TouchableOpacity onPress={() => void applyAllRecommendations()} style={{ marginRight: spacing.md, marginBottom: spacing.xs }}>
                      <Text style={[typography.caption, { color: colors.accentPrimary }]}>Accept all</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => declineAllRecommendations()} style={{ marginRight: spacing.md, marginBottom: spacing.xs }}>
                      <Text style={[typography.caption, { color: colors.textSecondary }]}>Decline</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => declineAllRecommendations()} style={{ marginBottom: spacing.xs }}>
                      <Text style={[typography.caption, { color: colors.textSecondary }]}>Keep current plan</Text>
                    </TouchableOpacity>
                  </View>
                </Card>
              </View>
            ) : null}

            {entryState === 'HAS_PLAN_BUT_INPUTS_CHANGED' && !dismissRefreshPrompt && (
              <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
                <Card>
                  <Text style={[typography.bodyM, { color: colors.textPrimary, fontWeight: '700' }]}>
                    Your schedule inputs changed. Refresh today’s plan?
                  </Text>
                  <View style={{ flexDirection: 'row', marginTop: spacing.md }}>
                    <TouchableOpacity
                      style={{
                        borderWidth: 1,
                        borderColor: colors.accentPrimary,
                        backgroundColor: colors.accentSoft,
                        borderRadius: radius.md,
                        paddingHorizontal: spacing.md,
                        paddingVertical: spacing.sm,
                        marginRight: spacing.sm,
                      }}
                      onPress={() => void refreshToday()}
                    >
                      <Text style={[typography.caption, { color: colors.accentPrimary }]}>Refresh Plan</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={{
                        borderWidth: 1,
                        borderColor: colors.borderSubtle,
                        borderRadius: radius.md,
                        paddingHorizontal: spacing.md,
                        paddingVertical: spacing.sm,
                      }}
                      onPress={() => setDismissRefreshPrompt(true)}
                    >
                      <Text style={[typography.caption, { color: colors.textSecondary }]}>Keep Current Plan</Text>
                    </TouchableOpacity>
                  </View>
                </Card>
              </View>
            )}

            {(entryState === 'NEEDS_REFRESH_FROM_NOW' || entryState === 'HAS_VALID_PLAN') && (
              <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
                <Card>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={[typography.bodyM, { color: colors.textPrimary, fontWeight: '700' }]}>Now</Text>
                      <TouchableOpacity onPress={() => setShowTooltip(true)} style={{ marginLeft: spacing.xs }}>
                        <Text style={[typography.caption, { color: colors.accentPrimary, fontWeight: '700' }]}>?</Text>
                      </TouchableOpacity>
                    </View>
                    <TouchableOpacity onPress={() => void handleRefreshFromNow()}>
                      <Text style={[typography.caption, { color: colors.accentPrimary }]}>
                        {isBusy ? 'Refreshing...' : 'Refresh from now'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity onPress={() => setShowWhyThis(true)} style={{ alignSelf: 'flex-end', marginTop: spacing.xs }}>
                    <Text style={[typography.caption, { color: colors.accentPrimary }]}>Why this?</Text>
                  </TouchableOpacity>

                  {nowItem ? (
                    <>
                      {renderTimelineItem(nowItem)}
                      {nowProgress ? (
                        <View style={{ marginTop: spacing.xs }}>
                          <View
                            style={{
                              height: 6,
                              borderRadius: 999,
                              backgroundColor: colors.borderSubtle,
                              overflow: 'hidden',
                            }}
                          >
                            <View
                              style={{
                                width: `${Math.round(nowProgress.ratio * 100)}%`,
                                height: 6,
                                backgroundColor: colors.accentPrimary,
                              }}
                            />
                          </View>
                          <Text style={[typography.caption, { color: colors.textMuted, marginTop: 4 }]}>
                            {nowProgress.elapsed}m / {nowProgress.duration}m
                          </Text>
                        </View>
                      ) : null}
                      {comingUp[0] ? (
                        <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs }]}>
                          Up next: {comingUp[0].title}
                        </Text>
                      ) : null}
                    </>
                  ) : (
                    <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs }]}>
                      No active block right now.
                    </Text>
                  )}

                  <View style={{ flexDirection: 'row', marginTop: spacing.sm }}>
                    <TouchableOpacity
                      onPress={() => setShowLogModal(true)}
                      style={{
                        borderWidth: 1,
                        borderColor: colors.borderSubtle,
                        borderRadius: radius.md,
                        paddingHorizontal: spacing.sm,
                        paddingVertical: spacing.xs,
                        marginRight: spacing.xs,
                      }}
                    >
                      <Text style={[typography.caption, { color: colors.textSecondary }]}>Log Actual</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => void addWalkNow()}
                      style={{
                        borderWidth: 1,
                        borderColor: colors.borderSubtle,
                        borderRadius: radius.md,
                        paddingHorizontal: spacing.sm,
                        paddingVertical: spacing.xs,
                      }}
                    >
                      <Text style={[typography.caption, { color: colors.textSecondary }]}>Insert Walk</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={handleOpenAddEvent}
                      style={{
                        borderWidth: 1,
                        borderColor: colors.borderSubtle,
                        borderRadius: radius.md,
                        paddingHorizontal: spacing.sm,
                        paddingVertical: spacing.xs,
                        marginLeft: spacing.xs,
                      }}
                    >
                      <Text style={[typography.caption, { color: colors.textSecondary }]}>Add Event</Text>
                    </TouchableOpacity>
                  </View>
                </Card>
              </View>
            )}

            <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
              <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.xs }]}>
                COMING UP
              </Text>
              {comingUp.length === 0 ? (
                <Card>
                  <Text style={[typography.caption, { color: colors.textMuted }]}>No upcoming items.</Text>
                </Card>
              ) : (
                comingUp.map(renderTimelineItem)
              )}
            </View>

            <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
              <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.xs }]}>
                LATER TODAY
              </Text>
              {laterToday.length === 0 ? (
                <Card>
                  <Text style={[typography.caption, { color: colors.textMuted }]}>No later items.</Text>
                </Card>
              ) : (
                laterToday.map(renderTimelineItem)
              )}
            </View>

            <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
              <TouchableOpacity
                onPress={() => setShowCompletedSection((prev) => !prev)}
                style={{
                  borderWidth: 1,
                  borderColor: colors.borderSubtle,
                  borderRadius: radius.md,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                  backgroundColor: colors.surface,
                }}
              >
                <Text style={[typography.caption, { color: colors.textSecondary }]}>
                  Completed & Earlier Today ({completedAndEarlier.summaryCount}) {showCompletedSection ? '▲' : '▼'}
                </Text>
              </TouchableOpacity>

              {showCompletedSection ? (
                <View style={{ marginTop: spacing.sm }}>
                  {completedAndEarlier.items.length === 0 ? (
                    <Card>
                      <Text style={[typography.caption, { color: colors.textMuted }]}>Nothing to show yet.</Text>
                    </Card>
                  ) : (
                    completedAndEarlier.items.map(renderTimelineItem)
                  )}
                </View>
              ) : null}
            </View>
          </>
        )}
      </ScrollView>

      <EditScheduleItemModal
        visible={!!editingItem || !!draftItem}
        item={editingItem || draftItem}
        onSave={editingItem ? handleSaveItem : handleCreateItem}
        onDelete={editingItem ? handleDeleteItem : undefined}
        onClose={() => {
          setEditingItem(null);
          setDraftItem(null);
        }}
        isSaving={isBusy}
      />

      <LogActualEventModal
        visible={showLogModal}
        onClose={() => setShowLogModal(false)}
        onSave={handleLogActual}
        isSaving={isBusy}
      />

      <TooltipModal
        visible={showTooltip}
        onClose={() => setShowTooltip(false)}
        title="Timeline actions"
        description="These controls adapt your live schedule while preserving completed items and stable anchors."
      />

      <WhyThisModal
        visible={showWhyThis}
        onClose={() => setShowWhyThis(false)}
        title="Refresh from now"
        explanation="This preserves completed and earlier items, keeps anchors stable, then recomputes only the remaining portion of today."
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  rowWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  scroll: { flex: 1 },
  itemRow: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  timeCol: {
    width: 72,
    paddingRight: 8,
  },
  bodyCol: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
});