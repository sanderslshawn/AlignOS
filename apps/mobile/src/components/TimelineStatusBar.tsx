/**
 * Timeline Status Bar
 * Shows real-time progress and adaptive adjustments
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useAdaptivePlanStore } from '../store/adaptivePlanStore';
import { hapticLight } from '../ui/utils/haptics';
import { AppIcon } from '../ui/components/AppIcon';
import { Colors } from '../ui/theme/colors';
import { Spacing } from '../ui/theme/spacing';
import { Radius } from '../ui/theme/radius';
import { Typography, FontWeight } from '../ui/theme/typography';
import { Shadows } from '../ui/theme/shadows';
import { formatNumber } from '../ui/utils/format';

export default function TimelineStatusBar() {
  const { 
    isRunningBehind, 
    minutesBehind, 
    adaptiveMode, 
    toggleAdaptiveMode,
    completedToday 
  } = useAdaptivePlanStore();

  if (completedToday.length === 0) {
    return null; // Don't show until user starts completing items
  }

  const statusText = isRunningBehind 
    ? `${formatNumber(minutesBehind, 0)}min behind` 
    : 'On schedule';

  return (
    <View style={[
      styles.container,
      isRunningBehind && styles.containerBehind
    ]}>
      <View style={styles.content}>
        <View style={styles.statusSection}>
          <AppIcon 
            name={isRunningBehind ? 'clock' : 'check'} 
            size={18} 
            color={isRunningBehind ? Colors.Warning : Colors.Success} 
          />
          <View style={styles.statusTexts}>
            <Text style={styles.statusText}>{statusText}</Text>
            <Text style={styles.completedCount}>
              {completedToday.length} completed today
            </Text>
          </View>
        </View>

        {isRunningBehind && adaptiveMode && (
          <View style={styles.adaptiveIndicator}>
            <AppIcon name="refresh" size={12} color={Colors.AccentPrimary} />
            <Text style={styles.adaptiveText}>Auto-adjust</Text>
          </View>
        )}

        <TouchableOpacity
          style={[
            styles.toggleButton,
            adaptiveMode && styles.toggleButtonActive
          ]}
          onPress={() => {
            hapticLight();
            toggleAdaptiveMode();
          }}
        >
          <Text style={[
            styles.toggleText,
            adaptiveMode && styles.toggleTextActive
          ]}>
            {adaptiveMode ? 'ON' : 'OFF'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: Spacing.sm,
    marginHorizontal: Spacing.lg,
    borderRadius: Radius.lg,
    backgroundColor: Colors.SurfaceElevated,
    borderWidth: 1,
    borderColor: Colors.Border,
    ...Shadows.sm,
  },
  containerBehind: {
    borderColor: Colors.Warning,
    backgroundColor: `${Colors.Warning}0F`, // 6% opacity
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
  },
  statusSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: Spacing.sm,
  },
  statusTexts: {
    flex: 1,
  },
  statusText: {
    fontSize: Typography.BodySmall,
    fontWeight: FontWeight.Semi,
    color: Colors.TextPrimary,
  },
  completedCount: {
    fontSize: Typography.Micro,
    color: Colors.TextMuted,
    marginTop: 2,
    letterSpacing: 0.3,
  },
  adaptiveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginRight: Spacing.sm,
  },
  adaptiveText: {
    fontSize: Typography.Micro,
    color: Colors.AccentPrimary,
    fontWeight: FontWeight.Medium,
    letterSpacing: 0.3,
  },
  toggleButton: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    backgroundColor: Colors.Surface,
    borderWidth: 1,
    borderColor: Colors.Border,
  },
  toggleButtonActive: {
    backgroundColor: `${Colors.AccentPrimary}1A`, // 10% opacity
    borderColor: Colors.AccentPrimary,
  },
  toggleText: {
    fontSize: Typography.Micro,
    fontWeight: FontWeight.Semi,
    color: Colors.TextSecondary,
    letterSpacing: 0.5,
  },
  toggleTextActive: {
    color: Colors.AccentPrimary,
  },
});
