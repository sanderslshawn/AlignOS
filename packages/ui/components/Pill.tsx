/**
 * AlignOS Pill Component
 * Small, rounded badge for status indicators
 */

import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../theme';

interface PillProps {
  label: string;
  variant?: 'default' | 'accent' | 'success' | 'warning' | 'muted';
  style?: ViewStyle;
}

export function Pill({ label, variant = 'default', style }: PillProps) {
  const { colors, typography, spacing, radius } = useTheme();
  
  const variantStyles = {
    default: {
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.border,
      textColor: colors.textSecondary,
    },
    accent: {
      backgroundColor: colors.accentSoft,
      borderColor: colors.accentPrimary,
      textColor: colors.accentPrimary,
    },
    success: {
      backgroundColor: colors.successSoft,
      borderColor: colors.success,
      textColor: colors.success,
    },
    warning: {
      backgroundColor: colors.warningSoft,
      borderColor: colors.warning,
      textColor: colors.warning,
    },
    muted: {
      backgroundColor: colors.surface,
      borderColor: colors.borderSubtle,
      textColor: colors.textMuted,
    },
  };
  
  const variantStyle = variantStyles[variant];
  
  return (
    <View
      style={[
        styles.pill,
        {
          backgroundColor: variantStyle.backgroundColor,
          borderColor: variantStyle.borderColor,
          borderRadius: radius.pill,
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.xs,
        },
        style,
      ]}
    >
      <Text
        style={[
          typography.caption,
          {
            color: variantStyle.textColor,
            fontSize: 11,
            fontWeight: '600',
          },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
});
