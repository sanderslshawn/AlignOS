/**
 * AlignOS IconButton Component
 * Subtle icon-only touchable
 */

import React from 'react';
import { TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { AppIcon } from '../icons';
import { useTheme } from '../theme';
import type { IconName } from '../icons';

interface IconButtonProps {
  icon: IconName;
  onPress: () => void;
  size?: number;
  color?: string;
  variant?: 'default' | 'accent' | 'subtle';
  style?: ViewStyle;
}

export function IconButton({ 
  icon, 
  onPress, 
  size = 24, 
  color,
  variant = 'default',
  style 
}: IconButtonProps) {
  const { colors, spacing } = useTheme();
  
  const variantColors = {
    default: colors.textPrimary,
    accent: colors.accentPrimary,
    subtle: colors.textSecondary,
  };
  
  const iconColor = color || variantColors[variant];
  
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.button,
        {
          padding: spacing.xs,
        },
        style,
      ]}
      hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
    >
      <AppIcon name={icon} size={size} color={iconColor} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
