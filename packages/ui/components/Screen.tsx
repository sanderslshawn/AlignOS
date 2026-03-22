/**
 * AlignOS Screen Component
 * Consistent screen wrapper with background, padding, and safe area
 */

import React from 'react';
import { View, ScrollView, StyleSheet, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme';

interface ScreenProps {
  children: React.ReactNode;
  scrollable?: boolean;
  padding?: boolean;
  style?: ViewStyle;
}

export function Screen({ children, scrollable = true, padding = true, style }: ScreenProps) {
  const { colors, spacing } = useTheme();
  
  const containerStyle = [
    styles.container,
    { backgroundColor: colors.background },
    style,
  ];
  
  const contentStyle = padding ? { padding: spacing.lg } : undefined;
  
  if (scrollable) {
    return (
      <SafeAreaView style={containerStyle} edges={['top', 'left', 'right']}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={contentStyle}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </SafeAreaView>
    );
  }
  
  return (
    <SafeAreaView style={containerStyle} edges={['top', 'left', 'right']}>
      <View style={[styles.content, contentStyle]}>
        {children}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
});
