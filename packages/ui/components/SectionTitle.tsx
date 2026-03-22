/**
 * AlignOS SectionTitle Component
 * Section title with optional subtitle
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme';

interface SectionTitleProps {
  title: string;
  subtitle?: string;
}

export function SectionTitle({ title, subtitle }: SectionTitleProps) {
  const { colors, typography, spacing } = useTheme();
  
  return (
    <View style={[styles.container, { marginBottom: spacing.md }]}>
      <Text style={[typography.titleM, { color: colors.textPrimary }]}>
        {title}
      </Text>
      {subtitle && (
        <Text style={[typography.bodyS, { color: colors.textMuted, marginTop: spacing.xs }]}>
          {subtitle}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    // Space is applied via marginBottom in the component
  },
});
