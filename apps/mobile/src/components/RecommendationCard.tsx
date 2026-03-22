/**
 * AlignOS Recommendation Card
 * Clean, minimal suggestions with add-to-schedule functionality
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import type { ScheduleItem } from '@physiology-engine/shared';
import { useTheme, Card, AppIcon } from '@physiology-engine/ui';
import { haptics } from '../utils/haptics';
import WhyThisModal from './help/WhyThisModal';

interface RecommendationCardProps {
  text: string;
  onAdd: (suggestedActivity: Omit<ScheduleItem, 'id'>) => void;
  index: number;
}

export default function RecommendationCard({ text, onAdd, index }: RecommendationCardProps) {
  const { colors, typography, spacing, radius } = useTheme();
  const [showWhyThis, setShowWhyThis] = React.useState(false);

  const getIconName = (): 'meal' | 'coffee' | 'walk' | 'workout' | 'work' | 'meeting' | 'sleep' | 'focus' | 'break' | 'stretch' | 'winddown' | 'water' | 'plus' => {
    const lowerText = text.toLowerCase();
    if (lowerText.includes('walk') || lowerText.includes('movement')) return 'walk';
    if (lowerText.includes('stretch') || lowerText.includes('mobility')) return 'stretch';
    if (lowerText.includes('train') || lowerText.includes('workout')) return 'workout';
    if (lowerText.includes('hydrat') || lowerText.includes('water')) return 'water';
    if (lowerText.includes('focus') || lowerText.includes('deep work')) return 'focus';
    if (lowerText.includes('break') || lowerText.includes('rest')) return 'break';
    if (lowerText.includes('meal') || lowerText.includes('eat')) return 'meal';
    if (lowerText.includes('sleep')) return 'sleep';
    return 'plus';
  };

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
        isSystemAnchor: false,
        isFixedAnchor: false,
        fixed: false,
        source: 'user',
        status: 'planned',
        notes: 'Added from recommendation',
      };
    }

    if (lowerText.includes('stretch') || lowerText.includes('mobility')) {
      return {
        type: 'stretch',
        title: 'Stretching & Mobility',
        startISO: now.toISOString(),
        endISO: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
        isSystemAnchor: false,
        isFixedAnchor: false,
        fixed: false,
        source: 'user',
        status: 'planned',
        notes: 'Added from recommendation',
      };
    }

    if (lowerText.includes('train') || lowerText.includes('workout') || lowerText.includes('resistance')) {
      return {
        type: 'workout',
        title: 'Training Session',
        startISO: now.toISOString(),
        endISO: new Date(now.getTime() + 45 * 60 * 1000).toISOString(),
        isSystemAnchor: false,
        isFixedAnchor: false,
        fixed: false,
        source: 'user',
        status: 'planned',
        notes: 'Added from recommendation',
      };
    }

    if (lowerText.includes('hydrat')) {
      return {
        type: 'hydration',
        title: 'Water Break',
        startISO: now.toISOString(),
        endISO: new Date(now.getTime() + 5 * 60 * 1000).toISOString(),
        isSystemAnchor: false,
        isFixedAnchor: false,
        fixed: false,
        source: 'user',
        status: 'planned',
        notes: 'Added from recommendation',
      };
    }

    if (lowerText.includes('focus') || lowerText.includes('deep work')) {
      return {
        type: 'focus',
        title: 'Deep Work Session',
        startISO: now.toISOString(),
        endISO: new Date(now.getTime() + 90 * 60 * 1000).toISOString(),
        isSystemAnchor: false,
        isFixedAnchor: false,
        fixed: false,
        source: 'user',
        status: 'planned',
        notes: 'Added from recommendation',
      };
    }

    if (lowerText.includes('break') || lowerText.includes('rest') || lowerText.includes('recover')) {
      return {
        type: 'break',
        title: 'Rest & Recovery',
        startISO: now.toISOString(),
        endISO: new Date(now.getTime() + 30 * 60 * 1000).toISOString(),
        isSystemAnchor: false,
        isFixedAnchor: false,
        fixed: false,
        source: 'user',
        status: 'planned',
        notes: 'Added from recommendation',
      };
    }

    // Default: flexible time
    return {
      type: 'break',
      title: 'Flexible Time',
      startISO: now.toISOString(),
      endISO: new Date(now.getTime() + 30 * 60 * 1000).toISOString(),
      isSystemAnchor: false,
      isFixedAnchor: false,
      fixed: false,
      source: 'user',
      status: 'planned',
      notes: text,
    };
  };

  const handlePress = () => {
    const suggestedActivity = getSuggestedActivity();
    if (suggestedActivity) {
      haptics.light();
      onAdd(suggestedActivity);
      haptics.success();
    }
  };

  return (
    <>
      <TouchableOpacity onPress={handlePress} activeOpacity={0.7}>
        <Card>
          <View style={styles.content}>
            <View style={[styles.iconContainer, { backgroundColor: colors.accentSoft }]}>
              <AppIcon name={getIconName()} size={18} color={colors.accentPrimary} />
            </View>
            <View style={styles.textContainer}>
              <Text style={[typography.bodyM, { color: colors.textPrimary, fontWeight: '500' }]}>
                {text.split('.')[0]}
              </Text>
              {text.includes('.') && (
                <TouchableOpacity onPress={() => setShowWhyThis(true)}>
                  <Text style={[typography.bodyM, { color: colors.accentPrimary, fontSize: 12, marginTop: 2 }]}>
                    Why this?
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={[styles.addButton, { borderColor: colors.accentPrimary }]}>
              <AppIcon name="plusCircle" size={20} color={colors.accentPrimary} />
            </View>
          </View>
        </Card>
      </TouchableOpacity>

      <WhyThisModal
        visible={showWhyThis}
        onClose={() => setShowWhyThis(false)}
        title="Suggested insertion"
        explanation="This insertion is generated from current timeline context, likely energy transitions, and your active planning constraints."
      />
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  addButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
    borderWidth: 1,
  },
});
