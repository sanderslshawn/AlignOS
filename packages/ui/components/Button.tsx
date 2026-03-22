/**
 * AlignOS Button Components
 * Primary and Secondary button styles
 */

import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle, ActivityIndicator } from 'react-native';
import { useTheme } from '../theme';

interface ButtonProps {
  onPress: () => void;
  children: string;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}

export function PrimaryButton({ onPress, children, disabled, loading, style }: ButtonProps) {
  const { colors, typography, radius, spacing } = useTheme();
  
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.button,
        {
          backgroundColor: disabled ? colors.borderSubtle : colors.accentPrimary,
          borderRadius: radius.md,
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.xl,
        },
        style,
      ]}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator color={colors.background} />
      ) : (
        <Text
          style={[
            typography.bodyL,
            {
              color: disabled ? colors.textMuted : colors.background,
              fontWeight: '600',
              textAlign: 'center',
            },
          ]}
        >
          {children}
        </Text>
      )}
    </TouchableOpacity>
  );
}

export function SecondaryButton({ onPress, children, disabled, loading, style }: ButtonProps) {
  const { colors, typography, radius, spacing } = useTheme();
  
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.button,
        {
          backgroundColor: 'transparent',
          borderWidth: 1,
          borderColor: disabled ? colors.borderSubtle : colors.border,
          borderRadius: radius.md,
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.xl,
        },
        style,
      ]}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator color={colors.textPrimary} />
      ) : (
        <Text
          style={[
            typography.bodyL,
            {
              color: disabled ? colors.textMuted : colors.textPrimary,
              fontWeight: '500',
              textAlign: 'center',
            },
          ]}
        >
          {children}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
});
