// AlignOS Divider Component

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Colors } from '../theme/colors';

interface DividerProps {
  spacing?: number;
}

export function Divider({ spacing = 0 }: DividerProps) {
  return (
    <View style={[styles.divider, spacing > 0 && { marginVertical: spacing }]} />
  );
}

const styles = StyleSheet.create({
  divider: {
    height: 1,
    backgroundColor: Colors.Border,
    opacity: 0.8,
  },
});
