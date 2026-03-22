/**
 * AlignOS StatRow Component
 * Label/value row for displaying statistics
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme';

interface StatRowProps {
  label: string;
  value: string;
  subtitle?: string;
}

export function StatRow({ label, value, subtitle }: StatRowProps) {
  const { colors, typography, spacing } = useTheme();
  
  return (
    <View style={[styles.container, { paddingVertical: spacing.md }]}>
      <View style={styles.labelContainer}>
        <Text style={[typography.bodyM, { color: colors.textSecondary }]}>
          {label}
        </Text>
        {subtitle && (
          <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
            {subtitle}
          </Text>
        )}
      </View>
      <Text style={[typography.bodyL, { color: colors.textPrimary, fontWeight: '600' }]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  labelContainer: {
    flex: 1,
  },
});
