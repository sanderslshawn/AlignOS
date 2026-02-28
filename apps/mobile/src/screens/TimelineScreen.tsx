import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { usePlanStore } from '../store/planStore';
import { useAchievementStore } from '../store/achievementStore';
import { useAdaptivePlanStore } from '../store/adaptivePlanStore';
import { format } from 'date-fns';
import EditScheduleItemModal from '../components/EditScheduleItemModal';
import RecommendationCard from '../components/RecommendationCard';
import EnergyForecast from '../components/EnergyForecast';
import QuickActionFAB from '../components/QuickActionFAB';
import TimelineStatusBar from '../components/TimelineStatusBar';
import { haptics } from '../utils/haptics';
import type { ScheduleItem } from '@physiology-engine/shared';

export default function TimelineScreen({ navigation }: any) {
  const {
    fullDayPlan,
    profile,
    dayState,
    generateFullDayPlan,
    updateTodayEntry,
    deleteTodayEntry,
    addTodayEntry,
  } = usePlanStore();
  
  const {
    checkAndUpdateStreak,
    markActivityComplete,
    markActivityIncomplete,
    todayCompleted,
  } = useAchievementStore();
  
  const {
    initialize: initializeAdaptive,
    markItemCompleted,
    getAdjustedSchedule,
  } = useAdaptivePlanStore();
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [editingItem, setEditingItem] = useState<ScheduleItem | null>(null);

  // Auto-generate plan if dayState exists but no plan
  useEffect(() => {
    if (dayState && !fullDayPlan && !isGenerating) {
      handleGeneratePlan();
    }
    // Update streak on mount
    checkAndUpdateStreak();
    initializeAdaptive();
  }, [dayState, fullDayPlan]);

  const handleGeneratePlan = async () => {
    setIsGenerating(true);
    haptics.light();
    try {
      await generateFullDayPlan();
      haptics.success();
    } catch (err) {
      console.error('Error generating plan:', err);
      haptics.error();
    } finally {
      setIsGenerating(false);
    }
  };

  const handleItemTap = (item: ScheduleItem) => {
    haptics.light();
    setEditingItem(item);
  };

  const handleToggleComplete = (item: ScheduleItem) => {
    haptics.medium();
    if (todayCompleted[item.id]) {
      markActivityIncomplete(item.id);
    } else {
      markActivityComplete(item.id);
      // Track completion for adaptive adjustments
      markItemCompleted(item, new Date());
    }
  };

  const handleAddRecommendation = async (activity: Omit<ScheduleItem, 'id'>) => {
    haptics.success();
    await addTodayEntry(activity);
  };

  const handleSaveItem = async (item: ScheduleItem) => {
    await updateTodayEntry(item.id, item);
    setEditingItem(null);
  };

  const handleDeleteItem = async () => {
    if (editingItem) {
      await deleteTodayEntry(editingItem.id);
      setEditingItem(null);
    }
  };

  if (!profile) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>No profile found</Text>
          <TouchableOpacity 
            style={styles.button} 
            onPress={() => navigation.navigate('Onboarding')}
          >
            <Text style={styles.buttonText}>Set Up Profile</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!fullDayPlan) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>No plan generated yet</Text>
          <TouchableOpacity 
            style={styles.button} 
            onPress={handleGeneratePlan}
            disabled={isGenerating}
          >
            <Text style={styles.buttonText}>
              {isGenerating ? 'Generating...' : 'Generate Full Day Plan'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return format(date, 'HH:mm');
    } catch {
      return '';
    }
  };

  const getItemIcon = (type: string) => {
    switch (type) {
      case 'wake': return '☀️';
      case 'sleep': return '🌙';
      case 'work': return '💼';
      case 'meal': return '🍽️';
      case 'workout': return '💪';
      case 'walk': return '🚶';
      case 'focus': return '🎯';
      case 'break': return '☕';
      case 'meeting': return '👥';
      case 'hydration': return '💧';
      case 'stretch': return '🧘';
      case 'winddown': return '🌆';
      default: return '📍';
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Full Day Plan</Text>
          <Text style={styles.subtitle}>{format(new Date(), 'EEEE, MMM d')}</Text>
          {fullDayPlan.summary && (
            <Text style={styles.summary}>{fullDayPlan.summary}</Text>
          )}
        </View>

        {/* Regenerate Button */}
        <TouchableOpacity 
          style={styles.regenerateButton}
          onPress={handleGeneratePlan}
          disabled={isGenerating}
        >
          <Text style={styles.regenerateButtonText}>
            {isGenerating ? '⟳ Regenerating...' : '⟳ Regenerate Plan'}
          </Text>
        </TouchableOpacity>

        {/* Quick Action Cards */}
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.quickActionCard}
            onPress={() => {
              haptics.light();
              navigation.navigate('Social');
            }}
          >
            <Text style={styles.quickActionIcon}>👥</Text>
            <Text style={styles.quickActionText}>Social</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.quickActionCard}
            onPress={() => {
              haptics.light();
              navigation.navigate('Biometrics');
            }}
          >
            <Text style={styles.quickActionIcon}>🫀</Text>
            <Text style={styles.quickActionText}>Health</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.quickActionCard}
            onPress={() => {
              haptics.light();
              navigation.navigate('Progress');
            }}
          >
            <Text style={styles.quickActionIcon}>🏆</Text>
            <Text style={styles.quickActionText}>Progress</Text>
          </TouchableOpacity>
        </View>

        {/* Energy Forecast */}
        {profile && <EnergyForecast profile={profile} plan={fullDayPlan} />}

        {/* Adaptive Status Bar */}
        <TimelineStatusBar />

        {/* Recommendations */}
        {fullDayPlan.recommendations && fullDayPlan.recommendations.length > 0 && (
          <View style={styles.recommendationsSection}>
            <Text style={styles.sectionTitle}>💡 Smart Recommendations</Text>
            <Text style={styles.sectionSubtitle}>Tap to add to your schedule</Text>
            {fullDayPlan.recommendations.map((rec, index) => (
              <RecommendationCard
                key={index}
                text={rec}
                index={index}
                onAdd={handleAddRecommendation}
              />
            ))}
          </View>
        )}

        {/* Timeline */}
        <View style={styles.timeline}>
          <Text style={styles.sectionTitle}>Today's Schedule</Text>
          <Text style={styles.timelineHint}>Tap item to edit • Tap checkmark to complete</Text>
          {(() => {
            // Apply adaptive adjustments to uncompleted items
            const now = new Date();
            const uncompleted = fullDayPlan.items.filter(item => !todayCompleted[item.id]);
            const remaining = uncompleted.filter(item => new Date(item.startISO) > now);
            const adjustedRemaining = getAdjustedSchedule(remaining);
            
            // Merge completed and adjusted remaining items
            const displayItems = fullDayPlan.items.map(item => {
              if (todayCompleted[item.id]) return item;
              const adjusted = adjustedRemaining.find(adj => adj.id === item.id);
              return adjusted || item;
            });

            return displayItems.map((item, index) => {
              const isCompleted = todayCompleted[item.id];
              return (
                <View
                  key={item.id}
                  style={[
                    styles.timelineItem,
                    item.fixed && styles.timelineItemFixed,
                    isCompleted && styles.timelineItemCompleted,
                  ]}
              >
                {/* Completion Checkbox */}
                <TouchableOpacity
                  style={styles.checkbox}
                  onPress={() => handleToggleComplete(item)}
                >
                  {isCompleted ? (
                    <LinearGradient
                      colors={['#00ff88', '#14967F']}
                      style={styles.checkboxChecked}
                    >
                      <Text style={styles.checkmark}>✓</Text>
                    </LinearGradient>
                  ) : (
                    <View style={styles.checkboxUnchecked} />
                  )}
                </TouchableOpacity>

                {/* Item Content */}
                <TouchableOpacity
                  style={styles.timelineItemContent}
                  onPress={() => handleItemTap(item)}
                  activeOpacity={0.7}
                >
                  <View style={styles.timelineItemLeft}>
                    <Text style={styles.timelineItemTime}>
                      {formatTime(item.startISO)}
                    </Text>
                    <Text style={styles.timelineItemIcon}>{getItemIcon(item.type)}</Text>
                  </View>
                  <View style={styles.timelineItemRight}>
                    <Text style={[
                      styles.timelineItemTitle,
                      isCompleted && styles.completedText,
                    ]}>
                      {item.title}
                    </Text>
                    {item.notes && item.notes !== 'deleted-marker' && (
                      <Text style={styles.timelineItemNotes}>{item.notes}</Text>
                    )}
                    <View style={styles.timelineItemMeta}>
                      <Text style={styles.timelineItemMetaText}>
                        {item.source === 'settings' ? '⚙️ Settings' : 
                         item.source === 'user' ? '👤 You' : '🤖 Auto'}
                      </Text>
                      {item.fixed && item.type === 'wake' && (
                        <Text style={styles.timelineItemMetaText}>🔒 Fixed</Text>
                      )}
                      {item.fixed && item.type === 'sleep' && (
                        <Text style={styles.timelineItemMetaText}>🔒 Fixed</Text>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
                </View>
              );
            });
          })()}
        </View>
      </ScrollView>

      {/* Edit Modal */}
      <EditScheduleItemModal
        visible={!!editingItem}
        item={editingItem}
        onSave={handleSaveItem}
        onDelete={handleDeleteItem}
        onClose={() => setEditingItem(null)}
      />

      {/* Quick AI Chat Access */}
      <QuickActionFAB onPress={() => navigation.navigate('Chat')} />
    </View>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 24,
    paddingTop: 60,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#00ff88',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#aaa',
    marginBottom: 12,
  },
  summary: {
    fontSize: 14,
    color: '#ccc',
    lineHeight: 20,
  },
  regenerateButton: {
    backgroundColor: '#14967F',
    padding: 16,
    margin: 24,
    marginTop: 0,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#14967F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  regenerateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  quickActionCard: {
    flex: 1,
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#222',
  },
  quickActionIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  quickActionText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  recommendationsSection: {
    padding: 24,
    paddingTop: 0,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#888',
    marginBottom: 16,
  },
  recommendation: {
    fontSize: 14,
    color: '#aaa',
    lineHeight: 20,
    marginBottom: 8,
  },
  timeline: {
    padding: 24,
    paddingTop: 0,
  },
  timelineHint: {
    fontSize: 13,
    color: '#888',
    marginBottom: 16,
    fontStyle: 'italic',
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#2a2a2a',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  timelineItemFixed: {
    borderColor: '#14967F',
    borderWidth: 2,
    shadowColor: '#14967F',
    shadowOpacity: 0.3,
  },
  timelineItemCompleted: {
    opacity: 0.6,
    backgroundColor: '#0f1f0f',
  },
  checkbox: {
    marginRight: 12,
  },
  checkboxUnchecked: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#444',
  },
  checkboxChecked: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  timelineItemContent: {
    flex: 1,
    flexDirection: 'row',
  },
  timelineItemLeft: {
    marginRight: 16,
    alignItems: 'center',
  },
  timelineItemTime: {
    fontSize: 14,
    fontWeight: '600',
    color: '#00ff88',
    marginBottom: 4,
  },
  timelineItemIcon: {
    fontSize: 24,
  },
  timelineItemRight: {
    flex: 1,
  },
  timelineItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  completedText: {
    textDecorationLine: 'line-through',
    opacity: 0.7,
  },
  timelineItemNotes: {
    fontSize: 13,
    color: '#888',
    marginBottom: 8,
  },
  timelineItemMeta: {
    flexDirection: 'row',
    gap: 12,
  },
  timelineItemMetaText: {
    fontSize: 12,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 18,
    color: '#aaa',
    textAlign: 'center',
    marginBottom: 24,
  },
  button: {
    backgroundColor: '#14967F',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

