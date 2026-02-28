/**
 * Timeline Status Bar
 * Shows real-time progress and adaptive adjustments
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAdaptivePlanStore } from '../store/adaptivePlanStore';
import { haptics } from '../utils/haptics';

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

  const status = isRunningBehind ? 'behind' : 'on-track';
  const statusEmoji = isRunningBehind ? '⚠️' : '✓';
  const statusText = isRunningBehind 
    ? `${Math.round(minutesBehind)}min behind` 
    : 'On schedule';
  const statusColor = (isRunningBehind ? ['#ff6b6b', '#c92a2a'] : ['#00ff88', '#14967F']) as [string, string];

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={statusColor}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.gradient}
      >
        <View style={styles.content}>
          <View style={styles.statusSection}>
            <Text style={styles.statusEmoji}>{statusEmoji}</Text>
            <View>
              <Text style={styles.statusText}>{statusText}</Text>
              <Text style={styles.completedCount}>
                {completedToday.length} completed today
              </Text>
            </View>
          </View>

          {isRunningBehind && adaptiveMode && (
            <View style={styles.adaptiveIndicator}>
              <Text style={styles.adaptiveText}>🔄 Auto-adjusting</Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.toggleButton}
            onPress={() => {
              haptics.light();
              toggleAdaptiveMode();
            }}
          >
            <Text style={styles.toggleText}>
              {adaptiveMode ? '🤖 ON' : 'OFF'}
            </Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  gradient: {
    padding: 14,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  statusEmoji: {
    fontSize: 24,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#000',
    letterSpacing: 0.3,
  },
  completedCount: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(0, 0, 0, 0.7)',
    marginTop: 2,
  },
  adaptiveIndicator: {
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 8,
  },
  adaptiveText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#000',
  },
  toggleButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    minWidth: 50,
    alignItems: 'center',
  },
  toggleText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#000',
  },
});
