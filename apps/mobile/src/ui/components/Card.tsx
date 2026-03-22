// AlignOS Card Component
// Consistent card styling across the app

import React, { ReactNode } from 'react';
import { View, StyleSheet, ViewStyle, Pressable } from 'react-native';
import { Colors } from '../theme/colors';
import { Radius } from '../theme/radius';
import { Spacing } from '../theme/spacing';
import { Shadows } from '../theme/shadows';

interface CardProps {
  children: ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
  size?: 'sm' | 'md' | 'lg';
}

export function Card({ children, style, onPress, size = 'md' }: CardProps) {
  const sizeStyles = {
    sm: styles.sizeSm,
    md: styles.sizeMd,
    lg: styles.sizeLg,
  };

  const content = (
    <View style={[styles.card, sizeStyles[size], style]}>
      {children}
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
        {content}
      </Pressable>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.SurfaceElevated,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.Border,
    ...Shadows.sm,
  },
  sizeSm: {
    padding: Spacing.md,
  },
  sizeMd: {
    padding: Spacing.lg,
  },
  sizeLg: {
    padding: Spacing.xl,
  },
  pressed: {
    opacity: 0.85,
  },
});
