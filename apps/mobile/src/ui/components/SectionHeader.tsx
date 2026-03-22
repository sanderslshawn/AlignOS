// AlignOS Section Header Component

import React, { ReactNode } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Colors } from '../theme/colors';
import { Typography, FontWeight } from '../theme/typography';
import { Spacing } from '../theme/spacing';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  rightAction?: {
    label: string;
    onPress: () => void;
  };
  rightElement?: ReactNode;
}

export function SectionHeader({ title, subtitle, rightAction, rightElement }: SectionHeaderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.left}>
        <Text style={styles.title}>{title}</Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>
      {rightAction && (
        <Pressable onPress={rightAction.onPress} style={styles.action}>
          <Text style={styles.actionText}>{rightAction.label}</Text>
        </Pressable>
      )}
      {rightElement && <View style={styles.right}>{rightElement}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  left: {
    flex: 1,
  },
  title: {
    fontSize: Typography.TitleM,
    fontWeight: FontWeight.Semi,
    color: Colors.TextPrimary,
  },
  subtitle: {
    fontSize: Typography.Caption,
    color: Colors.TextMuted,
    marginTop: 2,
  },
  action: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  actionText: {
    fontSize: Typography.BodySmall,
    fontWeight: FontWeight.Medium,
    color: Colors.AccentPrimary,
  },
  right: {
    marginLeft: Spacing.sm,
  },
});
