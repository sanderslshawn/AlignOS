/**
 * Enhanced Recommendation Card
 * Premium, interactive recommendations with add-to-schedule functionality
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { ScheduleItem } from '@physiology-engine/shared';
import { haptics } from '../utils/haptics';

interface RecommendationCardProps {
  text: string;
  onAdd: (suggestedActivity: Omit<ScheduleItem, 'id'>) => void;
  index: number;
}

export default function RecommendationCard({ text, onAdd, index }: RecommendationCardProps) {
  const [scaleAnim] = React.useState(new Animated.Value(1));

  const getSuggestedActivity = (): Omit<ScheduleItem, 'id'> | null => {
    const lowerText = text.toLowerCase();
    const now = new Date();
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);

    // Parse recommendation and suggest appropriate activity
    if (lowerText.includes('walk') || lowerText.includes('movement')) {
      return {
        type: 'walk',
        title: '20min Walk',
        startISO: now.toISOString(),
        endISO: oneHourLater.toISOString(),
        fixed: false,
        source: 'user',
        notes: 'Added from recommendation',
      };
    }

    if (lowerText.includes('stretch') || lowerText.includes('mobility')) {
      return {
        type: 'stretch',
        title: 'Stretching & Mobility',
        startISO: now.toISOString(),
        endISO: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
        fixed: false,
        source: 'user',
        notes: 'Added from recommendation',
      };
    }

    if (lowerText.includes('train') || lowerText.includes('workout') || lowerText.includes('resistance')) {
      return {
        type: 'workout',
        title: 'Training Session',
        startISO: now.toISOString(),
        endISO: new Date(now.getTime() + 45 * 60 * 1000).toISOString(),
        fixed: false,
        source: 'user',
        notes: 'Added from recommendation',
      };
    }

    if (lowerText.includes('hydrat')) {
      return {
        type: 'hydration',
        title: 'Water Break',
        startISO: now.toISOString(),
        endISO: new Date(now.getTime() + 5 * 60 * 1000).toISOString(),
        fixed: false,
        source: 'user',
        notes: 'Added from recommendation',
      };
    }

    if (lowerText.includes('focus') || lowerText.includes('deep work')) {
      return {
        type: 'focus',
        title: 'Deep Work Session',
        startISO: now.toISOString(),
        endISO: new Date(now.getTime() + 90 * 60 * 1000).toISOString(),
        fixed: false,
        source: 'user',
        notes: 'Added from recommendation',
      };
    }

    if (lowerText.includes('break') || lowerText.includes('rest') || lowerText.includes('recover')) {
      return {
        type: 'break',
        title: 'Rest & Recovery',
        startISO: now.toISOString(),
        endISO: new Date(now.getTime() + 30 * 60 * 1000).toISOString(),
        fixed: false,
        source: 'user',
        notes: 'Added from recommendation',
      };
    }

    // Default: flexible time
    return {
      type: 'break',
      title: 'Flexible Time',
      startISO: now.toISOString(),
      endISO: new Date(now.getTime() + 30 * 60 * 1000).toISOString(),
      fixed: false,
      source: 'user',
      notes: text,
    };
  };

  const handlePress = () => {
    const suggestedActivity = getSuggestedActivity();
    if (suggestedActivity) {
      haptics.light();
      
      // Scale animation
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 0.95,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start();

      onAdd(suggestedActivity);
      haptics.success();
    }
  };

  const getGradientColors = (): [string, string] => {
    const gradients: [string, string][] = [
      ['#14967F', '#1CB896'],
      ['#6366F1', '#8B5CF6'],
      ['#F59E0B', '#F97316'],
      ['#10B981', '#059669'],
      ['#8B5CF6', '#EC4899'],
    ];
    return gradients[index % gradients.length];
  };

  return (
    <Animated.View style={[styles.container, { transform: [{ scale: scaleAnim }] }]}>
      <TouchableOpacity onPress={handlePress} activeOpacity={0.8}>
        <LinearGradient
          colors={[getGradientColors()[0], getGradientColors()[1], 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          <View style={styles.content}>
            <View style={styles.iconContainer}>
              <Text style={styles.icon}>💡</Text>
            </View>
            <Text style={styles.text}>{text}</Text>
            <View style={styles.addButton}>
              <Text style={styles.addButtonText}>+</Text>
            </View>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#00ff88',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  gradient: {
    padding: 2,
    borderRadius: 16,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 14,
    padding: 16,
  },
  iconContainer: {
    marginRight: 12,
  },
  icon: {
    fontSize: 24,
  },
  text: {
    flex: 1,
    fontSize: 14,
    color: '#fff',
    lineHeight: 20,
  },
  addButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#00ff88',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  addButtonText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
});
