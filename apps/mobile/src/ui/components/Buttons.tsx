// AlignOS Button Components

import React, { ReactNode } from 'react';
import { Text, StyleSheet, Pressable, ViewStyle, ActivityIndicator } from 'react-native';
import { Colors } from '../theme/colors';
import { Radius } from '../theme/radius';
import { Spacing } from '../theme/spacing';
import { Typography, FontWeight } from '../theme/typography';
import { hapticMedium } from '../utils/haptics';

interface ButtonBaseProps {
  onPress: () => void;
  children: ReactNode;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  fullWidth?: boolean;
}

export function PrimaryButton({ 
  onPress, 
  children, 
  disabled = false, 
  loading = false,
  style,
  fullWidth = false,
}: ButtonBaseProps) {
  const handlePress = () => {
    hapticMedium();
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.buttonBase,
        styles.primaryButton,
        fullWidth && styles.fullWidth,
        (disabled || loading) && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={Colors.Background} size="small" />
      ) : (
        <Text style={styles.primaryText}>{children}</Text>
      )}
    </Pressable>
  );
}

export function SecondaryButton({ 
  onPress, 
  children, 
  disabled = false, 
  loading = false,
  style,
  fullWidth = false,
}: ButtonBaseProps) {
  const handlePress = () => {
    hapticMedium();
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.buttonBase,
        styles.secondaryButton,
        fullWidth && styles.fullWidth,
        (disabled || loading) && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={Colors.AccentPrimary} size="small" />
      ) : (
        <Text style={styles.secondaryText}>{children}</Text>
      )}
    </Pressable>
  );
}

export function TertiaryButton({ 
  onPress, 
  children, 
  disabled = false, 
  style,
}: Omit<ButtonBaseProps, 'loading' | 'fullWidth'>) {
  const handlePress = () => {
    hapticMedium();
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.tertiaryButton,
        disabled && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}
    >
      <Text style={styles.tertiaryText}>{children}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  buttonBase: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  fullWidth: {
    width: '100%',
  },
  primaryButton: {
    backgroundColor: Colors.AccentPrimary,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.Border,
  },
  tertiaryButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  primaryText: {
    fontSize: Typography.Body,
    fontWeight: FontWeight.Semi,
    color: Colors.Background,
  },
  secondaryText: {
    fontSize: Typography.Body,
    fontWeight: FontWeight.Semi,
    color: Colors.TextPrimary,
  },
  tertiaryText: {
    fontSize: Typography.BodySmall,
    fontWeight: FontWeight.Medium,
    color: Colors.TextSecondary,
  },
  disabled: {
    opacity: 0.4,
  },
  pressed: {
    opacity: 0.75,
  },
});
