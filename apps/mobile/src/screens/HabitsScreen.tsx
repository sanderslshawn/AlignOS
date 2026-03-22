import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
} from 'react-native';
import { format } from 'date-fns';
import { useHabitStore, HABIT_TEMPLATES } from '../store/habitStore';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

export default function HabitsScreen() {
  const { habits, completions, addHabit, deleteHabit, markComplete, markIncomplete, getHabitStats, getHabitsForDate } = useHabitStore();
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  
  const today = format(new Date(), 'yyyy-MM-dd');
  const todayHabits = getHabitsForDate(today);
  
  const handleToggleHabit = (habitId: string) => {
    const isCompleted = completions.some(
      (c) => c.habitId === habitId && c.date === today && c.completed
    );
    
    if (isCompleted) {
      markIncomplete(habitId, today);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else {
      markComplete(habitId, today);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };
  
  const handleAddFromTemplate = (template: typeof HABIT_TEMPLATES[0]) => {
    addHabit(template);
    setShowTemplates(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Success', `Added "${template.name}" to your habits!`);
  };
  
  const handleDeleteHabit = (habitId: string, habitName: string) => {
    Alert.alert(
      'Delete Habit',
      `Remove "${habitName}" from your habits?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteHabit(habitId);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
  };
  
  const calculateTodayCompletion = () => {
    if (todayHabits.length === 0) return 0;
    const completed = todayHabits.filter((h) =>
      completions.some((c) => c.habitId === h.id && c.date === today && c.completed)
    ).length;
    return Math.round((completed / todayHabits.length) * 100);
  };
  
  const todayCompletion = calculateTodayCompletion();
  
  return (
    <View style={styles.container}>
      {/* Header with Stats */}
      <View style={styles.headerGradient}>
        <Text style={styles.headerTitle}>📋 Habits</Text>
        <Text style={styles.headerSubtitle}>Build lasting routines</Text>
        
        <View style={styles.statsContainer}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{todayCompletion}%</Text>
            <Text style={styles.statLabel}>Today</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{habits.length}</Text>
            <Text style={styles.statLabel}>Total Habits</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{todayHabits.length}</Text>
            <Text style={styles.statLabel}>Due Today</Text>
          </View>
        </View>
      </View>
      
      <ScrollView style={styles.scrollView}>
        {/* Today's Habits */}
        {todayHabits.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Today's Habits</Text>
            {todayHabits.map((habit) => {
              const stats = getHabitStats(habit.id);
              const isCompleted = completions.some(
                (c) => c.habitId === habit.id && c.date === today && c.completed
              );
              
              return (
                <TouchableOpacity
                  key={habit.id}
                  style={[styles.habitCard, isCompleted && styles.habitCardCompleted]}
                  onPress={() => handleToggleHabit(habit.id)}
                  onLongPress={() => handleDeleteHabit(habit.id, habit.name)}
                >
                  <View style={styles.habitLeft}>
                    <View style={[styles.checkbox, isCompleted && styles.checkboxCompleted]}>
                      {isCompleted && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                    <View style={styles.habitInfo}>
                      <View style={styles.habitHeader}>
                        <Text style={styles.habitIcon}>{habit.icon}</Text>
                        <Text style={[styles.habitName, isCompleted && styles.habitNameCompleted]}>
                          {habit.name}
                        </Text>
                      </View>
                      <Text style={styles.habitDescription}>{habit.description}</Text>
                      {habit.targetValue && (
                        <Text style={styles.habitTarget}>
                          Target: {habit.targetValue} {habit.unit}
                        </Text>
                      )}
                    </View>
                  </View>
                  
                  <View style={styles.habitRight}>
                    <View style={styles.streakBadge}>
                      <Text style={styles.streakNumber}>🔥 {stats.currentStreak}</Text>
                      <Text style={styles.streakLabel}>streak</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
        
        {/* All Habits Overview */}
        {habits.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>All Habits</Text>
            {habits.map((habit) => {
              const stats = getHabitStats(habit.id);
              
              return (
                <View key={habit.id} style={styles.habitOverviewCard}>
                  <View style={styles.habitOverviewLeft}>
                    <Text style={styles.habitIcon}>{habit.icon}</Text>
                    <View style={styles.habitOverviewInfo}>
                      <Text style={styles.habitOverviewName}>{habit.name}</Text>
                      <Text style={styles.habitFrequency}>
                        {habit.frequency.charAt(0).toUpperCase() + habit.frequency.slice(1)}
                      </Text>
                    </View>
                  </View>
                  
                  <View style={styles.habitOverviewRight}>
                    <Text style={styles.habitCompletionRate}>{stats.completionRate}%</Text>
                    <Text style={styles.habitStreak}>🔥 {stats.currentStreak}d</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
        
        {/* Empty State */}
        {habits.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyTitle}>No Habits Yet</Text>
            <Text style={styles.emptyText}>
              Start tracking habits to build lasting routines and optimize your daily performance
            </Text>
          </View>
        )}
        
        {/* Add Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => {
              setShowTemplates(true);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            }}
          >
            <Text style={styles.primaryButtonText}>+ Add from Templates</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      
      {/* Templates Modal */}
      <Modal
        visible={showTemplates}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowTemplates(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Habit Templates</Text>
              <TouchableOpacity
                onPress={() => setShowTemplates(false)}
                style={styles.closeButton}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.templateList}>
              {HABIT_TEMPLATES.map((template, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.templateCard}
                  onPress={() => handleAddFromTemplate(template)}
                >
                  <Text style={styles.templateIcon}>{template.icon}</Text>
                  <View style={styles.templateInfo}>
                    <Text style={styles.templateName}>{template.name}</Text>
                    <Text style={styles.templateDescription}>{template.description}</Text>
                    <Text style={styles.templateFrequency}>
                      {template.frequency.charAt(0).toUpperCase() + template.frequency.slice(1)}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F1115',
  },
  headerGradient: {
    padding: 24,
    paddingTop: 60,
    paddingBottom: 32,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#0F1115',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#156773',
    marginBottom: 20,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
  },
  statBox: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#0F1115',
  },
  statLabel: {
    fontSize: 13,
    color: '#156773',
    marginTop: 4,
  },
  scrollView: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#F3F4F6',
    marginBottom: 16,
  },
  habitCard: {
    backgroundColor: '#1B202B',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#232834',
  },
  habitCardCompleted: {
    backgroundColor: 'rgba(34, 211, 238, 0.08)',
    borderColor: '#22D3EE',
  },
  habitLeft: {
    flexDirection: 'row',
    flex: 1,
    alignItems: 'flex-start',
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#232834',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxCompleted: {
    backgroundColor: '#22D3EE',
    borderColor: '#22D3EE',
  },
  checkmark: {
    color: '#0F1115',
    fontSize: 18,
    fontWeight: 'bold',
  },
  habitInfo: {
    flex: 1,
  },
  habitHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  habitIcon: {
    fontSize: 24,
    marginRight: 8,
  },
  habitName: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#F3F4F6',
  },
  habitNameCompleted: {
    color: '#22D3EE',
  },
  habitDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  habitTarget: {
    fontSize: 13,
    color: '#22D3EE',
    fontWeight: '600',
  },
  habitRight: {
    alignItems: 'flex-end',
  },
  streakBadge: {
    alignItems: 'center',
  },
  streakNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#F3F4F6',
  },
  streakLabel: {
    fontSize: 11,
    color: '#6B7280',
  },
  habitOverviewCard: {
    backgroundColor: '#1B202B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#232834',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  habitOverviewLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  habitOverviewInfo: {
    flex: 1,
  },
  habitOverviewName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F3F4F6',
    marginBottom: 2,
  },
  habitFrequency: {
    fontSize: 13,
    color: '#6B7280',
  },
  habitOverviewRight: {
    alignItems: 'flex-end',
  },
  habitCompletionRate: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#22D3EE',
  },
  habitStreak: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#F3F4F6',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    paddingHorizontal: 40,
    lineHeight: 24,
  },
  buttonContainer: {
    marginTop: 20,
    marginBottom: 40,
  },
  primaryButton: {
    backgroundColor: '#22D3EE',
    padding: 18,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 2,
  },
  primaryButtonText: {
    color: '#0F1115',
    fontSize: 17,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 17, 21, 0.95)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#151922',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#F3F4F6',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#232834',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#F3F4F6',
    fontSize: 20,
    fontWeight: 'bold',
  },
  templateList: {
    flex: 1,
  },
  templateCard: {
    backgroundColor: '#1B202B',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#232834',
  },
  templateIcon: {
    fontSize: 32,
    marginRight: 16,
  },
  templateInfo: {
    flex: 1,
  },
  templateName: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  templateDescription: {
    fontSize: 14,
    color: '#888',
    marginBottom: 4,
  },
  templateFrequency: {
    fontSize: 12,
    color: '#00ff88',
    fontWeight: '600',
  },
});
