import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { AppIcon, Card, SectionTitle, useTheme } from '@physiology-engine/ui';

interface TodayInsightCardProps {
  title: string;
  subtitle: string;
}

export default function TodayInsightCard({ title, subtitle }: TodayInsightCardProps) {
  const { colors, typography, spacing } = useTheme();
  const appearAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(appearAnim, {
      toValue: 1,
      tension: 70,
      friction: 10,
      useNativeDriver: true,
    }).start();
  }, [appearAnim, title, subtitle]);

  return (
    <Animated.View
      style={{
        marginTop: spacing.md,
        opacity: appearAnim,
        transform: [
          {
            translateY: appearAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [10, 0],
            }),
          },
          {
            scale: appearAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0.985, 1],
            }),
          },
        ],
      }}
    >
      <Text style={[typography.caption, { color: colors.textMuted, letterSpacing: 1.2, marginBottom: spacing.xs }]}>TODAY INSIGHT</Text>
      <Card style={styles.card}>
        <View style={styles.titleRow}>
          <AppIcon name="sparkles" size={14} color={colors.textSecondary} />
          <View style={{ marginLeft: spacing.sm }}>
            <SectionTitle title="Today Insight" />
          </View>
        </View>

        <Text style={[typography.bodyM, { color: colors.textPrimary, marginTop: spacing.xs, fontWeight: '500' }]}>
          {title}
        </Text>
        <Text style={[typography.bodyM, { color: colors.accentPrimary, marginTop: 4, fontWeight: '600' }]}>
          {subtitle}
        </Text>
      </Card>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
