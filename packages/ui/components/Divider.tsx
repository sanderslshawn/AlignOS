/**
 * AlignOS Divider Component
 * Subtle separator line
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../theme';

interface DividerProps {
  spacing?: 'sm' | 'md' | 'lg';
}

export function Divider({ spacing = 'md' }: DividerProps) {
  const { colors, spacing: spacingTokens } = useTheme();
  
  const marginMap = {
    sm: spacingTokens.sm,
    md: spacingTokens.md,
    lg: spacingTokens.lg,
  };
  
  return (
    <View
      style={[
        styles.divider,
        {
          backgroundColor: colors.borderSubtle,
          marginVertical: marginMap[spacing],
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  divider: {
    height: 1,
  },
});
