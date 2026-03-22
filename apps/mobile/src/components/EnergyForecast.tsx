/**
 * AlignOS Energy Forecast Component
 * Clean OS-level energy prediction with teal/cyan palette only
 */

import React from 'react';
import { View, Text, StyleSheet, Animated, Easing, TouchableOpacity, type LayoutChangeEvent } from 'react-native';
import { format } from 'date-fns';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Circle, Rect, Line } from 'react-native-svg';
import type { DayPlan, UserProfile } from '@physiology-engine/shared';
import { AppIcon } from '../ui/components/AppIcon';
import { Colors } from '../ui/theme/colors';
import { Spacing } from '../ui/theme/spacing';
import { Radius } from '../ui/theme/radius';
import { Typography, FontWeight } from '../ui/theme/typography';
import { Shadows } from '../ui/theme/shadows';
import { formatNumber } from '../ui/utils/format';
import { deriveQuickStatusSummary } from '../engine/quickStatusEngine';
import { QUICK_STATUS_LABELS, normalizeQuickStatusSignals, type QuickStatusSignal } from '../types/quickStatus';
import TooltipModal from './help/TooltipModal';
import WhyThisModal from './help/WhyThisModal';

interface EnergyForecastProps {
  profile: UserProfile;
  plan?: DayPlan;
  deviceId?: string;
  dateISO?: string;
  quickStatusSignals?: QuickStatusSignal[];
  onAction?: (actionId: string) => void;
}

interface EnergyPoint {
  hour: number;
  energy: number; // 0-100
  label: string;
}

interface ForecastConfidence {
  score: number;
  label: 'High' | 'Med' | 'Low';
}

interface ForecastResult {
  points: EnergyPoint[];
  confidence: ForecastConfidence;
}

export interface ForecastSnapshot {
  peakHour: number;
  peakEnergy: number;
  dipHour: number;
  dipEnergy: number;
  confidence: ForecastConfidence;
}

interface InsightAction {
  id: 'INSERT_WALK_10' | 'SHIFT_LUNCH_EARLIER_15' | 'RECOMPUTE_FROM_NOW';
  label: string;
}

interface EnergyInsight {
  icon: string;
  text: string;
  action?: InsightAction;
}

interface AnchorMarker {
  key: string;
  hour: number;
  type: 'wake' | 'meal' | 'walk' | 'workout' | 'sleep';
}

const AnimatedPath = Animated.createAnimatedComponent(Path);

export default function EnergyForecast({ profile, plan, deviceId, dateISO, quickStatusSignals, onAction }: EnergyForecastProps) {
  const chartOpacity = React.useRef(new Animated.Value(0)).current;
  const lineProgress = React.useRef(new Animated.Value(0)).current;
  const peakPulse = React.useRef(new Animated.Value(0)).current;
  const [chartWidth, setChartWidth] = React.useState(0);
  const [showTooltip, setShowTooltip] = React.useState(false);
  const [showWhyThis, setShowWhyThis] = React.useState(false);

  const activeDateISO = dateISO || plan?.dateISO || format(new Date(), 'yyyy-MM-dd');
  const normalizedSignals = normalizeQuickStatusSignals(quickStatusSignals || []);
  const forecastKey = buildForecastKey(profile, plan, activeDateISO, deviceId, normalizedSignals);

  const forecastResult = React.useMemo(
    () => generateEnergyForecast(profile, plan, activeDateISO, deviceId, normalizedSignals),
    [forecastKey]
  );

  const forecast = forecastResult.points;
  const currentHour = new Date().getHours();
  const currentEnergy = forecast.find(p => p.hour === currentHour)?.energy || 50;
  const showApproxNow = forecastResult.confidence.label === 'Low';
  const insights = React.useMemo(
    () => getEnergyInsights(forecast, currentHour, profile, plan, forecastResult.confidence, normalizedSignals),
    [forecastKey, currentHour]
  );

  const anchorMarkers = React.useMemo(() => getAnchorMarkers(plan), [plan]);
  const peakPoint = React.useMemo(() => forecast.reduce((max, point) => (point.energy > max.energy ? point : max), forecast[0]), [forecast]);
  const dipPoint = React.useMemo(() => {
    const dipWindow = forecast.filter((point) => point.hour >= 12 && point.hour <= 16);
    return dipWindow.reduce((min, point) => (point.energy < min.energy ? point : min), dipWindow[0] || forecast[0]);
  }, [forecast]);

  React.useEffect(() => {
    chartOpacity.setValue(0);
    lineProgress.setValue(0);
    Animated.parallel([
      Animated.timing(chartOpacity, {
        toValue: 1,
        duration: 280,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(lineProgress, {
        toValue: 1,
        duration: 620,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
    ]).start();
  }, [forecastKey]);

  React.useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(peakPulse, { toValue: 1, duration: 1000, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(peakPulse, { toValue: 0, duration: 1000, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, []);

  const onChartLayout = (event: LayoutChangeEvent) => {
    setChartWidth(event.nativeEvent.layout.width);
  };

  const chartHeight = 116;
  const linePath = chartWidth > 0 ? buildSmoothPath(forecast, chartWidth, chartHeight) : '';
  const lineLength = Math.max(1, forecast.length * 40);
  const lineDashOffset = lineProgress.interpolate({ inputRange: [0, 1], outputRange: [lineLength, 0] });
  const peakScale = peakPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.2] });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <AppIcon name="energy" size={16} color={Colors.TextPrimary} />
          <Text style={styles.title}>Energy Forecast</Text>
          <TouchableOpacity onPress={() => setShowTooltip(true)} style={{ marginLeft: 6 }}>
            <Text style={{ color: Colors.AccentPrimary, fontWeight: '700' }}>?</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.badgesWrap}>
          <View style={styles.currentBadge}>
            <Text style={styles.currentText}>{showApproxNow ? `Now ~${formatNumber(currentEnergy, 0)}%` : `Now ${formatNumber(currentEnergy, 0)}%`}</Text>
          </View>
          <View style={styles.confidenceBadge}>
            <View style={[styles.confidenceDot, {
              backgroundColor: forecastResult.confidence.label === 'High'
                ? Colors.AccentPrimary
                : forecastResult.confidence.label === 'Med'
                  ? Colors.AccentSecondary
                  : Colors.TextMuted,
            }]} />
            <Text style={styles.confidenceText}>{forecastResult.confidence.label}</Text>
          </View>
        </View>
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 4 }}>
        <TouchableOpacity onPress={() => setShowWhyThis(true)}>
          <Text style={{ color: Colors.AccentPrimary, fontSize: 12, fontWeight: '600' }}>Why this?</Text>
        </TouchableOpacity>
      </View>

      <Animated.View style={[styles.chartContainer, { opacity: chartOpacity }]} onLayout={onChartLayout}>
        <View style={styles.gridlines}>
          <View style={[styles.gridline, { bottom: 26 }]} />
          <View style={[styles.gridline, { bottom: 52 }]} />
          <View style={[styles.gridline, { bottom: 78 }]} />
        </View>

        {chartWidth > 0 && (
          <Svg width={chartWidth} height={chartHeight + 14} style={styles.lineOverlay}>
            <Rect
              x={xForHour(Math.max(0, peakPoint.hour - 0.5), chartWidth)}
              y={8}
              width={Math.max(10, xForHour(peakPoint.hour + 0.5, chartWidth) - xForHour(peakPoint.hour - 0.5, chartWidth))}
              height={chartHeight - 8}
              fill={`${Colors.AccentPrimary}10`}
              rx={6}
            />
            <Rect
              x={xForHour(Math.max(0, dipPoint.hour - 0.5), chartWidth)}
              y={8}
              width={Math.max(10, xForHour(dipPoint.hour + 0.5, chartWidth) - xForHour(dipPoint.hour - 0.5, chartWidth))}
              height={chartHeight - 8}
              fill={`${Colors.TextMuted}16`}
              rx={6}
            />
            {linePath ? (
              <AnimatedPath
                d={linePath}
                stroke={Colors.AccentPrimary}
                strokeWidth={1.8}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={lineLength}
                strokeDashoffset={lineDashOffset as unknown as number}
              />
            ) : null}
            <Line
              x1={xForHour(peakPoint.hour, chartWidth)}
              x2={xForHour(peakPoint.hour, chartWidth)}
              y1={8}
              y2={chartHeight}
              stroke={`${Colors.AccentPrimary}66`}
              strokeWidth={1}
            />
            <Circle cx={xForHour(dipPoint.hour, chartWidth)} cy={yForEnergy(dipPoint.energy, chartHeight)} r={3} fill={Colors.TextMuted} />
          </Svg>
        )}

        <View style={styles.chart}>
          {forecast.map((point) => {
            const isCurrent = point.hour === currentHour;
            const height = Math.max(point.energy, 10);

            return (
              <View key={point.hour} style={styles.barContainer}>
                <View style={styles.barWrapper}>
                  <LinearGradient
                    colors={resolveEnergyGradient(point.energy)}
                    start={{ x: 0, y: 1 }}
                    end={{ x: 0, y: 0 }}
                    style={[
                      styles.bar,
                      {
                        height: `${height}%`,
                        opacity: isCurrent ? 1 : 0.86,
                      },
                    ]}
                  />
                  {isCurrent && <View style={styles.nowIndicator} />}
                </View>
                {(point.hour % 3 === 0) && (
                  <Text style={styles.timeLabel}>
                    {format(new Date().setHours(point.hour, 0, 0, 0), 'ha')}
                  </Text>
                )}
              </View>
            );
          })}
        </View>

        {chartWidth > 0 && anchorMarkers.length > 0 && (
          <View style={styles.anchorTrack}>
            {anchorMarkers.map((marker) => (
              <View key={marker.key} style={[styles.anchorMarker, { left: xForHour(marker.hour, chartWidth) - 8 }]}>
                <View style={[styles.anchorDot, anchorStyle(marker.type)]} />
              </View>
            ))}
          </View>
        )}

        {chartWidth > 0 && (
          <Animated.View
            style={[
              styles.peakPulse,
              {
                left: xForHour(peakPoint.hour, chartWidth) - 6,
                top: yForEnergy(peakPoint.energy, chartHeight) - 6,
                transform: [{ scale: peakScale }],
              },
            ]}
          />
        )}

        <View style={styles.labelsRow}>
          <Text style={styles.peakLabel}>Peak {format(new Date().setHours(peakPoint.hour, 0, 0, 0), 'ha')}</Text>
          <Text style={styles.dipLabel}>Dip {format(new Date().setHours(dipPoint.hour, 0, 0, 0), 'ha')}</Text>
        </View>
      </Animated.View>

      <TooltipModal
        visible={showTooltip}
        onClose={() => setShowTooltip(false)}
        title="Energy Forecast"
        description="This projects your energy rhythm from anchors, recent signals, and current timing so you can protect high-output windows."
        example="If a likely dip appears at 1 PM, a short walk or earlier lunch may be recommended."
      />

      <WhyThisModal
        visible={showWhyThis}
        onClose={() => setShowWhyThis(false)}
        title="Forecast recommendations"
        explanation="Actions are selected when the model sees a peak-to-dip transition risk and can improve schedule stability from now."
      />

      <View style={styles.insights}>
        {insights.slice(0, 3).map((insight, i) => (
          <View key={i} style={styles.insight}>
            <AppIcon name={insight.icon as any} size={13} color={Colors.TextSecondary} />
            <View style={styles.insightContent}>
              <Text style={styles.insightText}>{insight.text}</Text>
              {insight.action ? (
                <TouchableOpacity onPress={() => onAction?.(insight.action!.id)}>
                  <Text style={styles.insightActionText}>Action: {insight.action.label}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function resolveEnergyGradient(energy: number): [string, string] {
  if (energy <= 38) return [`${Colors.TextMuted}A0`, `${Colors.TextMuted}66`];
  if (energy <= 70) return [Colors.AccentSecondary, `${Colors.AccentSecondary}99`];
  return [Colors.AccentPrimary, Colors.AccentSecondary];
}

function getAnchorMarkers(plan?: DayPlan): AnchorMarker[] {
  if (!plan?.items?.length) return [];

  const markers = plan.items
    .map((item) => {
      const hour = new Date(item.startISO).getHours();
      if (item.type === 'wake') return { key: `${item.id}-wake`, hour, type: 'wake' as const };
      if (item.type === 'sleep') return { key: `${item.id}-sleep`, hour, type: 'sleep' as const };
      if (item.type === 'meal' || item.type === 'snack') return { key: `${item.id}-meal`, hour, type: 'meal' as const };
      if (item.type === 'walk') return { key: `${item.id}-walk`, hour, type: 'walk' as const };
      if (item.type === 'workout') return { key: `${item.id}-workout`, hour, type: 'workout' as const };
      return null;
    })
    .filter((value): value is AnchorMarker => Boolean(value));

  return markers.slice(0, 14);
}

function xForHour(hour: number, width: number): number {
  if (width <= 0) return 0;
  const normalized = Math.max(0, Math.min(23, hour));
  const unit = width / 24;
  return (normalized + 0.5) * unit;
}

function yForEnergy(energy: number, chartHeight: number): number {
  const scaled = Math.max(10, Math.min(95, energy));
  return chartHeight - ((scaled / 100) * chartHeight);
}

function buildSmoothPath(points: EnergyPoint[], width: number, height: number): string {
  if (!points.length) return '';

  const coords = points.map((point) => ({
    x: xForHour(point.hour, width),
    y: yForEnergy(point.energy, height),
  }));

  let path = `M ${coords[0].x.toFixed(2)} ${coords[0].y.toFixed(2)}`;
  for (let i = 1; i < coords.length; i++) {
    const prev = coords[i - 1];
    const current = coords[i];
    const controlX = (prev.x + current.x) / 2;
    path += ` C ${controlX.toFixed(2)} ${prev.y.toFixed(2)}, ${controlX.toFixed(2)} ${current.y.toFixed(2)}, ${current.x.toFixed(2)} ${current.y.toFixed(2)}`;
  }
  return path;
}

function anchorStyle(type: AnchorMarker['type']) {
  if (type === 'wake' || type === 'sleep') {
    return { backgroundColor: `${Colors.TextSecondary}AA`, borderColor: Colors.Border };
  }
  if (type === 'meal') {
    return { backgroundColor: `${Colors.AccentSecondary}CC`, borderColor: `${Colors.AccentSecondary}99` };
  }
  if (type === 'walk') {
    return { backgroundColor: `${Colors.AccentPrimary}AA`, borderColor: `${Colors.AccentPrimary}77` };
  }
  return { backgroundColor: Colors.AccentPrimary, borderColor: `${Colors.AccentPrimary}99` };
}

function generateEnergyForecast(
  profile: UserProfile,
  plan: DayPlan | undefined,
  dateISO: string,
  deviceId?: string,
  quickStatusSignals: QuickStatusSignal[] = []
): ForecastResult {
  const wakeTime = parseHour(profile.wakeTime, 7);
  const sleepTime = parseHour(profile.sleepTime, 23);
  const confidence = computeConfidence(profile, plan);
  const seedKey = buildForecastKey(profile, plan, dateISO, deviceId, quickStatusSignals);
  const rng = mulberry32(hashStringToSeed(seedKey));

  const hourlyEnergy = new Array<number>(24).fill(50);

  for (let hour = 0; hour < 24; hour++) {
    let energy = 50; // baseline

    // Circadian rhythm curve
    if (hour >= wakeTime && hour < sleepTime) {
      // Awake hours
      const hoursAwake = hour - wakeTime;
      
      // Morning rise (cortisol awakening response)
      if (hoursAwake < 2) {
        energy = 50 + (hoursAwake * 15); // Gradual rise
      }
      // Mid-morning peak
      else if (hoursAwake >= 2 && hoursAwake < 5) {
        energy = 82;
      }
      // Post-lunch dip (natural circadian trough)
      else if (hoursAwake >= 5 && hoursAwake < 7) {
        energy = 55 - ((hoursAwake - 5) * 5); // Dip to ~45%
      }
      // Afternoon recovery
      else if (hoursAwake >= 7 && hoursAwake < 10) {
        energy = 45 + ((hoursAwake - 7) * 10); // Rise to ~75%
      }
      // Evening plateau
      else if (hoursAwake >= 10 && hoursAwake < 12) {
        energy = 75 - ((hoursAwake - 10) * 5);
      }
      // Pre-sleep decline (melatonin rise)
      else {
        energy = Math.max(30, 65 - ((hoursAwake - 12) * 15));
      }
    } else {
      // Sleep hours - very low energy
      energy = 13;
    }

    // Fitness goal adjustments
    const goal = profile.fitnessGoal || 'MAINTENANCE';
    if (goal === 'FAT_LOSS' || goal === 'WEIGHT_LOSS') {
      // Calorie deficit can reduce energy slightly
      energy -= 5;
    } else if (goal === 'PERFORMANCE') {
      // Well-fueled athletes have higher baseline
      energy += 5;
    }

    if (isNoiseWindow(hour, wakeTime, sleepTime)) {
      energy += seededOffset(rng, 2);
    }

    hourlyEnergy[hour] = clampEnergy(energy);
  }

  applyPlanModifiers(hourlyEnergy, plan);
  applyQuickStatusModifiers(hourlyEnergy, quickStatusSignals);

  const points = hourlyEnergy.map((energy, hour) => ({
    hour,
    energy: Math.round(clampEnergy(energy)),
    label: format(new Date().setHours(hour, 0, 0, 0), 'ha'),
  }));

  return { points, confidence };
}

function getEnergyInsights(
  forecast: EnergyPoint[],
  currentHour: number,
  profile: UserProfile,
  plan: DayPlan | undefined,
  confidence: ForecastConfidence,
  quickStatusSignals: QuickStatusSignal[]
): EnergyInsight[] {
  const insights: EnergyInsight[] = [];

  const peakPoint = forecast.reduce((max, p) => p.energy > max.energy ? p : max, forecast[0]);
  const peakEndHour = (peakPoint.hour + 1) % 24;
  const nearbyAnchor = plan?.items.find((item) => {
    const hour = new Date(item.startISO).getHours();
    return Math.abs(hour - peakPoint.hour) <= 1 && (item.type === 'workout' || item.type === 'walk' || item.type === 'meal' || item.type === 'snack');
  });
  const peakWhy = nearbyAnchor
    ? `supported by ${nearbyAnchor.type} anchor`
    : `from wake timing (${profile.wakeTime}) and circadian rise`;

  insights.push({
    icon: 'target',
    text: `Peak window: ${format(new Date().setHours(peakPoint.hour, 0, 0, 0), 'ha')}-${format(new Date().setHours(peakEndHour, 0, 0, 0), 'ha')} (${peakWhy})`,
    action: { id: 'RECOMPUTE_FROM_NOW', label: 'Recompute from now for peak block' },
  });

  const dipWindow = forecast.filter(point => point.hour >= 13 && point.hour <= 16);
  const dipPoint = dipWindow.reduce((min, point) => point.energy < min.energy ? point : min, dipWindow[0] || forecast[0]);
  const hasMealInDipWindow = (plan?.items || []).some((item) => {
    if (item.type !== 'meal' && item.type !== 'snack') return false;
    const mealHour = new Date(item.startISO).getHours();
    return mealHour >= 12 && mealHour <= 16;
  });
  const estimatedSleepHours = estimateSleepHours(profile.wakeTime, profile.sleepTime);
  const poorSleep = estimatedSleepHours < 7;
  const highStress = profile.stressBaseline >= 7;

  if (hasMealInDipWindow || poorSleep || highStress) {
    const dipReason = hasMealInDipWindow
      ? 'meal timing overlap'
      : poorSleep
        ? `short sleep (${estimatedSleepHours.toFixed(1)}h)`
        : `higher stress baseline (${profile.stressBaseline}/10)`;

    insights.push({
      icon: 'clock',
      text: `Likely dip near ${format(new Date().setHours(dipPoint.hour, 0, 0, 0), 'ha')} due to ${dipReason}`,
      action: hasMealInDipWindow
        ? { id: 'SHIFT_LUNCH_EARLIER_15', label: 'Shift lunch earlier by 15 min' }
        : { id: 'INSERT_WALK_10', label: 'Insert 10-min walk before dip' },
    });
  }

  const currentEnergy = forecast.find(p => p.hour === currentHour)?.energy || 50;
  if (currentHour >= 13 && currentHour <= 16) {
    if (currentEnergy < 45) {
      insights.push({
        icon: 'walk',
        text: `Current dip active (~${currentEnergy}%) — use short movement and low-cognitive work`,
        action: { id: 'INSERT_WALK_10', label: 'Insert 10-min walk now' },
      });
    }
  }

  if (insights.length < 3 && currentEnergy > 72 && currentHour >= 6 && currentHour < 22) {
    insights.push({
      icon: 'energy',
      text: `High output now (${currentEnergy}%) — best time for demanding work or training`,
    });
  } else if (insights.length < 3 && currentEnergy < 40 && currentHour >= 6 && currentHour < 22) {
    insights.push({
      icon: 'walk',
      text: `Low state now (${currentEnergy}%) — favor recovery tasks until rebound`,
      action: { id: 'INSERT_WALK_10', label: 'Insert 10-min walk now' },
    });
  }

  if (insights.length < 3 && confidence.label === 'Low') {
    insights.push({
      icon: 'info',
      text: 'Forecast confidence is low: add consistent meal and movement anchors for tighter accuracy.',
    });
  }

  if (insights.length < 3 && quickStatusSignals.length > 0) {
    const labels = quickStatusSignals.slice(0, 2).map((signal) => QUICK_STATUS_LABELS[signal]).join(', ');
    insights.push({
      icon: 'info',
      text: `Quick Status impact active (${labels}) — forecast includes adaptive modifiers.`,
    });
  }

  return insights.slice(0, 3);
}

function applyQuickStatusModifiers(hourlyEnergy: number[], quickStatusSignals: QuickStatusSignal[]): void {
  if (!quickStatusSignals.length) return;
  const summary = deriveQuickStatusSummary(quickStatusSignals);
  if (summary.modifier === 0) return;

  for (let hour = 0; hour < hourlyEnergy.length; hour++) {
    const daytimePenalty = hour >= 8 && hour <= 20 ? summary.modifier : Math.round(summary.modifier * 0.5);
    hourlyEnergy[hour] = clampEnergy(hourlyEnergy[hour] + daytimePenalty);
  }
}

function applyPlanModifiers(hourlyEnergy: number[], plan?: DayPlan): void {
  if (!plan?.items?.length) return;

  const effectiveItems = selectEffectiveItems(plan.items);

  for (const item of effectiveItems) {
    const itemHour = new Date(item.startISO).getHours();
    const workoutKind = inferWorkoutKind(item.title, item.notes);
    const mealKind = inferMealKind(item.title, item.notes);
    const isLateWorkout = itemHour >= 19;

    if (item.type === 'walk') {
      applyDelta(hourlyEnergy, itemHour, 4);
      applyDelta(hourlyEnergy, itemHour + 1, 2);
    }

    if (item.type === 'workout') {
      if (workoutKind === 'cardio') {
        applyDelta(hourlyEnergy, itemHour, 5);
        applyDelta(hourlyEnergy, itemHour + 1, 3);
      } else {
        applyDelta(hourlyEnergy, itemHour, 3);
        applyDelta(hourlyEnergy, itemHour + 1, 6);
        applyDelta(hourlyEnergy, itemHour + 2, 6);
      }

      if (isLateWorkout) {
        applyDelta(hourlyEnergy, itemHour, -2);
      }
    }

    if (item.type === 'meal' || item.type === 'snack') {
      if (mealKind === 'lean') {
        applyDelta(hourlyEnergy, itemHour, -2);
        applyDelta(hourlyEnergy, itemHour + 1, 2);
      } else if (mealKind === 'comfort') {
        applyDelta(hourlyEnergy, itemHour, -6);
        applyDelta(hourlyEnergy, itemHour + 1, -2);
        applyDelta(hourlyEnergy, itemHour + 2, 1);
      }
    }

    if (isCaffeineItem(item.title, item.notes, item.type)) {
      applyDelta(hourlyEnergy, itemHour, 6);
      applyDelta(hourlyEnergy, itemHour + 1, 6);
      applyDelta(hourlyEnergy, itemHour + 3, -4);
      applyDelta(hourlyEnergy, itemHour + 4, -4);
      applyDelta(hourlyEnergy, itemHour + 5, -4);
    }
  }

  for (let i = 0; i < hourlyEnergy.length; i++) {
    hourlyEnergy[i] = clampEnergy(hourlyEnergy[i]);
  }
}

function selectEffectiveItems(items: DayPlan['items']): DayPlan['items'] {
  const buckets = new Map<string, DayPlan['items'][number]>();

  for (const item of items) {
    const hour = new Date(item.startISO).getHours();
    const anchorType = getAnchorType(item);
    const key = `${anchorType}:${hour}`;
    const existing = buckets.get(key);

    if (!existing) {
      buckets.set(key, item);
      continue;
    }

    const existingActual = existing.origin === 'actual';
    const incomingActual = item.origin === 'actual';

    if (!existingActual && incomingActual) {
      buckets.set(key, item);
    }
  }

  return Array.from(buckets.values()).sort((a, b) => new Date(a.startISO).getTime() - new Date(b.startISO).getTime());
}

function getAnchorType(item: DayPlan['items'][number]): 'meal' | 'walk' | 'workout' | 'caffeine' | 'other' {
  if (item.type === 'meal' || item.type === 'snack' || item.type === 'walk' || item.type === 'workout') {
    return item.type === 'snack' ? 'meal' : item.type;
  }
  if (item.meta?.actualType === 'meal' || item.meta?.actualType === 'snack' || item.meta?.actualType === 'walk' || item.meta?.actualType === 'workout') {
    return item.meta.actualType === 'snack' ? 'meal' : item.meta.actualType;
  }
  if (isCaffeineItem(item.title, item.notes, item.type)) return 'caffeine';
  return 'other';
}

function computeConfidence(profile: UserProfile, plan?: DayPlan): ForecastConfidence {
  const hasWakeSleep = Boolean(profile.wakeTime && profile.sleepTime);
  const hasWorkBlock = Boolean(profile.workStartTime && profile.workEndTime);
  const mealAnchors = (plan?.items || []).filter((item) => item.type === 'meal' || item.type === 'snack').length;
  const movementAnchors = (plan?.items || []).filter((item) => item.type === 'walk' || item.type === 'workout').length;
  const actualCount = (plan?.items || []).filter((item) => item.status === 'actual' || item.origin === 'actual').length;

  let score = 0;
  if (hasWakeSleep) score += 40;
  if (hasWorkBlock) score += 20;
  if (mealAnchors >= 2) score += 20;
  if (movementAnchors >= 1) score += 20;
  if (actualCount >= 2) score += 10;
  if (actualCount >= 4) score += 10;

  const capped = Math.min(100, score);
  const label: ForecastConfidence['label'] = capped >= 75 ? 'High' : capped >= 50 ? 'Med' : 'Low';
  return { score: capped, label };
}

export function buildForecastKey(
  profile: UserProfile,
  plan: DayPlan | undefined,
  dateISO: string,
  deviceId?: string,
  quickStatusSignals: QuickStatusSignal[] = []
): string {
  const identity = deviceId || (profile as { id?: string }).id || 'anonymous';
  const planSummary = (plan?.items || [])
    .map((item) => {
      const hour = new Date(item.startISO).getHours();
      return `${item.type}@${hour}:${item.title.toLowerCase().trim()}:${(item.notes || '').toLowerCase().trim()}`;
    })
    .sort()
    .join('|');

  return [
    dateISO,
    identity,
    profile.wakeTime,
    profile.sleepTime,
    profile.workStartTime || '-',
    profile.workEndTime || '-',
    quickStatusSignals.sort().join(','),
    planSummary,
  ].join('::');
}

export function getForecastSnapshot(
  profile: UserProfile,
  plan: DayPlan | undefined,
  dateISO: string,
  deviceId?: string,
  quickStatusSignals: QuickStatusSignal[] = []
): ForecastSnapshot {
  const result = generateEnergyForecast(profile, plan, dateISO, deviceId, quickStatusSignals);
  const peakPoint = result.points.reduce((max, point) => (point.energy > max.energy ? point : max), result.points[0]);
  const dipWindow = result.points.filter((point) => point.hour >= 12 && point.hour <= 16);
  const dipPoint = dipWindow.reduce((min, point) => (point.energy < min.energy ? point : min), dipWindow[0] || result.points[0]);

  return {
    peakHour: peakPoint.hour,
    peakEnergy: peakPoint.energy,
    dipHour: dipPoint.hour,
    dipEnergy: dipPoint.energy,
    confidence: result.confidence,
  };
}

function parseHour(time: string | undefined, fallback: number): number {
  if (!time) return fallback;
  const parsed = Number(time.split(':')[0]);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function clampEnergy(value: number): number {
  return Math.max(10, Math.min(95, value));
}

function estimateSleepHours(wakeTime: string, sleepTime: string): number {
  const wakeHour = parseHour(wakeTime, 7);
  const sleepHour = parseHour(sleepTime, 23);

  if (sleepHour > wakeHour) {
    return 24 - sleepHour + wakeHour;
  }
  return wakeHour - sleepHour;
}

function applyDelta(hourlyEnergy: number[], hour: number, delta: number): void {
  const normalizedHour = ((hour % 24) + 24) % 24;
  hourlyEnergy[normalizedHour] += delta;
}

function seededOffset(rng: () => number, maxAbs: number): number {
  const span = maxAbs * 2 + 1;
  return Math.floor(rng() * span) - maxAbs;
}

function isNoiseWindow(hour: number, wakeHour: number, sleepHour: number): boolean {
  const awake = hour >= wakeHour && hour < sleepHour;
  if (!awake) return true;

  const hoursAwake = hour - wakeHour;
  return (hoursAwake >= 2 && hoursAwake <= 5) || (hoursAwake >= 10 && hoursAwake <= 12);
}

function normalizeText(...parts: Array<string | undefined>): string {
  return parts.filter(Boolean).join(' ').toLowerCase();
}

function inferWorkoutKind(title: string, notes?: string): 'strength' | 'cardio' {
  const text = normalizeText(title, notes);
  if (/cardio|run|running|cycle|bike|hiit|jog/.test(text)) return 'cardio';
  return 'strength';
}

function inferMealKind(title: string, notes?: string): 'lean' | 'comfort' | 'neutral' {
  const text = normalizeText(title, notes);
  if (/comfort|carb|dessert|treat|pudding|sweet|heavy/.test(text)) return 'comfort';
  if (/lean|protein|chicken|fish|eggs|turkey/.test(text)) return 'lean';
  return 'neutral';
}

function isCaffeineItem(title: string, notes: string | undefined, type: string): boolean {
  if (type === 'custom') {
    return /coffee|caffeine|espresso|tea|pre-workout/.test(normalizeText(title, notes));
  }
  return /coffee|caffeine|espresso|tea|pre-workout/.test(normalizeText(title, notes));
}

function hashStringToSeed(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index++) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state += 0x6D2B79F5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.SurfaceElevated,
    borderWidth: 1,
    borderColor: Colors.Border,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    marginHorizontal: Spacing.xl,
    marginVertical: Spacing.md,
    ...Shadows.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  title: {
    fontSize: Typography.Body,
    fontWeight: FontWeight.Semi,
    color: Colors.TextPrimary,
  },
  currentBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    backgroundColor: `${Colors.AccentPrimary}1A`, // 10% opacity
    borderWidth: 1,
    borderColor: Colors.AccentPrimary,
  },
  currentText: {
    fontSize: Typography.Caption,
    fontWeight: FontWeight.Semi,
    color: Colors.AccentPrimary,
    letterSpacing: 0.3,
  },
  badgesWrap: {
    alignItems: 'flex-end',
    gap: 6,
  },
  confidenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.Border,
    backgroundColor: Colors.Surface,
  },
  confidenceDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  confidenceText: {
    fontSize: Typography.Micro,
    color: Colors.TextSecondary,
    letterSpacing: 0.2,
  },
  chartContainer: {
    position: 'relative',
    marginBottom: Spacing.lg,
    paddingTop: 8,
  },
  chart: {
    flexDirection: 'row',
    height: 116,
    alignItems: 'flex-end',
    gap: 3,
  },
  barContainer: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  barWrapper: {
    width: '100%',
    height: 116,
    justifyContent: 'flex-end',
    position: 'relative',
  },
  bar: {
    width: '100%',
    minHeight: 10,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  nowIndicator: {
    position: 'absolute',
    top: -6,
    left: '50%',
    marginLeft: -3,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.AccentPrimary,
  },
  timeLabel: {
    fontSize: Typography.Micro,
    color: Colors.TextMuted,
    letterSpacing: 0.4,
  },
  lineOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
    pointerEvents: 'none',
  },
  gridlines: {
    position: 'absolute',
    top: 8,
    left: 0,
    right: 0,
    height: 116,
    pointerEvents: 'none',
  },
  gridline: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: Colors.Border,
    opacity: 0.2,
  },
  anchorTrack: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 18,
    height: 16,
    zIndex: 4,
  },
  anchorMarker: {
    position: 'absolute',
    top: 2,
  },
  anchorDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 1,
  },
  peakPulse: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: `${Colors.AccentPrimary}44`,
    borderWidth: 1,
    borderColor: `${Colors.AccentPrimary}88`,
    zIndex: 5,
  },
  labelsRow: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  peakLabel: {
    fontSize: Typography.Micro,
    color: Colors.AccentPrimary,
  },
  dipLabel: {
    fontSize: Typography.Micro,
    color: Colors.TextMuted,
  },
  insights: {
    gap: Spacing.sm,
  },
  insight: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.xs,
  },
  insightContent: {
    flex: 1,
  },
  insightText: {
    fontSize: Typography.Caption,
    color: Colors.TextSecondary,
    lineHeight: 16,
  },
  insightActionText: {
    fontSize: Typography.Micro,
    color: Colors.AccentPrimary,
    marginTop: 2,
  },
});
