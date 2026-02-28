import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Alert } from 'react-native';
import { usePlanStore } from '../store/planStore';
import type { DayState, DayMode, ConstraintBlock, WorkoutEvent, MealEvent, MealType } from '@physiology-engine/shared';
import { parseTimeString } from '@physiology-engine/shared';

export default function TodaySetupScreen({ navigation }: any) {
  const { profile, setupToday } = usePlanStore();
  const [dayMode, setDayMode] = useState<DayMode>(profile?.defaultDayMode || 'flex');
  const [sleepQuality, setSleepQuality] = useState('7');
  const [stressLevel, setStressLevel] = useState(profile?.stressBaseline.toString() || '5');
  const [currentHR, setCurrentHR] = useState('');
  const [isHungry, setIsHungry] = useState(false);
  const [isCraving, setIsCraving] = useState(false);
  const [constraints, setConstraints] = useState<ConstraintBlock[]>([]);
  const [plannedWorkouts, setPlannedWorkouts] = useState<WorkoutEvent[]>([]);
  const [plannedMeals, setPlannedMeals] = useState<MealEvent[]>([]);

  const handleStartDay = async () => {
    const now = new Date();
    
    // Set currentTime to wake time (start of day) so all events are included in the plan
    const wakeTime = profile 
      ? parseTimeString(profile.wakeTime, now)
      : now;
    
    // Add work hours as constraints if defined in profile
    const workConstraints: ConstraintBlock[] = [];
    if (profile?.workStartTime && profile?.workEndTime) {
      const workStart = parseTimeString(profile.workStartTime, now);
      const workEnd = parseTimeString(profile.workEndTime, now);
      
      if (profile.commuteDuration) {
        // Add morning commute
        const commuteStart = new Date(workStart.getTime() - profile.commuteDuration * 60000);
        workConstraints.push({
          start: commuteStart,
          end: workStart,
          type: 'commute',
          description: 'Morning commute',
        });
        // Add evening commute
        const eveningCommuteEnd = new Date(workEnd.getTime() + profile.commuteDuration * 60000);
        workConstraints.push({
          start: workEnd,
          end: eveningCommuteEnd,
          type: 'commute',
          description: 'Evening commute',
        });
      }
      
      workConstraints.push({
        start: workStart,
        end: workEnd,
        type: 'work',
        description: 'Work hours',
      });
    }
    
    const dayState: DayState = {
      date: now,
      dayMode,
      currentTime: wakeTime,
      sleepQuality: parseInt(sleepQuality) || 7,
      stressLevel: parseInt(stressLevel) || 5,
      currentHR: currentHR ? parseInt(currentHR) : undefined,
      plannedMeals,
      plannedCaffeine: [],
      plannedWalks: [],
      plannedWorkouts,
      plannedActivations: [],
      constraints: [...workConstraints, ...constraints],
      completedEvents: [],
      isHungry,
      isCraving,
      removedStepIds: [],
      modifiedEvents: {},
    };
    
    await setupToday(dayState);
    navigation.navigate('Timeline');
  };

  const dayModes: DayMode[] = ['tight', 'flex', 'recovery', 'high-output', 'low-output'];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>How's Today Looking?</Text>
      <Text style={styles.subtitle}>Let's structure your day</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Day Mode</Text>
        <View style={styles.optionsContainer}>
          {dayModes.map((mode) => (
            <TouchableOpacity
              key={mode}
              style={[styles.option, dayMode === mode && styles.optionSelected]}
              onPress={() => setDayMode(mode)}
            >
              <Text style={[styles.optionText, dayMode === mode && styles.optionTextSelected]}>
                {mode}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.hint}>
          {dayMode === 'tight' && '⏱️ Packed schedule, need maximum efficiency'}
          {dayMode === 'flex' && '🌊 Normal day with some flexibility'}
          {dayMode === 'recovery' && '😌 Taking it easy, prioritize rest'}
          {dayMode === 'high-output' && '🚀 Big deliverable, need peak performance'}
          {dayMode === 'low-output' && '🏖️ Light day, minimal demands'}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Sleep Quality (1-10)</Text>
        <View style={styles.sliderContainer}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
            <TouchableOpacity
              key={num}
              style={[
                styles.sliderButton,
                parseInt(sleepQuality) === num && styles.sliderButtonSelected,
              ]}
              onPress={() => setSleepQuality(num.toString())}
            >
              <Text
                style={[
                  styles.sliderButtonText,
                  parseInt(sleepQuality) === num && styles.sliderButtonTextSelected,
                ]}
              >
                {num}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.hint}>
          {parseInt(sleepQuality) <= 4 && '😴 Poor sleep - plan will prioritize energy management'}
          {parseInt(sleepQuality) >= 5 && parseInt(sleepQuality) <= 7 && '😐 Average sleep - balanced approach'}
          {parseInt(sleepQuality) >= 8 && '✨ Great sleep - you can push harder today'}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Stress Level (1-10)</Text>
        <View style={styles.sliderContainer}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
            <TouchableOpacity
              key={num}
              style={[
                styles.sliderButton,
                parseInt(stressLevel) === num && styles.sliderButtonSelected,
              ]}
              onPress={() => setStressLevel(num.toString())}
            >
              <Text
                style={[
                  styles.sliderButtonText,
                  parseInt(stressLevel) === num && styles.sliderButtonTextSelected,
                ]}
              >
                {num}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.hint}>
          {parseInt(stressLevel) <= 3 && '😌 Low stress - plenty of capacity'}
          {parseInt(stressLevel) >= 4 && parseInt(stressLevel) <= 7 && '😐 Moderate stress - manageable'}
          {parseInt(stressLevel) >= 8 && '😰 High stress - plan will be gentler'}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Current Heart Rate (optional)</Text>
        <TextInput
          style={styles.input}
          value={currentHR}
          onChangeText={setCurrentHR}
          keyboardType="numeric"
          placeholder={profile?.restingHR?.toString() || '60'}
          placeholderTextColor="#666"
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Status</Text>
        <View style={styles.statusRow}>
          <TouchableOpacity
            style={[styles.statusButton, isHungry && styles.statusButtonActive]}
            onPress={() => setIsHungry(!isHungry)}
          >
            <Text style={[styles.statusButtonText, isHungry && styles.statusButtonTextActive]}>
              🍽️ Hungry now
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.statusButton, isCraving && styles.statusButtonActive]}
            onPress={() => setIsCraving(!isCraving)}
          >
            <Text style={[styles.statusButtonText, isCraving && styles.statusButtonTextActive]}>
              🍰 Craving comfort food
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Constraints Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Today's Schedule</Text>
          <TouchableOpacity onPress={() => {
            Alert.alert(
              'Add to Schedule',
              'What would you like to add?',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Meeting',
                  onPress: () => {
                    Alert.prompt('Meeting Start Time', 'Start time (HH:MM)', [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Next',
                        onPress: (startTime) => {
                          if (startTime) {
                            Alert.prompt('Meeting End Time', 'End time (HH:MM)', [
                              { text: 'Cancel', style: 'cancel' },
                              {
                                text: 'Add',
                                onPress: (endTime) => {
                                  if (endTime) {
                                    const now = new Date();
                                    const start = parseTimeString(startTime, now);
                                    const end = parseTimeString(endTime, now);
                                    setConstraints([...constraints, { start, end, type: 'meeting', description: 'Meeting' }]);
                                  }
                                },
                              },
                            ]);
                          }
                        },
                      },
                    ]);
                  },
                },
                {
                  text: 'Workout',
                  onPress: () => {
                    Alert.prompt('Workout Start Time', 'Start time (HH:MM)', [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Next',
                        onPress: (startTime) => {
                          if (startTime) {
                            Alert.prompt('Workout End Time', 'End time (HH:MM)', [
                              { text: 'Cancel', style: 'cancel' },
                              {
                                text: 'Add',
                                onPress: (endTime) => {
                                  if (endTime) {
                                    const now = new Date();
                                    const start = parseTimeString(startTime, now);
                                    const end = parseTimeString(endTime, now);
                                    const duration = Math.round((end.getTime() - start.getTime()) / 60000);
                                    setConstraints([...constraints, { start, end, type: 'exercise', description: 'Workout' }]);
                                    setPlannedWorkouts([...plannedWorkouts, {
                                      type: 'workout',
                                      time: start,
                                      duration,
                                      intensity: 'moderate',
                                    }]);
                                  }
                                },
                              },
                            ]);
                          }
                        },
                      },
                    ]);
                  },
                },
                {
                  text: 'Appointment',
                  onPress: () => {
                    Alert.prompt('Appointment Start Time', 'Start time (HH:MM)', [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Next',
                        onPress: (startTime) => {
                          if (startTime) {
                            Alert.prompt('Appointment End Time', 'End time (HH:MM)', [
                              { text: 'Cancel', style: 'cancel' },
                              {
                                text: 'Add',
                                onPress: (endTime) => {
                                  if (endTime) {
                                    const now = new Date();
                                    const start = parseTimeString(startTime, now);
                                    const end = parseTimeString(endTime, now);
                                    setConstraints([...constraints, { start, end, type: 'appointment', description: 'Appointment' }]);
                                  }
                                },
                              },
                            ]);
                          }
                        },
                      },
                    ]);
                  },
                },
              ]
            );
          }}>
            <Text style={styles.addButton}>+ Add</Text>
          </TouchableOpacity>
        </View>
        {constraints.length === 0 && profile?.workStartTime ? (
          <Text style={styles.hint}>✓ Work hours will be added automatically from your profile</Text>
        ) : constraints.length === 0 ? (
          <Text style={styles.hint}>Add meetings, workouts, or appointments for today</Text>
        ) : (
          <View style={styles.constraintList}>
            {constraints.map((constraint, index) => (
              <View key={index} style={styles.constraintItem}>
                <View>
                  <Text style={styles.constraintTitle}>
                    {constraint.type === 'exercise' ? '🏋️' : constraint.type === 'meeting' ? '📅' : '📍'} {constraint.description || constraint.type}
                  </Text>
                  <Text style={styles.constraintTime}>
                    {constraint.start.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })} - {constraint.end.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setConstraints(constraints.filter((_, i) => i !== index))}>
                  <Text style={styles.removeButton}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Meals Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Pre-plan Specific Meals</Text>
          <TouchableOpacity onPress={() => {
            const mealTypes: MealType[] = ['lean-protein', 'richer-protein', 'carb-heavy', 'comfort-meal'];
            Alert.alert(
              'Add Meal',
              'Choose meal type',
              mealTypes.map(type => ({
                text: type,
                onPress: () => {
                  Alert.prompt('Meal Time', 'Time (HH:MM)', [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Add',
                      onPress: (time) => {
                        if (time) {
                          const now = new Date();
                          const mealTime = parseTimeString(time, now);
                          setPlannedMeals([...plannedMeals, {
                            type: 'meal',
                            time: mealTime,
                            mealType: type,
                          }]);
                        }
                      },
                    },
                  ]);
                },
              })).concat([{ text: 'Cancel', style: 'cancel' }])
            );
          }}>
            <Text style={styles.addButton}>+ Add</Text>
          </TouchableOpacity>
        </View>
        {plannedMeals.length === 0 ? (
          <Text style={styles.hint}>Plan will auto-generate meals, or you can specify particular ones</Text>
        ) : (
          <View style={styles.constraintList}>
            {plannedMeals.map((meal, index) => (
              <View key={index} style={styles.constraintItem}>
                <View>
                  <Text style={styles.constraintTitle}>🍽️ {meal.mealType}</Text>
                  <Text style={styles.constraintTime}>
                    {meal.time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setPlannedMeals(plannedMeals.filter((_, i) => i !== index))}>
                  <Text style={styles.removeButton}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </View>

      <TouchableOpacity style={styles.button} onPress={handleStartDay}>
        <Text style={styles.buttonText}>Generate My Plan</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    color: '#00ff88',
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    color: '#666',
    fontSize: 16,
    marginBottom: 32,
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  addButton: {
    color: '#00ff88',
    fontSize: 16,
    fontWeight: '600',
  },
  constraintList: {
    gap: 8,
  },
  constraintItem: {
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  constraintTitle: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 4,
  },
  constraintTime: {
    color: '#888',
    fontSize: 14,
  },
  removeButton: {
    color: '#ff4444',
    fontSize: 20,
    padding: 4,
  },
  optionsContainer: {
    gap: 8,
  },
  option: {
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  optionSelected: {
    borderColor: '#00ff88',
    backgroundColor: '#001a0f',
  },
  optionText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  optionTextSelected: {
    color: '#00ff88',
  },
  sliderContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sliderButton: {
    width: 60,
    height: 48,
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sliderButtonSelected: {
    borderColor: '#00ff88',
    backgroundColor: '#001a0f',
  },
  sliderButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  sliderButtonTextSelected: {
    color: '#00ff88',
  },
  hint: {
    color: '#666',
    fontSize: 14,
    marginTop: 8,
    fontStyle: 'italic',
  },
  input: {
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 16,
  },
  statusRow: {
    gap: 8,
  },
  statusButton: {
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  statusButtonActive: {
    borderColor: '#00ff88',
    backgroundColor: '#001a0f',
  },
  statusButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  statusButtonTextActive: {
    color: '#00ff88',
  },
  button: {
    backgroundColor: '#00ff88',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  buttonText: {
    color: '#000',
    fontSize: 18,
    fontWeight: '700',
  },
});
