import React, { useMemo, useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View, KeyboardAvoidingView, Platform } from 'react-native';
import { format } from 'date-fns';
import { usePlanStore } from '../store/planStore';
import EnergyForecast, { getForecastSnapshot } from '../components/EnergyForecast';
import MomentumScoreCard from '../components/MomentumScoreCard';
import AlignOSThinkingCard from '../components/AlignOSThinkingCard';
import { ask as askAdvisor, type AdvisorResponse } from '../advisor';
import { ADVISOR_STARTER_PROMPTS } from './ChatScreen';
import { extractTimelineInserts, hasTimelineSuggestion, mapAdvisorInsertToScheduleItem } from '../advisor/utils/timelineInsert';
import { buildRecommendationContext } from '../utils/recommendationContext';
import { generateRecommendationsFromContext } from '../utils/recommendationEngine';
import { calculateMomentumScore } from '../engine/momentumScore';
import { getRhythmInsights } from '../engine/rhythmIntelligence';
import { QUICK_STATUS_LABELS, normalizeQuickStatusSignals } from '../types/quickStatus';
import { useTheme, Card, SectionTitle, AppIcon } from '@physiology-engine/ui';
import { useFeatureDiscovery } from '../hooks/useFeatureDiscovery';

interface AdvisorMessage {
  id: string;
  role: 'user' | 'advisor';
  text: string;
  response?: AdvisorResponse;
}

type AdvisorRenderState = 'idle' | 'loading' | 'preset' | 'valid' | 'llm-unavailable' | 'error';
type InsightsAdvisorOptions = { forcePreset?: boolean; requestSource?: 'starter-prompt' | 'free-text' };

function isLimitExceededResponse(response: AdvisorResponse): boolean {
  const directAnswer = (response.directAnswer || '').toLowerCase();
  const rationale = (response.rationale || '').toLowerCase();

  return response.source === 'llm'
    && response.intent === 'unknown'
    && (
      directAnswer.includes('daily custom question limit reached')
      || directAnswer.includes('5/day')
      || rationale.includes('daily llm quota reached')
    );
}

function isLlmUnavailableFailure(response: AdvisorResponse): boolean {
  const directAnswer = (response.directAnswer || '').toLowerCase();
  const rationale = (response.rationale || '').toLowerCase();
  const why = (response.why || '').toLowerCase();

  return response.source === 'llm'
    && response.intent === 'unknown'
    && (
      directAnswer.includes('no llm service available')
      || directAnswer.includes('unable to process your question right now')
      || directAnswer.includes('service temporarily unavailable')
      || rationale.includes('service was unavailable')
      || rationale.includes('llm service unavailable')
      || why.includes('llm service is currently unavailable')
    );
}

function hasValidAdvisorResponse(response: AdvisorResponse): boolean {
  if (isLlmUnavailableFailure(response)) return false;
  if (isLimitExceededResponse(response)) return true;
  if (response.source === 'preset') return true;
  if (response.source === 'clarify') return true;

  return response.source === 'llm' && response.directAnswer.trim().length > 0;
}

export default function InsightsScreen({ navigation }: any) {
  const { colors, typography, spacing } = useTheme();
  const {
    profile,
    fullDayPlan,
    dayState,
    todayEntries,
    deviceId,
    addTodayEntry,
    refreshFromNow,
  } = usePlanStore();
  const discovery = useFeatureDiscovery('insights-learning', 3);
  const [advisorInput, setAdvisorInput] = useState('');
  const [advisorLoading, setAdvisorLoading] = useState(false);
  const [advisorError, setAdvisorError] = useState<string | null>(null);
  const [llmUnavailableBanner, setLlmUnavailableBanner] = useState<string | null>(null);
  const [advisorRenderState, setAdvisorRenderState] = useState<AdvisorRenderState>('idle');
  const [ignoredSuggestions, setIgnoredSuggestions] = useState<string[]>([]);
  const [advisorMessages, setAdvisorMessages] = useState<AdvisorMessage[]>([
    {
      id: 'advisor-welcome',
      role: 'advisor',
      text: 'Ask me to interpret your schedule, forecast, momentum, and signals. I can also suggest actions and add them to your timeline.',
    },
  ]);

  const normalizedSignals = normalizeQuickStatusSignals((dayState as any)?.quickStatusSignals);
  const now = new Date();
  const dateISO = fullDayPlan?.dateISO || format(now, 'yyyy-MM-dd');

  const momentum = useMemo(
    () =>
      calculateMomentumScore({
        wakeConsistency: 0.75,
        sleepScore: dayState?.sleepQuality || 7,
        stressLevel: dayState?.stressLevel || 5,
        scheduleItems: fullDayPlan?.items || [],
        sleepDriftMinutes: 0,
      }),
    [dayState?.sleepQuality, dayState?.stressLevel, fullDayPlan?.items]
  );

  const recommendationContext = useMemo(() => {
    if (!profile || !fullDayPlan) return null;
    return buildRecommendationContext({
      dateISO,
      profile,
      dayState: dayState || null,
      plan: fullDayPlan,
      todayEntries,
      momentumScore: momentum.score,
      rhythmInsights: getRhythmInsights(null),
    });
  }, [profile, fullDayPlan, dayState, todayEntries, momentum.score, dateISO]);

  const recommendationOutput = recommendationContext
    ? generateRecommendationsFromContext(recommendationContext)
    : { cards: [], actions: [] as Array<{ id: string; label: string }> };

  const forecast = profile
    ? getForecastSnapshot(profile, fullDayPlan || undefined, dateISO, deviceId || undefined, normalizedSignals)
    : null;

  const handleAction = async (actionId: string) => {
    if (!profile || !fullDayPlan) return;

    if (actionId === 'RECOMPUTE_FROM_NOW') {
      await refreshFromNow();
      return;
    }

    if (actionId === 'INSERT_WALK_10' || actionId === 'INSERT_WALK_8') {
      const duration = actionId === 'INSERT_WALK_10' ? 10 : 8;
      const startMin = now.getHours() * 60 + now.getMinutes();
      await addTodayEntry({
        type: 'walk',
        title: `${duration}min Walk`,
        startISO: now.toISOString(),
        endISO: new Date(now.getTime() + duration * 60000).toISOString(),
        startMin,
        endMin: startMin + duration,
        durationMin: duration,
        isSystemAnchor: false,
        isFixedAnchor: false,
        fixed: false,
        locked: false,
        deletable: true,
        source: 'user',
        status: 'planned',
      });
      return;
    }

    if (actionId === 'ADD_HYDRATION_NOW') {
      const startMin = now.getHours() * 60 + now.getMinutes();
      await addTodayEntry({
        type: 'hydration',
        title: 'Hydration break',
        startISO: now.toISOString(),
        endISO: new Date(now.getTime() + 5 * 60000).toISOString(),
        startMin,
        endMin: startMin + 5,
        durationMin: 5,
        isSystemAnchor: false,
        isFixedAnchor: false,
        fixed: false,
        locked: false,
        deletable: true,
        source: 'user',
        status: 'planned',
      });
    }
  };

  const sendAdvisorMessage = async (
    rawText?: string,
    options?: { forcePreset?: boolean; requestSource?: 'starter-prompt' | 'free-text' }
  ) => {
    const text = (rawText || advisorInput).trim();
    if (!text || advisorLoading) return;

    setAdvisorError(null);
    setLlmUnavailableBanner(null);
    setAdvisorRenderState('loading');

    const userMessage: AdvisorMessage = { id: `u-${Date.now()}`, role: 'user', text };
    setAdvisorMessages((prev) => [...prev, userMessage]);
    setAdvisorInput('');
    setAdvisorLoading(true);

    try {
      const requestOptions: InsightsAdvisorOptions = {
        forcePreset: options?.forcePreset ?? false,
        requestSource: options?.requestSource ?? 'free-text',
      };

      const response = await askAdvisor(text, requestOptions);

      const llmUnavailable = isLlmUnavailableFailure(response);
      const validResponse = hasValidAdvisorResponse(response);
      const renderState: AdvisorRenderState = response.source === 'preset'
        ? 'preset'
        : validResponse
          ? 'valid'
          : llmUnavailable
            ? 'llm-unavailable'
            : 'error';

      console.log('[Insights][Advisor] request-result', {
        requestText: text,
        requestSource: requestOptions.requestSource,
        forcePreset: !!requestOptions.forcePreset,
        presetMatched: response.source === 'preset',
        llmFallbackAttempted: response.source === 'llm',
        source: response.source,
        intent: response.intent,
        llmUnavailable,
        validResponse,
        apiBaseUrl: process.env.EXPO_PUBLIC_API_URL || '(unset)',
        finalResponseSource: response.source,
        finalRenderState: renderState,
      });

      setAdvisorRenderState(renderState);

      if (llmUnavailable && !validResponse && requestOptions.requestSource === 'starter-prompt') {
        setAdvisorMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: 'advisor',
            text: 'I can answer many guided schedule questions right now. Try another starter prompt or rephrase your question.',
          },
        ]);
        setAdvisorRenderState('valid');
        return;
      }

      if (llmUnavailable && !validResponse) {
        setLlmUnavailableBanner('No LLM service available. Only preset questions are supported.');
        return;
      }

      if (!validResponse) {
        setAdvisorError('I could not process that right now. Try one of the starter prompts.');
        return;
      }

      const advisorMessage: AdvisorMessage = {
        id: `a-${Date.now()}`,
        role: 'advisor',
        text: response.directAnswer,
        response,
      };
      setAdvisorMessages((prev) => [...prev, advisorMessage]);
    } catch (error) {
      console.warn('[Insights][Advisor] request-failed', {
        requestText: text,
        requestSource: options?.requestSource || 'free-text',
        forcePreset: !!options?.forcePreset,
        presetMatched: false,
        llmFallbackAttempted: false,
        apiBaseUrl: process.env.EXPO_PUBLIC_API_URL || '(unset)',
        error: error instanceof Error ? error.message : String(error),
        finalResponseSource: 'none',
        finalRenderState: 'error',
      });
      setAdvisorRenderState('error');
      setAdvisorError('I could not process that right now. Try one of the starter prompts.');
    } finally {
      setAdvisorLoading(false);
    }
  };

  const addSuggestionToTimeline = async (message: AdvisorMessage) => {
    const inserts = message.response ? extractTimelineInserts(message.response) : [];
    if (!inserts.length) return;

    for (const insert of inserts) {
      await addTodayEntry(mapAdvisorInsertToScheduleItem(insert));
    }
    await refreshFromNow();
  };

  const ignoreSuggestion = (messageId: string) => {
    setIgnoredSuggestions((prev) => [...prev, messageId]);
  };

  if (!profile || !fullDayPlan) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', padding: spacing.lg }}>
        <Text style={[typography.bodyM, { color: colors.textSecondary }]}>Build today’s plan to unlock Insights.</Text>
      </View>
    );
  }

  const thinkingAction = recommendationOutput.actions[0]?.id || 'RECOMPUTE_FROM_NOW';

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={80}>
      <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ paddingBottom: spacing['2xl'] }}>
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
        <SectionTitle title="Insights" subtitle="Why AlignOS is making these decisions" />
        {discovery.shouldShow(1) ? (
          <Card>
            <Text style={[typography.caption, { color: colors.textSecondary }]}>Insights explain the model logic behind your schedule so you can trust and tune decisions.</Text>
            <View style={{ flexDirection: 'row', marginTop: spacing.xs }}>
              <Text onPress={() => void discovery.advanceLevel()} style={[typography.caption, { color: colors.accentPrimary, marginRight: spacing.md }]}>Got it</Text>
              <Text onPress={() => navigation?.navigate('HelpCenter', { initialTab: 'how' })} style={[typography.caption, { color: colors.accentPrimary }]}>Learn more</Text>
            </View>
          </Card>
        ) : null}
      </View>

      <EnergyForecast
        profile={profile}
        plan={fullDayPlan}
        deviceId={deviceId || undefined}
        dateISO={dateISO}
        quickStatusSignals={normalizedSignals}
        onAction={(id) => void handleAction(id)}
      />

      <MomentumScoreCard score={momentum.score} trend={momentum.trend} insights={momentum.insights} />

      <AlignOSThinkingCard
        insightTitle={forecast ? `Peak ${forecast.peakHour}:00 · Dip ${forecast.dipHour}:00` : 'Energy rhythm in progress'}
        insightDescription={`Signals: ${normalizedSignals.map((s) => QUICK_STATUS_LABELS[s]).join(', ') || 'stable'} · Confidence ${forecast?.confidence.label || 'Med'}`}
        recommendation={recommendationOutput.actions[0]?.label || 'Refresh from now'}
        onApplyRecommendation={() => void handleAction(thinkingAction)}
      />

      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
        <Card>
          <SectionTitle title="Ask AlignOS" subtitle="Reasoning layer for schedule interpretation and adjustments" />

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.sm }}>
            {ADVISOR_STARTER_PROMPTS.map((prompt) => (
              <TouchableOpacity
                key={prompt}
                onPress={() =>
                  void sendAdvisorMessage(prompt, {
                    forcePreset: true,
                    requestSource: 'starter-prompt',
                  })
                }
                style={{
                  borderWidth: 1,
                  borderColor: colors.borderSubtle,
                  backgroundColor: colors.surface,
                  borderRadius: 999,
                  paddingHorizontal: spacing.sm,
                  paddingVertical: spacing.xs,
                  marginRight: spacing.xs,
                  marginBottom: spacing.xs,
                }}
              >
                <Text style={[typography.caption, { color: colors.textSecondary }]}>{prompt}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity onPress={() => navigation?.navigate('Chat')} style={{ marginBottom: spacing.sm }}>
            <Text style={[typography.caption, { color: colors.accentPrimary }]}>Browse preset questions</Text>
          </TouchableOpacity>

          <View
            style={{
              height: 320,
              borderRadius: 12,
              backgroundColor: colors.background,
              padding: spacing.xs,
              marginTop: spacing.xs,
              marginBottom: spacing.sm,
            }}
          >
            <ScrollView
              contentContainerStyle={{ paddingBottom: spacing.md }}
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
            {llmUnavailableBanner && advisorRenderState === 'llm-unavailable' ? (
              <View
                style={{
                  borderWidth: 1,
                  borderColor: colors.warning,
                  backgroundColor: colors.warningSoft,
                  borderRadius: 12,
                  paddingHorizontal: spacing.sm,
                  paddingVertical: spacing.sm,
                  marginBottom: spacing.xs,
                }}
              >
                <Text style={[typography.caption, { color: colors.warning, fontWeight: '600' }]}>{llmUnavailableBanner}</Text>
              </View>
            ) : null}

            {advisorError && advisorRenderState === 'error' ? (
              <View
                style={{
                  borderWidth: 1,
                  borderColor: colors.error,
                  backgroundColor: colors.errorSoft,
                  borderRadius: 12,
                  paddingHorizontal: spacing.sm,
                  paddingVertical: spacing.sm,
                  marginBottom: spacing.xs,
                }}
              >
                <Text style={[typography.caption, { color: colors.error, fontWeight: '600' }]}>{advisorError}</Text>
              </View>
            ) : null}

            {advisorMessages.map((message) => {
              const isUser = message.role === 'user';
              return (
                <View
                  key={message.id}
                  style={{
                    alignSelf: isUser ? 'flex-end' : 'flex-start',
                    borderWidth: 1,
                    borderColor: isUser ? colors.accentPrimary : colors.borderSubtle,
                    backgroundColor: isUser ? colors.accentSoft : colors.surface,
                    borderRadius: 14,
                    paddingHorizontal: spacing.sm,
                    paddingVertical: spacing.sm,
                    marginBottom: spacing.xs,
                    maxWidth: '92%',
                  }}
                >
                  <Text style={[typography.bodyM, { color: isUser ? colors.accentPrimary : colors.textPrimary }]}>{message.text}</Text>

                  {message.response?.nextMoves?.length ? (
                    <View style={{ marginTop: spacing.xs }}>
                      {message.response.nextMoves.slice(0, 3).map((move, index) => (
                        <Text key={`${message.id}-move-${index}`} style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
                          • {move.time ? `${move.time} ` : ''}{move.title}
                        </Text>
                      ))}
                    </View>
                  ) : null}

                  {message.response && hasTimelineSuggestion(message.response) && !ignoredSuggestions.includes(message.id) ? (
                    <View style={{ flexDirection: 'row', marginTop: spacing.xs }}>
                      <TouchableOpacity
                        onPress={() => void addSuggestionToTimeline(message)}
                        style={{
                          borderWidth: 1,
                          borderColor: colors.accentPrimary,
                          backgroundColor: colors.accentSoft,
                          borderRadius: 10,
                          paddingHorizontal: spacing.sm,
                          paddingVertical: spacing.xs,
                          marginRight: spacing.xs,
                        }}
                      >
                        <Text style={[typography.caption, { color: colors.accentPrimary, fontWeight: '700' }]}>Add to Timeline</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => ignoreSuggestion(message.id)}
                        style={{
                          borderWidth: 1,
                          borderColor: colors.borderSubtle,
                          borderRadius: 10,
                          paddingHorizontal: spacing.sm,
                          paddingVertical: spacing.xs,
                        }}
                      >
                        <Text style={[typography.caption, { color: colors.textMuted }]}>Ignore</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </View>
              );
            })}

            {advisorLoading && advisorRenderState === 'loading' ? <Text style={[typography.caption, { color: colors.textMuted }]}>AlignOS is thinking…</Text> : null}
            </ScrollView>
          </View>

          <View style={{ flexDirection: 'row', marginTop: spacing.md, alignItems: 'flex-end' }}>
            <TextInput
              value={advisorInput}
              onChangeText={setAdvisorInput}
              placeholder="Ask about your energy, schedule, or momentum"
              placeholderTextColor={colors.textMuted}
              multiline
              style={{
                flex: 1,
                borderWidth: 1,
                borderColor: colors.borderSubtle,
                borderRadius: 12,
                backgroundColor: colors.surface,
                color: colors.textPrimary,
                paddingHorizontal: spacing.sm,
                paddingVertical: spacing.sm,
                maxHeight: 96,
                marginRight: spacing.xs,
              }}
            />
            <TouchableOpacity
              disabled={!advisorInput.trim() || advisorLoading}
              onPress={() =>
                void sendAdvisorMessage(undefined, {
                  forcePreset: false,
                  requestSource: 'free-text',
                })
              }
              style={{
                borderWidth: 1,
                borderColor: colors.accentPrimary,
                backgroundColor: advisorInput.trim() ? colors.accentSoft : colors.surface,
                borderRadius: 999,
                width: 38,
                height: 38,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AppIcon name="chevronUp" size={16} color={advisorInput.trim() ? colors.accentPrimary : colors.textMuted} />
            </TouchableOpacity>
          </View>
        </Card>
      </View>

      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
            <AppIcon name="sparkles" size={16} color={colors.textPrimary} />
            <Text style={[typography.bodyM, { color: colors.textPrimary, fontWeight: '700', marginLeft: spacing.xs }]}>Pattern Insights</Text>
          </View>
          {recommendationOutput.cards.slice(0, 5).map((card) => (
            <Text key={card} style={[typography.caption, { color: colors.textSecondary, marginBottom: 6 }]}>• {card}</Text>
          ))}
        </Card>
      </View>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}
