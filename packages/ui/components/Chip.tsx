/**
 * AlignOS Chip Component
 * Small badge/chip for streaks, badges, status
 */

import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../theme';
import { AppIcon, type IconName } from '../icons';

interface ChipProps {
  children: string;
  icon?: IconName;
  variant?: 'default' | 'accent' | 'success';
  style?: ViewStyle;
}

export function Chip({ children, icon, variant = 'default', style }: ChipProps) {
  const { colors, typography, radius, spacing } = useTheme();
  
  const backgroundColor = 
    variant === 'accent' ? colors.accentSoft :
    variant === 'success' ? colors.successSoft :
    colors.surface;
  
  const textColor = 
    variant === 'accent' ? colors.accentPrimary :
    variant === 'success' ? colors.success :
    colors.textSecondary;
  
  return (
    <View
      style={[
        styles.chip,
        {
          backgroundColor,
          borderRadius: radius.pill,
          paddingVertical: spacing.xs,
          paddingHorizontal: spacing.sm,
          borderWidth: 1,
          borderColor: colors.borderSubtle,
        },
        style,
      ]}
    >
      {icon && (
        <AppIcon name={icon} size={14} color={textColor} />
      )}
      <Text
        style={[
          typography.caption,
          {
            color: textColor,
            marginLeft: icon ? 4 : 0,
          },
        ]}
      >
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
});
