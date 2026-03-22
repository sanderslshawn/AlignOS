/**
 * AlignOS HeaderBar Component
 * Consistent header with back button and title
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../theme';
import { AppIcon } from '../icons';

interface HeaderBarProps {
  title: string;
  onBack?: () => void;
  rightAction?: React.ReactNode;
}

export function HeaderBar({ title, onBack, rightAction }: HeaderBarProps) {
  const { colors, typography, spacing } = useTheme();
  
  return (
    <View style={[styles.container, { paddingHorizontal: spacing.lg, paddingVertical: spacing.md }]}>
      <View style={styles.left}>
        {onBack && (
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <AppIcon name="chevronLeft" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
        )}
      </View>
      
      <Text style={[styles.title, typography.titleM, { color: colors.textPrimary }]}>
        {title}
      </Text>
      
      <View style={styles.right}>
        {rightAction}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 56,
  },
  left: {
    width: 40,
    alignItems: 'flex-start',
  },
  right: {
    width: 40,
    alignItems: 'flex-end',
  },
  title: {
    flex: 1,
    textAlign: 'center',
  },
  backButton: {
    padding: 4,
  },
});
