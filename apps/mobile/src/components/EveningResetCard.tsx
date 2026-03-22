import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AppIcon, Card, SectionTitle, useTheme } from '@physiology-engine/ui';

interface EveningResetCardProps {
  momentumScore: number;
  wins: string[];
  adjustments: string[];
  tomorrowFocusWindow: string;
  tomorrowDipWindow: string;
  tomorrowWorkoutWindow: string;
  onPrepareTomorrow: () => void;
}

export default function EveningResetCard({
  momentumScore,
  wins,
  adjustments,
  tomorrowFocusWindow,
  tomorrowDipWindow,
  tomorrowWorkoutWindow,
  onPrepareTomorrow,
}: EveningResetCardProps) {
  const { colors, typography, spacing } = useTheme();

  return (
    <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
      <Card>
        <View style={styles.headerRow}>
          <AppIcon name="moon" size={16} color={colors.textPrimary} />
          <SectionTitle title="Evening Reset" />
        </View>

        <Text style={[typography.caption, { color: colors.textMuted }]}>Review today</Text>
        <Text style={[typography.bodyM, { color: colors.textPrimary, marginTop: 2 }]}>Momentum {momentumScore}</Text>
        {wins.slice(0, 1).map((item) => (
          <Text key={item} style={[typography.caption, { color: colors.textSecondary, marginTop: 4 }]} numberOfLines={1}>• {item}</Text>
        ))}
        {adjustments.slice(0, 1).map((item) => (
          <Text key={item} style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]} numberOfLines={1}>• {item}</Text>
        ))}

        <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.md }]}>Preview tomorrow</Text>
        <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]} numberOfLines={1}>Focus {tomorrowFocusWindow}</Text>
        <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]} numberOfLines={1}>Dip {tomorrowDipWindow}</Text>
        <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]} numberOfLines={1}>Workout {tomorrowWorkoutWindow}</Text>

        <TouchableOpacity
          onPress={onPrepareTomorrow}
          style={[styles.prepareButton, { backgroundColor: colors.accentPrimary, marginTop: spacing.md }]}
          accessibilityRole="button"
        >
          <Text style={[typography.bodyM, { color: colors.background, fontWeight: '700' }]}>Prepare Tomorrow</Text>
        </TouchableOpacity>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  prepareButton: {
    minHeight: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
});
