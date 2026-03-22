/**
 * AlignOS TimeDisplay Component
 * Monospace time display (HH:MM format)
 */

import React from 'react';
import { Text, StyleSheet, TextStyle, Platform } from 'react-native';
import { useTheme } from '../theme';

interface TimeDisplayProps {
  time: string; // Format: "HH:MM" or ISO string
  variant?: 'primary' | 'secondary' | 'muted';
  size?: 'sm' | 'md' | 'lg';
  style?: TextStyle;
}

export function TimeDisplay({ time, variant = 'primary', size = 'md', style }: TimeDisplayProps) {
  const { colors } = useTheme();

  const to12Hour = (hours24: number, minutes: number) => {
    const suffix = hours24 >= 12 ? 'PM' : 'AM';
    const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
    return `${hours12}:${String(minutes).padStart(2, '0')} ${suffix}`;
  };
  
  // Parse time if ISO string
  let displayTime = time;
  const isoMatch = time.match(/T(\d{2}):(\d{2})/);
  const hhmmMatch = time.match(/^(\d{1,2}):(\d{2})$/);

  if (isoMatch) {
    const hours = Number.parseInt(isoMatch[1], 10);
    const minutes = Number.parseInt(isoMatch[2], 10);
    displayTime = to12Hour(hours, minutes);
  } else if (hhmmMatch) {
    const hours = Number.parseInt(hhmmMatch[1], 10);
    const minutes = Number.parseInt(hhmmMatch[2], 10);
    displayTime = to12Hour(hours, minutes);
  }
  
  const variantColors = {
    primary: colors.textPrimary,
    secondary: colors.textSecondary,
    muted: colors.textMuted,
  };
  
  const sizeMap = {
    sm: 12,
    md: 14,
    lg: 16,
  };
  
  return (
    <Text
      style={[
        styles.time,
        {
          color: variantColors[variant],
          fontSize: sizeMap[size],
          fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        },
        style,
      ]}
    >
      {displayTime}
    </Text>
  );
}

const styles = StyleSheet.create({
  time: {
    fontWeight: '500',
    letterSpacing: 0.5,
  },
});
