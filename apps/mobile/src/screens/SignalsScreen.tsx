import React, { useMemo, useState, useRef, useEffect } from 'react';
import { ScrollView, Text, TouchableOpacity, View, Animated } from 'react-native';
import { addMinutes } from 'date-fns';
import { usePlanStore } from '../store/planStore';
// quick status decision logic removed from UI; keep signal-only rendering in System Response
import { QUICK_STATUS_LABELS, QUICK_STATUS_SIGNALS, normalizeQuickStatusSignals, type QuickStatusSignal } from '../types/quickStatus';
import { useTheme, Card, SectionTitle, AppIcon } from '@physiology-engine/ui';
import TooltipModal from '../components/help/TooltipModal';
import WhyThisModal from '../components/help/WhyThisModal';
import { useFeatureDiscovery } from '../hooks/useFeatureDiscovery';
import { ask as askAdvisor } from '../advisor';
import { extractTimelineInserts, mapAdvisorInsertToScheduleItem, hasTimelineSuggestion } from '../advisor/utils/timelineInsert';


const SIGNAL_EXPLANATIONS: Record<QuickStatusSignal, string> = {
  'hungry-now': 'Adds nutrition support and protects energy stability.',
  'craving-comfort': 'Adds containment steps to avoid momentum collapse.',
  'low-energy': 'Triggers short movement or hydration resets.',
  'high-stress': 'Biases day toward reduced intensity and recovery pacing.',
  dehydrated: 'Adds hydration now and guards afternoon dip risk.',
  'poor-sleep': 'Delays stimulant load and reduces aggressive scheduling.',
  'mental-fog': 'Prioritizes clarity blocks and recovery micro-actions.',
};

export default function SignalsScreen() {
  const { colors, typography, spacing, radius } = useTheme();
  const {
    dayState,
    setQuickStatusSignals,
    addTodayEntry,
    updateTodayEntry,
    refreshFromNow,
    fullDayPlan,
  } = usePlanStore();

  const [lastImpact, setLastImpact] = useState<string | null>(null);
  const [primarySignal, setPrimarySignal] = useState<QuickStatusSignal | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [showWhyThis, setShowWhyThis] = useState(false);
  const [recommendationsBySignal, setRecommendationsBySignal] = useState<Record<string, any>>({});
  const [queryResponse, setQueryResponse] = useState<any | null>(null);

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const discovery = useFeatureDiscovery('signals', 3);

  const signals = useMemo(
    () => normalizeQuickStatusSignals((dayState as any)?.quickStatusSignals),
    [dayState]
  );

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const QUICK_QUESTIONS = [
    "How does my day look?",
    "What should I move right now?",
    "Where should I put a workout?",
    "Am I overloaded?",
    "Optimize the rest of my day",
  ];

  // decision logic intentionally not rendered here; System Response is the single source of truth

  const toggleSignal = async (signal: QuickStatusSignal) => {
    const next = signals.includes(signal) ? signals.filter((s) => s !== signal) : [...signals, signal];
    await setQuickStatusSignals(next);
    setLastImpact(`Signals updated: ${next.map((s) => QUICK_STATUS_LABELS[s]).join(', ') || 'none'}`);
    // Make the most-recently-enabled signal the primary displayed signal
    if (!signals.includes(signal)) {
      setPrimarySignal(signal);
    } else {
      // if we disabled the current primary, choose a fallback
      setPrimarySignal((cur) => (cur === signal ? (next.length > 0 ? next[next.length - 1] as QuickStatusSignal : null) : cur));
    }
    // If enabling a signal, fetch a short advisor recommendation for it
    if (!signals.includes(signal)) {
      void fetchSignalRecommendation(signal);
    }
  };

  async function fetchSignalRecommendation(signal: QuickStatusSignal) {
    // Map signal -> short prompt
    const promptMap: Record<QuickStatusSignal, string> = {
      'hungry-now': "I'm hungry now — what should I do to stabilize my energy?",
      'craving-comfort': "I'm craving comfort food — how should I handle it without derailing my day?",
      'low-energy': "I'm feeling low energy — suggest a short intervention to reset.",
      'high-stress': "I'm feeling stressed — what's a short recovery step?",
      dehydrated: "I'm dehydrated — what immediate steps and timeline inserts do you recommend?",
      'poor-sleep': "I slept poorly — how should I shift today's schedule?",
      'mental-fog': "I'm experiencing mental fog — suggest a clarity-first recommendation.",
    };

    const question = promptMap[signal] || 'What should I do right now?';
    try {
      const resp = await askAdvisor(question, {
        forcePreset: true,
        context: {
          timeline: fullDayPlan?.items,
          now,
          signals,
          goals: (dayState as any)?.goals,
        },
      });
      // store advisory result keyed by signal so Signal Effects can render it inline
      setRecommendationsBySignal((p) => ({ ...p, [signal]: resp }));
    } catch (err) {
      setRecommendationsBySignal((p) => ({ ...p, [signal]: null }));
      console.warn('[Signals] advisor failed', err);
    }
  }

  const applyAction = async (actionId: string) => {
    const startMin = now.getHours() * 60 + now.getMinutes();

    if (actionId === 'INSERT_WALK_8' || actionId === 'INSERT_WALK_10') {
      const duration = actionId === 'INSERT_WALK_10' ? 10 : 8;
      await addTodayEntry({
        type: 'walk',
        title: `${duration}min Reset Walk`,
        startISO: now.toISOString(),
        endISO: new Date(now.getTime() + duration * 60000).toISOString(),
        startMin,
        endMin: startMin + duration,
        durationMin: duration,
        fixed: false,
        locked: false,
        deletable: true,
        source: 'user',
        isSystemAnchor: false,
        isFixedAnchor: false,
        status: 'planned',
      });
      setLastImpact(`Inserted ${duration} minute walk`);
      return;
    }

    if (actionId === 'INSERT_SNACK_15') {
      await addTodayEntry({
        type: 'snack',
        title: 'Protein Snack',
        startISO: now.toISOString(),
        endISO: new Date(now.getTime() + 15 * 60000).toISOString(),
        startMin,
        endMin: startMin + 15,
        durationMin: 15,
        fixed: false,
        locked: false,
        deletable: true,
        source: 'user',
        isSystemAnchor: false,
        isFixedAnchor: false,
        status: 'planned',
      });
      setLastImpact('Inserted protein snack');
      return;
    }

    if (actionId === 'SHIFT_LUNCH_EARLIER_15') {
      const lunch = fullDayPlan?.items.find((item) => item.type === 'meal');
      if (lunch) {
        await updateTodayEntry(lunch.id, {
          startMin: (lunch.startMin || startMin) - 15,
          endMin: (lunch.endMin || startMin + 30) - 15,
        });
        setLastImpact('Shifted lunch earlier by 15 minutes');
      }
      return;
    }

    if (actionId === 'RECOMPUTE_FROM_NOW') {
      await refreshFromNow();
      setLastImpact('Refreshed schedule from now');
    }

    if (actionId === 'INSERT_WORKOUT') {
      const duration = 45;
      await addTodayEntry({
        type: 'workout',
        title: 'Workout',
        startISO: now.toISOString(),
        endISO: new Date(now.getTime() + duration * 60000).toISOString(),
        startMin,
        endMin: startMin + duration,
        durationMin: duration,
        fixed: false,
        locked: false,
        deletable: true,
        source: 'user',
        isSystemAnchor: false,
        isFixedAnchor: false,
        status: 'planned',
      });
      setLastImpact('Inserted workout');
      return;
    }

    if (actionId === 'MOVE_WORKOUT') {
      const workout = fullDayPlan?.items.find((it) => it.type === 'workout');
      if (workout) {
        const newStart = addMinutes(now, 30);
        const startMinNew = newStart.getHours() * 60 + newStart.getMinutes();
        const duration = workout.durationMin || 45;
        await updateTodayEntry(workout.id, {
          startMin: startMinNew,
          endMin: startMinNew + duration,
          startISO: newStart.toISOString(),
          endISO: addMinutes(newStart, duration).toISOString(),
        } as any);
        setLastImpact('Moved workout 30 minutes from now');
      }
      return;
    }

    if (actionId === 'CLEAR_OVERLOAD') {
      // Minimal clear overload: recompute from now and insert a short recovery walk
      await refreshFromNow();
      const walkDur = 10;
      await addTodayEntry({
        type: 'walk',
        title: '10min Recovery Walk',
        startISO: now.toISOString(),
        endISO: new Date(now.getTime() + walkDur * 60000).toISOString(),
        startMin,
        endMin: startMin + walkDur,
        durationMin: walkDur,
        fixed: false,
        locked: false,
        deletable: true,
        source: 'user',
        isSystemAnchor: false,
        isFixedAnchor: false,
        status: 'planned',
      });
      setLastImpact('Cleared overload and added short recovery');
      return;
    }
  };

  async function handleQuickQuestion(question: string) {
    try {
      const resp = await askAdvisor(question, {
        context: {
          timeline: fullDayPlan?.items,
          now,
          signals,
          goals: (dayState as any)?.goals,
        },
      });
      // keep quick-question response local to this UI block
      setQueryResponse(resp);
    } catch (err) {
      setQueryResponse(null);
      console.warn('[Signals] advisor failed', err);
    }
  }

  const addRecommendationsToTimeline = async (signal: string) => {
    const resp = recommendationsBySignal[signal];
    if (!resp) return;
    const inserts = extractTimelineInserts(resp);
    if (!inserts || inserts.length === 0) return;

    for (const insert of inserts) {
      await addTodayEntry(mapAdvisorInsertToScheduleItem(insert));
    }
    setLastImpact('Added recommended items to timeline');
  };

  useEffect(() => {
    // subtle highlight / fade when recommendations update
    const id = setTimeout(() => {
      Animated.sequence([
        Animated.timing(fadeAnim, { toValue: 0.6, duration: 100, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 140, useNativeDriver: true }),
      ]).start();
    }, 10);
    return () => clearTimeout(id);
  }, [recommendationsBySignal, fadeAnim]);

  // keep primarySignal in sync with store-driven signals
  useEffect(() => {
    if (!primarySignal && signals.length > 0) {
      setPrimarySignal(signals[signals.length - 1] as QuickStatusSignal);
      return;
    }
    if (primarySignal && !signals.includes(primarySignal)) {
      setPrimarySignal(signals.length > 0 ? (signals[signals.length - 1] as QuickStatusSignal) : null);
    }
  }, [signals, primarySignal]);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ paddingBottom: spacing['2xl'] }}>
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
        <SectionTitle title="Signals" subtitle="Adaptive inputs that mutate your day in real time" />
      </View>

      {discovery.shouldShow(1) ? (
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}>
          <Card>
            <Text style={[typography.caption, { color: colors.textSecondary }]}>New: Signals adapt your timeline instantly when your state changes.</Text>
            <TouchableOpacity onPress={() => void discovery.advanceLevel()} style={{ marginTop: spacing.xs }}>
              <Text style={[typography.caption, { color: colors.accentPrimary }]}>Got it</Text>
            </TouchableOpacity>
          </Card>
        </View>
      ) : null}

      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
        <Card>
          <Text style={[typography.bodyM, { color: colors.textSecondary, marginBottom: spacing.sm }]}>Quick Status Signals</Text>
          <TouchableOpacity onPress={() => setShowTooltip(true)}>
            <Text style={[typography.caption, { color: colors.accentPrimary, marginBottom: spacing.sm }]}>What is this?</Text>
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {QUICK_STATUS_SIGNALS.map((signal) => {
              const active = signals.includes(signal);
              return (
                <TouchableOpacity
                  key={signal}
                  style={{
                    borderWidth: 1,
                    borderColor: active ? colors.accentPrimary : colors.borderSubtle,
                    backgroundColor: active ? colors.accentSoft : colors.surface,
                    borderRadius: radius.md,
                    paddingHorizontal: spacing.sm,
                    paddingVertical: spacing.sm,
                    marginRight: spacing.xs,
                    marginBottom: spacing.xs,
                  }}
                  onPress={() => void toggleSignal(signal)}
                >
                  <Text style={[typography.caption, { color: active ? colors.accentPrimary : colors.textSecondary }]}>{QUICK_STATUS_LABELS[signal]}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Card>
      </View>
          {queryResponse ? (
            <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
              <Card>
                <Text style={[typography.bodyM, { color: colors.textPrimary, fontWeight: '700' }]}>Recommendation</Text>
                <Text style={[typography.caption, { color: colors.textSecondary, marginTop: spacing.xs }]}>{queryResponse.directAnswer || queryResponse.text || 'See recommendation'}</Text>
                {hasTimelineSuggestion(queryResponse) ? (
                  <View style={{ flexDirection: 'row', marginTop: spacing.md }}>
                    <TouchableOpacity
                      onPress={async () => {
                        const inserts = extractTimelineInserts(queryResponse);
                        if (inserts && inserts.length > 0) {
                          for (const insert of inserts) {
                            await addTodayEntry(mapAdvisorInsertToScheduleItem(insert));
                          }
                          setLastImpact('Added recommended items to timeline');
                        }
                        setQueryResponse(null);
                      }}
                      style={{ borderWidth: 1, borderColor: colors.accentPrimary, backgroundColor: colors.accentSoft, borderRadius: radius.md, padding: spacing.sm, marginRight: spacing.xs }}
                    >
                      <Text style={[typography.caption, { color: colors.accentPrimary, fontWeight: '700' }]}>Add to Timeline</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setQueryResponse(null)} style={{ borderWidth: 1, borderColor: colors.borderSubtle, borderRadius: radius.md, padding: spacing.sm }}>
                      <Text style={[typography.caption, { color: colors.textMuted }]}>Close</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={{ marginTop: spacing.md }}>
                    <TouchableOpacity onPress={() => setQueryResponse(null)} style={{ borderWidth: 1, borderColor: colors.borderSubtle, borderRadius: radius.md, padding: spacing.sm }}>
                      <Text style={[typography.caption, { color: colors.textMuted }]}>Close</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </Card>
            </View>
          ) : null}

      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
        <Animated.View style={{ opacity: fadeAnim }}>
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
              <AppIcon name="sparkles" size={16} color={colors.textPrimary} />
              <Text style={[typography.bodyM, { color: colors.textPrimary, fontWeight: '700', marginLeft: spacing.xs }]}>System Response</Text>
            </View>
            {!primarySignal ? (
              <Text style={[typography.caption, { color: colors.textMuted }]}>No active signals.</Text>
            ) : (
              <View>
                <Text style={[typography.bodyM, { color: colors.textPrimary, fontWeight: '700' }]}>{QUICK_STATUS_LABELS[primarySignal]}</Text>
                <View style={{ marginTop: spacing.xs }}>
                  <Text style={[typography.caption, { color: colors.textSecondary, fontWeight: '700' }]}>Effect</Text>
                  <Text style={[typography.caption, { color: colors.textSecondary, marginTop: spacing.xs }]}>{SIGNAL_EXPLANATIONS[primarySignal]}</Text>
                </View>
                <View style={{ marginTop: spacing.md }}>
                  <Text style={[typography.caption, { color: colors.textSecondary, fontWeight: '700' }]}>Recommended now</Text>
                  <Text style={[typography.caption, { color: colors.textSecondary, marginTop: spacing.xs }]}>
                    {(() => {
                      const rec = recommendationsBySignal[primarySignal];
                      return rec ? (rec.directAnswer || rec.text || rec.answer || 'See recommendation') : 'No recommendation yet.';
                    })()}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', marginTop: spacing.md }}>
                  {(() => {
                    const rec = recommendationsBySignal[primarySignal];
                    if (rec && hasTimelineSuggestion(rec)) {
                      return (
                        <TouchableOpacity
                          onPress={() => void addRecommendationsToTimeline(primarySignal)}
                          style={{ borderWidth: 1, borderColor: colors.accentPrimary, backgroundColor: colors.accentSoft, borderRadius: radius.md, padding: spacing.sm, marginRight: spacing.xs }}
                        >
                          <Text style={[typography.caption, { color: colors.accentPrimary, fontWeight: '700' }]}>Add to Timeline</Text>
                        </TouchableOpacity>
                      );
                    }
                    return (
                      <TouchableOpacity onPress={() => {}} style={{ borderWidth: 1, borderColor: colors.borderSubtle, borderRadius: radius.md, padding: spacing.sm }}>
                        <Text style={[typography.caption, { color: colors.textMuted }]}>Close</Text>
                      </TouchableOpacity>
                    );
                  })()}
                </View>
              </View>
            )}
          </Card>
        </Animated.View>
      </View>

      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
        <Card>
          <Text style={[typography.bodyM, { color: colors.textPrimary, fontWeight: '700' }]}>Ask AlignOS</Text>
          <Text style={[typography.caption, { color: colors.textSecondary, marginTop: spacing.xs }]}>Quick smart questions for one-tap advice</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.sm }}>
            {QUICK_QUESTIONS.map((q) => (
              <TouchableOpacity
                key={q}
                onPress={() => void handleQuickQuestion(q)}
                style={{ borderWidth: 1, borderColor: colors.borderSubtle, borderRadius: radius.md, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, marginRight: spacing.xs, marginBottom: spacing.xs }}
              >
                <Text style={[typography.caption, { color: colors.textSecondary }]}>{q}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>
      </View>

      {/* advisor modal removed; recommendations are rendered inline within System Response */}

      <TooltipModal
        visible={showTooltip}
        onClose={() => setShowTooltip(false)}
        title="Signals"
        description="Signals are fast, user-driven state inputs. They bias the system toward supportive actions like hydration, movement, recovery, or schedule shifts."
      />

      <WhyThisModal
        visible={showWhyThis}
        onClose={() => setShowWhyThis(false)}
        title="Signal-based recommendation"
        explanation="This recommendation appears because your active signals and current time predict a better outcome if the timeline adapts now."
      />
    </ScrollView>
  );
}
