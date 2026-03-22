import React, { useMemo, useRef, useState } from 'react';
import { Animated, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@physiology-engine/ui';
import TourStep from '../../components/onboarding/TourStep';
import HighlightOverlay, {
  highlightAnchors,
  highlightEnergyForecast,
  highlightMomentumInsights,
  highlightSignalsPanel,
  highlightTimelineNow,
} from '../../components/onboarding/HighlightOverlay';
import { useTourProgress } from '../../hooks/useTourProgress';

type HighlightKey = 'energy' | 'anchors' | 'signals' | 'timeline' | 'insights';

interface TourItem {
  key: HighlightKey;
  headline: string;
  description: string;
}

const TOUR_STEPS: TourItem[] = [
  {
    key: 'energy',
    headline: 'Your energy changes throughout the day',
    description:
      'Your body naturally moves through cycles of higher and lower energy. AlignOS predicts these patterns to help you schedule activities at the best time.',
  },
  {
    key: 'anchors',
    headline: 'Anchors give your day structure',
    description:
      'Wake time, work hours, meals, and sleep are anchors. AlignOS builds your schedule around these stable points.',
  },
  {
    key: 'signals',
    headline: 'Signals help AlignOS understand how you feel',
    description:
      'Quick signals like "Hungry", "Low energy", or "High stress" help AlignOS adjust your schedule intelligently.',
  },
  {
    key: 'timeline',
    headline: 'Your timeline adapts throughout the day',
    description:
      'AlignOS generates your day once and then adapts it as conditions change.',
  },
  {
    key: 'insights',
    headline: 'AlignOS improves as it learns your patterns',
    description:
      'Over time the system detects patterns in your energy, sleep, and schedule habits. This allows it to make more accurate predictions and recommendations.',
  },
];

const highlightFor = (key: HighlightKey) => {
  if (key === 'anchors') return highlightAnchors();
  if (key === 'signals') return highlightSignalsPanel();
  if (key === 'timeline') return highlightTimelineNow();
  if (key === 'insights') return highlightMomentumInsights();
  return highlightEnergyForecast();
};

export default function LearnAlignOSTour({ navigation, route }: any) {
  const { colors, typography, spacing, radius } = useTheme();
  const { markCompleted } = useTourProgress();
  const [stepIndex, setStepIndex] = useState(0);
  const [isDone, setIsDone] = useState(false);
  const nextRoute = route?.params?.nextRoute;

  const fade = useRef(new Animated.Value(1)).current;
  const slide = useRef(new Animated.Value(0)).current;

  const step = TOUR_STEPS[stepIndex];
  const highlightRect = useMemo(() => highlightFor(step.key), [step.key]);

  const animateIn = () => {
    fade.setValue(0);
    slide.setValue(18);
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 260, useNativeDriver: true }),
      Animated.timing(slide, { toValue: 0, duration: 280, useNativeDriver: true }),
    ]).start();
  };

  const goNext = async () => {
    if (stepIndex < TOUR_STEPS.length - 1) {
      setStepIndex((prev) => prev + 1);
      animateIn();
      return;
    }

    await markCompleted();
    setIsDone(true);
  };

  const goBack = () => {
    if (stepIndex === 0) return;
    setStepIndex((prev) => prev - 1);
    animateIn();
  };

  const startUsingAlignOS = () => {
    try {
      navigation.navigate(nextRoute || 'MainTabs');
    } catch {
      navigation.goBack();
    }
  };

  const skipTour = () => {
    try {
      navigation.navigate(nextRoute || 'MainTabs');
    } catch {
      navigation.goBack();
    }
  };

  const reviewAgain = () => {
    setIsDone(false);
    setStepIndex(0);
    animateIn();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing['2xl'] }}>
        <Text style={[typography.titleL, { color: colors.textPrimary }]}>Learn AlignOS</Text>
        <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs }]}>Interactive tour</Text>

        <View
          style={{
            marginTop: spacing.md,
            borderWidth: 1,
            borderColor: colors.borderSubtle,
            borderRadius: radius.lg,
            backgroundColor: colors.surface,
            height: 560,
            overflow: 'hidden',
          }}
        >
          <View style={{ padding: spacing.md }}>
            <View style={{ borderWidth: 1, borderColor: colors.borderSubtle, borderRadius: 16, padding: spacing.md, height: 96, marginBottom: spacing.sm }}>
              <Text style={[typography.bodyM, { color: colors.textPrimary, fontWeight: '700' }]}>Energy Forecast</Text>
              <Text style={[typography.caption, { color: colors.textMuted, marginTop: 4 }]}>Peak · Dip · Confidence</Text>
            </View>

            <View style={{ borderWidth: 1, borderColor: colors.borderSubtle, borderRadius: 16, padding: spacing.md, height: 88, marginBottom: spacing.sm }}>
              <Text style={[typography.bodyM, { color: colors.textPrimary, fontWeight: '700' }]}>Anchors</Text>
              <Text style={[typography.caption, { color: colors.textMuted, marginTop: 4 }]}>Wake · Meals · Work · Sleep</Text>
            </View>

            <View style={{ borderWidth: 1, borderColor: colors.borderSubtle, borderRadius: 16, padding: spacing.md, height: 88, marginBottom: spacing.sm }}>
              <Text style={[typography.bodyM, { color: colors.textPrimary, fontWeight: '700' }]}>Signals</Text>
              <Text style={[typography.caption, { color: colors.textMuted, marginTop: 4 }]}>Hungry · Low energy · High stress</Text>
            </View>

            <View style={{ borderWidth: 1, borderColor: colors.borderSubtle, borderRadius: 16, padding: spacing.md, height: 98, marginBottom: spacing.sm }}>
              <Text style={[typography.bodyM, { color: colors.textPrimary, fontWeight: '700' }]}>Timeline</Text>
              <Text style={[typography.caption, { color: colors.textMuted, marginTop: 4 }]}>Now · Coming Up · Later Today</Text>
            </View>

            <View style={{ borderWidth: 1, borderColor: colors.borderSubtle, borderRadius: 16, padding: spacing.md, height: 84 }}>
              <Text style={[typography.bodyM, { color: colors.textPrimary, fontWeight: '700' }]}>Insights</Text>
              <Text style={[typography.caption, { color: colors.textMuted, marginTop: 4 }]}>Momentum score · Pattern learning</Text>
            </View>
          </View>

          {!isDone ? <HighlightOverlay visible target={highlightRect} /> : null}
        </View>

        {!isDone ? (
          <Animated.View style={{ marginTop: spacing.md, opacity: fade, transform: [{ translateX: slide }] }}>
            <TourStep
              index={stepIndex + 1}
              total={TOUR_STEPS.length}
              headline={step.headline}
              description={step.description}
              onContinue={() => void goNext()}
              onBack={stepIndex > 0 ? goBack : undefined}
              secondaryLabel={stepIndex === 0 ? 'Skip for now' : undefined}
              onSecondary={stepIndex === 0 ? skipTour : undefined}
            />
          </Animated.View>
        ) : (
          <View
            style={{
              marginTop: spacing.md,
              borderWidth: 1,
              borderColor: colors.borderSubtle,
              borderRadius: radius.lg,
              backgroundColor: colors.surfaceElevated,
              padding: spacing.lg,
            }}
          >
            <Text style={[typography.titleM, { color: colors.textPrimary }]}>You're ready to start your day</Text>
            <Text style={[typography.bodyM, { color: colors.textSecondary, marginTop: spacing.sm }]}>You can replay this tour anytime from Help Center or Settings.</Text>

            <TouchableOpacity
              onPress={startUsingAlignOS}
              style={{
                marginTop: spacing.md,
                borderWidth: 1,
                borderColor: colors.accentPrimary,
                backgroundColor: colors.accentSoft,
                borderRadius: radius.md,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
              }}
            >
              <Text style={[typography.caption, { color: colors.accentPrimary, fontWeight: '700' }]}>Start Using AlignOS</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={reviewAgain} style={{ marginTop: spacing.sm }}>
              <Text style={[typography.caption, { color: colors.textMuted }]}>Review Tour Again</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
