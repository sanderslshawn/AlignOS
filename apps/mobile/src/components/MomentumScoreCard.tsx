import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AppIcon, Card, SectionTitle, useTheme } from '@physiology-engine/ui';
import TooltipModal from './help/TooltipModal';

interface MomentumScoreCardProps {
  score: number;
  trend: 'rising' | 'falling' | 'stable';
  insights: string[];
}

export default function MomentumScoreCard({ score, trend, insights }: MomentumScoreCardProps) {
  const { colors, typography, spacing } = useTheme();
  const [showTooltip, setShowTooltip] = React.useState(false);

  const trendColor = trend === 'rising' ? colors.success : trend === 'falling' ? colors.accentPrimary : colors.textSecondary;
  const trendLabel = trend === 'rising' ? 'Momentum rising' : trend === 'falling' ? 'Momentum falling' : 'Momentum stable';

  return (
    <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
      <Card>
        <View style={styles.headerRow}>
          <AppIcon name="trending" size={16} color={colors.textPrimary} />
          <SectionTitle title="Momentum Score" />
          <TouchableOpacity onPress={() => setShowTooltip(true)} style={{ marginLeft: 6 }}>
            <Text style={[typography.caption, { color: colors.accentPrimary, fontWeight: '700' }]}>?</Text>
          </TouchableOpacity>
        </View>

        <Text style={[typography.titleL, { color: colors.textPrimary, fontWeight: '700' }]}>{score}</Text>
        <Text style={[typography.caption, { color: trendColor, marginTop: 2 }]}>{trendLabel}</Text>

        <View style={{ marginTop: spacing.sm }}>
          {insights.slice(0, 2).map((insight) => (
            <Text key={insight} style={[typography.caption, { color: colors.textMuted, marginBottom: 4 }]} numberOfLines={1}>
              • {insight}
            </Text>
          ))}
        </View>
      </Card>

      <TooltipModal
        visible={showTooltip}
        onClose={() => setShowTooltip(false)}
        title="Momentum Score"
        description="Momentum reflects how well your day is staying aligned to energy rhythm, stress load, and completed anchors."
        example="Higher momentum usually means more stable energy and fewer reactive schedule changes."
      />
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
});
