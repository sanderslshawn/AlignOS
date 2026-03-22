// AlignOS Chip Component
// Small pills for modes, statuses, tags

import React from 'react';
import { Text, StyleSheet, Pressable } from 'react-native';
import { Colors } from '../theme/colors';
import { Radius } from '../theme/radius';
import { Spacing } from '../theme/spacing';
import { Typography, FontWeight } from '../theme/typography';
import { hapticSelection } from '../utils/haptics';

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  disabled?: boolean;
}

export function Chip({ label, selected = false, onPress, disabled = false }: ChipProps) {
  const handlePress = () => {
    if (onPress && !disabled) {
      hapticSelection();
      onPress();
    }
  };

  const Component = onPress ? Pressable : React.Fragment;
  const wrapperProps = onPress ? {
    onPress: handlePress,
    disabled,
    style: ({ pressed }: { pressed: boolean }) => [
      styles.chip,
      selected && styles.selected,
      disabled && styles.disabled,
      pressed && styles.pressed,
    ],
  } : {};

  return (
    <Component {...wrapperProps}>
      <Text style={[
        styles.label,
        selected && styles.labelSelected,
        disabled && styles.labelDisabled,
      ]}>
        {label}
      </Text>
    </Component>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.Border,
    backgroundColor: Colors.Surface,
  },
  selected: {
    borderColor: Colors.AccentPrimary,
    backgroundColor: `${Colors.AccentPrimary}1A`, // 10% opacity
  },
  label: {
    fontSize: Typography.Caption,
    fontWeight: FontWeight.Medium,
    color: Colors.TextSecondary,
  },
  labelSelected: {
    color: Colors.AccentPrimary,
  },
  disabled: {
    opacity: 0.4,
  },
  labelDisabled: {
    color: Colors.TextMuted,
  },
  pressed: {
    opacity: 0.75,
  },
});
