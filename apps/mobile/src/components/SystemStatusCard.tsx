import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { AppIcon, Card, SectionTitle, useTheme } from '@physiology-engine/ui';

interface SystemStatusCardProps {
  lines: string[];
}

const ROW_ICONS: Array<'pulse' | 'flash' | 'checkCircle'> = ['pulse', 'flash', 'checkCircle'];

export default function SystemStatusCard({ lines }: SystemStatusCardProps) {
  const { colors, typography, spacing, radius } = useTheme();
  const dotAnim = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(dotAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(dotAnim, {
          toValue: 0.45,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.delay(1200),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [dotAnim]);

  return (
    <View style={{ marginTop: spacing.md }}>
      <Text style={[typography.caption, { color: colors.textMuted, letterSpacing: 1.2, marginBottom: spacing.xs }]}>SYSTEM STATUS</Text>
      <Card style={styles.card}>
        <View style={styles.headerRow}>
          <SectionTitle title="System Status" />
          <Animated.View
            style={[
              styles.statusDot,
              {
                backgroundColor: colors.success,
                borderRadius: radius.pill,
                opacity: dotAnim,
                transform: [
                  {
                    scale: dotAnim.interpolate({
                      inputRange: [0.45, 1],
                      outputRange: [0.94, 1.04],
                    }),
                  },
                ],
              },
            ]}
          />
        </View>

        <View style={{ marginTop: spacing.xs }}>
          {lines.map((line, index) => (
            <View key={`${line}-${index}`} style={[styles.lineRow, { marginTop: index === 0 ? spacing.xs : spacing.sm }]}> 
              <AppIcon name={ROW_ICONS[index % ROW_ICONS.length]} size={13} color={colors.textMuted} />
              <Text style={[typography.caption, { color: colors.textSecondary, marginLeft: spacing.sm, flex: 1 }]}>
                {line}
              </Text>
            </View>
          ))}
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    marginLeft: 6,
  },
  lineRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
