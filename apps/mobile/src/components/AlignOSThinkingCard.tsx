import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AppIcon, Card, SectionTitle, useTheme } from '@physiology-engine/ui';

interface AlignOSThinkingCardProps {
  insightTitle: string;
  insightDescription: string;
  recommendation: string;
  onApplyRecommendation: () => void;
}

export default function AlignOSThinkingCard({
  insightTitle,
  insightDescription,
  recommendation,
  onApplyRecommendation,
}: AlignOSThinkingCardProps) {
  const { colors, typography, spacing } = useTheme();

  return (
    <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
      <Card>
        <View style={styles.headerRow}>
          <AppIcon name="brain" size={16} color={colors.textPrimary} />
          <SectionTitle title="AlignOS Thinking" />
        </View>

        <Text
          style={[typography.bodyM, { color: colors.textPrimary, fontWeight: '600' }]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {insightTitle}
        </Text>
        <Text
          style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs }]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {insightDescription}
        </Text>

        <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.md, marginBottom: spacing.xs }]}>Recommendation</Text>
        <TouchableOpacity
          style={[styles.recommendationButton, { borderColor: colors.accentPrimary, backgroundColor: colors.accentSoft }]}
          onPress={onApplyRecommendation}
          accessibilityRole="button"
        >
          <Text style={[typography.caption, { color: colors.accentPrimary, flex: 1, fontWeight: '600' }]} numberOfLines={1}>
            {recommendation}
          </Text>
          <AppIcon name="chevronRight" size={14} color={colors.accentPrimary} />
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
  recommendationButton: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
});
