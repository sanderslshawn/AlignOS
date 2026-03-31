import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { usePlanStore } from '../store/planStore';
import type { DayState, DayMode, ConstraintBlock, WorkoutEvent, MealEvent, MealType } from '@physiology-engine/shared';
import { parseTimeString } from '@physiology-engine/shared';
import { useTheme, PrimaryButton, Card, SectionTitle, AppIcon } from '@physiology-engine/ui';
import { QUICK_STATUS_LABELS, QUICK_STATUS_SIGNALS, type QuickStatusSignal } from '../types/quickStatus';

const dayModes: DayMode[] = ['tight', 'flex', 'recovery', 'high-output', 'low-output'];

const dayModeInfo: Record<DayMode, { label: string; subtitle: string }> = {
  tight: { label: 'Tight', subtitle: 'Back-to-back meetings' },
  flex: { label: 'Flex', subtitle: 'Some control over time' },
  recovery: { label: 'Recovery', subtitle: 'Rest day' },
  'high-output': { label: 'High Output', subtitle: 'Peak performance' },
  'low-output': { label: 'Low Output', subtitle: 'Relaxed day' },
};

export default function TodaySetupScreen({ navigation }: any) {
  const { profile, setupToday } = usePlanStore();
  const { colors, typography, spacing, radius } = useTheme();
  const [dayMode, setDayMode] = useState<DayMode>(profile?.defaultDayMode || 'flex');
  const [sleepQuality, setSleepQuality] = useState('7');
  const [stressLevel, setStressLevel] = useState(profile?.stressBaseline.toString() || '5');
  const [currentHR, setCurrentHR] = useState('');
  const [quickStatusSignals, setQuickStatusSignals] = useState<QuickStatusSignal[]>([]);
  const [constraints, setConstraints] = useState<ConstraintBlock[]>([]);
  const [plannedWorkouts, setPlannedWorkouts] = useState<WorkoutEvent[]>([]);
  const [plannedMeals, setPlannedMeals] = useState<MealEvent[]>([]);

  const toggleQuickStatusSignal = (signal: QuickStatusSignal) => {
    setQuickStatusSignals((current) =>
      current.includes(signal)
        ? current.filter((value) => value !== signal)
        : [...current, signal]
    );
  };

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

      const lunchDuration = profile.lunchDurationMin ?? 30;
      const lunchStart = profile.lunchTime
        ? parseTimeString(profile.lunchTime, now)
        : new Date(workStart.getTime() + Math.floor((workEnd.getTime() - workStart.getTime()) / 2));
      const lunchEnd = new Date(lunchStart.getTime() + lunchDuration * 60000);

      if (lunchStart >= workStart && lunchEnd <= workEnd) {
        workConstraints.push({
          start: lunchStart,
          end: lunchEnd,
          type: 'appointment',
          description: 'Lunch Break',
        });
      }
    }
    
    const dayState: DayState = {
      deviceId: 'mobile-app',
      dateKey: now.toISOString().split('T')[0],
      date: now,
      dayMode,
      currentTime: wakeTime,
      sleepQuality: parseInt(sleepQuality) || 7,
      stressLevel: parseInt(stressLevel) || 5,
      currentHR: currentHR ? parseInt(currentHR) : undefined,
      events: [],
      plannedMeals,
      plannedCaffeine: [],
      plannedWalks: [],
      plannedWorkouts,
      plannedActivations: [],
      constraints: [...workConstraints, ...constraints],
      completedEvents: [],
      isHungry: quickStatusSignals.includes('hungry-now'),
      isCraving: quickStatusSignals.includes('craving-comfort'),
      removedStepIds: [],
      modifiedEvents: {},
      computedPlan: [],
    };

    (dayState as any).quickStatusSignals = quickStatusSignals;
    
    await setupToday(dayState);
    navigation.navigate('MainTabs', { screen: 'Timeline' });
  };

  
  const dayModeInfo = {
    'tight': { label: 'Tight', subtitle: 'Packed schedule' },
    'flex': { label: 'Flex', subtitle: 'Normal flexibility' },
    'recovery': { label: 'Recovery', subtitle: 'Taking it easy' },
    'high-output': { label: 'High Output', subtitle: 'Peak performance' },
    'low-output': { label: 'Low Output', subtitle: 'Light day' },
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={[styles.content, { padding: spacing.lg, paddingBottom: 120 }]}
        keyboardShouldPersistTaps="handled"
      >
      <SectionTitle title="How's Today Looking?" subtitle="Let's structure your day" />

      <Card style={{ marginBottom: spacing.xl }}>
        <Text style={[typography.bodyM, { color: colors.textSecondary, marginBottom: spacing.md, fontWeight: '600' }]}>
          Day Mode
        </Text>
        <View style={styles.modesContainer}>
          {dayModes.map((mode) => (
            <TouchableOpacity
              key={mode}
              style={[
                styles.modeButton,
                {
                  backgroundColor: dayMode === mode ? colors.accentSoft : colors.surface,
                  borderColor: dayMode === mode ? colors.accentPrimary : colors.borderSubtle,
                  borderRadius: radius.md,
                  paddingVertical: spacing.md,
                  paddingHorizontal: spacing.lg,
                },
              ]}
              onPress={() => setDayMode(mode)}
            >
              <Text
                style={[
                  typography.bodyM,
                  {
                    color: dayMode === mode ? colors.accentPrimary : colors.textSecondary,
                    fontWeight: '600',
                    textAlign: 'center',
                  },
                ]}
              >
                {dayModeInfo[mode].label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.md }]}>
          {dayModeInfo[dayMode].subtitle}
        </Text>
      </Card>

      <Card style={{ marginBottom: spacing.xl }}>
        <Text style={[typography.bodyM, { color: colors.textSecondary, marginBottom: spacing.md, fontWeight: '600' }]}>
          Sleep Quality (1-10)
        </Text>
        <View style={styles.gridContainer}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
            <TouchableOpacity
              key={num}
              style={[
                styles.gridButton,
                {
                  backgroundColor: parseInt(sleepQuality) === num ? colors.accentSoft : colors.surface,
                  borderColor: parseInt(sleepQuality) === num ? colors.accentPrimary : colors.borderSubtle,
                  borderRadius: radius.sm,
                },
              ]}
              onPress={() => setSleepQuality(num.toString())}
            >
              <Text
                style={[
                  typography.bodyM,
                  {
                    color: parseInt(sleepQuality) === num ? colors.accentPrimary : colors.textSecondary,
                    fontWeight: '600',
                  },
                ]}
              >
                {num}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.md }]}>
          {parseInt(sleepQuality) <= 4 && 'Poor sleep - plan will prioritize energy management'}
          {parseInt(sleepQuality) >= 5 && parseInt(sleepQuality) <= 7 && 'Average sleep - balanced approach'}
          {parseInt(sleepQuality) >= 8 && 'Great sleep - you can push harder today'}
        </Text>
      </Card>

      <Card style={{ marginBottom: spacing.xl }}>
        <Text style={[typography.bodyM, { color: colors.textSecondary, marginBottom: spacing.md, fontWeight: '600' }]}>
          Stress Level (1-10)
        </Text>
        <View style={styles.gridContainer}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
            <TouchableOpacity
              key={num}
              style={[
                styles.gridButton,
                {
                  backgroundColor: parseInt(stressLevel) === num ? colors.accentSoft : colors.surface,
                  borderColor: parseInt(stressLevel) === num ? colors.accentPrimary : colors.borderSubtle,
                  borderRadius: radius.sm,
                },
              ]}
              onPress={() => setStressLevel(num.toString())}
            >
              <Text
                style={[
                  typography.bodyM,
                  {
                    color: parseInt(stressLevel) === num ? colors.accentPrimary : colors.textSecondary,
                    fontWeight: '600',
                  },
                ]}
              >
                {num}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.md }]}>
          {parseInt(stressLevel) <= 3 && 'Low stress - plenty of capacity'}
          {parseInt(stressLevel) >= 4 && parseInt(stressLevel) <= 7 && 'Moderate stress - manageable'}
          {parseInt(stressLevel) >= 8 && 'High stress - plan will be gentler'}
        </Text>
      </Card>

      <Card style={{ marginBottom: spacing.xl }}>
        <Text style={[typography.bodyM, { color: colors.textSecondary, marginBottom: spacing.md, fontWeight: '600' }]}>
          Current Heart Rate (optional)
        </Text>
        <TextInput
          style={[
            styles.input,
            typography.bodyL,
            {
              backgroundColor: colors.surface,
              borderColor: colors.borderSubtle,
              borderRadius: radius.md,
              padding: spacing.md,
              color: colors.textPrimary,
            },
          ]}
          value={currentHR}
          onChangeText={setCurrentHR}
          keyboardType="numeric"
          placeholder={profile?.restingHR?.toString() || '60'}
          placeholderTextColor={colors.textMuted}
        />
      </Card>

      <Card style={{ marginBottom: spacing.xl }}>
        <Text style={[typography.bodyM, { color: colors.textSecondary, marginBottom: spacing.md, fontWeight: '600' }]}>
          Quick Status
        </Text>
        <View style={styles.statusRow}>
          {QUICK_STATUS_SIGNALS.map((signal) => {
            const active = quickStatusSignals.includes(signal);
            const iconName =
              signal === 'hungry-now'
                ? 'meal'
                : signal === 'craving-comfort'
                  ? 'sparkles'
                  : signal === 'low-energy'
                    ? 'flash'
                    : signal === 'high-stress'
                      ? 'alert'
                      : signal === 'dehydrated'
                        ? 'water'
                        : signal === 'poor-sleep'
                          ? 'sleep'
                          : 'brain';

            return (
              <TouchableOpacity
                key={signal}
                style={[
                  styles.statusButton,
                  {
                    backgroundColor: active ? colors.accentSoft : colors.surface,
                    borderColor: active ? colors.accentPrimary : colors.borderSubtle,
                    borderRadius: radius.md,
                    padding: spacing.md,
                  },
                ]}
                onPress={() => toggleQuickStatusSignal(signal)}
              >
                <AppIcon name={iconName as any} size={18} color={active ? colors.accentPrimary : colors.textSecondary} />
                <Text
                  style={[
                    typography.bodyM,
                    {
                      color: active ? colors.accentPrimary : colors.textSecondary,
                      marginTop: spacing.xs,
                      fontWeight: '500',
                      textAlign: 'center',
                      fontSize: 12,
                    },
                  ]}
                >
                  {QUICK_STATUS_LABELS[signal]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </Card>

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
                        onPress: (startTime: string | undefined) => {
                          if (startTime) {
                            Alert.prompt('Meeting End Time', 'End time (HH:MM)', [
                              { text: 'Cancel', style: 'cancel' },
                              {
                                text: 'Add',
                                onPress: (endTime: string | undefined) => {
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
                        onPress: (startTime: string | undefined) => {
                          if (startTime) {
                            Alert.prompt('Workout End Time', 'End time (HH:MM)', [
                              { text: 'Cancel', style: 'cancel' },
                              {
                                text: 'Add',
                                onPress: (endTime: string | undefined) => {
                                  if (endTime) {
                                    const now = new Date();
                                    const start = parseTimeString(startTime, now);
                                    const end = parseTimeString(endTime, now);
                                    const duration = Math.round((end.getTime() - start.getTime()) / 60000);
                                    setConstraints([...constraints, { start, end, type: 'exercise', description: 'Workout' }]);
                                    setPlannedWorkouts([...plannedWorkouts, {
                                      type: 'workout',
                                      status: 'PLANNED',
                                      time: start,
                                      source: 'USER',
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
                        onPress: (startTime: string | undefined) => {
                          if (startTime) {
                            Alert.prompt('Appointment End Time', 'End time (HH:MM)', [
                              { text: 'Cancel', style: 'cancel' },
                              {
                                text: 'Add',
                                onPress: (endTime: string | undefined) => {
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
                      onPress: (time: string | undefined) => {
                        if (time) {
                          const now = new Date();
                          const mealTime = parseTimeString(time, now);
                          setPlannedMeals([...plannedMeals, {
                            type: 'meal',
                            status: 'PLANNED',
                            time: mealTime,
                            source: 'USER',
                            mealType: type,
                          }]);
                        }
                      },
                    },
                  ]);
                },
              })).concat([{ text: 'Cancel', style: 'cancel' } as any])
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

      <PrimaryButton onPress={handleStartDay}>
        Generate My Plan
      </PrimaryButton>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 40,
  },
  modesContainer: {
    gap: 8,
  },
  modeButton: {
    borderWidth: 1,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  gridButton: {
    width: 60,
    height: 48,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    borderWidth: 1,
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statusButton: {
    width: '47%',
    borderWidth: 1,
    alignItems: 'center',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  addButton: {
    fontSize: 15,
    fontWeight: '600',
  },
  hint: {
    fontSize: 13,
    marginBottom: 8,
  },
  constraintList: {
    marginTop: 8,
  },
  constraintItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 8,
    borderRadius: 8,
  },
  constraintTitle: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  constraintTime: {
    fontSize: 12,
    marginRight: 12,
  },
  removeButton: {
    fontSize: 18,
    fontWeight: 'bold',
    paddingHorizontal: 8,
  },
});
