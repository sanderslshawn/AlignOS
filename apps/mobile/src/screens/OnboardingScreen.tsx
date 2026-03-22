import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Switch } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePlanStore } from '../store/planStore';
import type { UserProfile, DayMode, DietFoundation } from '@physiology-engine/shared';
import { LEARN_ALIGNOS_TOUR_KEY } from '../hooks/useTourProgress';

export default function OnboardingScreen({ navigation }: any) {
  const { saveProfile } = usePlanStore();
  const [step, setStep] = useState(1);
  
  // Form state
  const [wakeTime, setWakeTime] = useState('07:00');
  const [sleepTime, setSleepTime] = useState('23:00');
  const [fastingHours, setFastingHours] = useState('14');
  const [caffeineToleranceLow, setCaffeineToleranceLow] = useState(false);
  const [stressBaseline, setStressBaseline] = useState('5');
  const [restingHR, setRestingHR] = useState('60');
  const [maxHR, setMaxHR] = useState('180');
  const [dayMode, setDayMode] = useState<DayMode>('flex');
  const [mealPreference, setMealPreference] = useState<'protein-first' | 'carb-last' | 'balanced'>('balanced');
  const [dietFoundation, setDietFoundation] = useState<DietFoundation>('BALANCED');
  // Work/Exercise schedule
  const [workStartTime, setWorkStartTime] = useState('');
  const [workEndTime, setWorkEndTime] = useState('');
  const [commuteDuration, setCommuteDuration] = useState('');
  const [lunchTime, setLunchTime] = useState('12:30');
  const [lunchDurationMin, setLunchDurationMin] = useState('30');

  const handleComplete = async () => {
    const profile: UserProfile = {
      wakeTime,
      sleepTime,
      preferredFastingHours: parseInt(fastingHours) || 14,
      caffeineToleranceLow,
      stressBaseline: parseInt(stressBaseline) || 5,
      restingHR: parseInt(restingHR) || undefined,
      maxHR: parseInt(maxHR) || undefined,
      defaultDayMode: dayMode,
      mealSequencePreference: mealPreference,
      dietFoundation,
      allowComfortWindow: true,
      workStartTime: workStartTime || undefined,
      workEndTime: workEndTime || undefined,
      commuteDuration: commuteDuration ? parseInt(commuteDuration) : undefined,
      lunchTime: lunchTime || undefined,
      lunchDurationMin: parseInt(lunchDurationMin) || 30,
      fitnessGoal: 'GENERAL_HEALTH',
      useLearnedRhythm: true,
      useWeekendSchedule: false,
    };
    
    await saveProfile(profile);

    const hasCompletedTour = await AsyncStorage.getItem(LEARN_ALIGNOS_TOUR_KEY);
    if (hasCompletedTour === 'true') {
      navigation.navigate('TodaySetup');
      return;
    }

    navigation.navigate('LearnAlignOSTour', { nextRoute: 'TodaySetup' });
  };

  const dayModes: DayMode[] = ['tight', 'flex', 'recovery', 'high-output', 'low-output'];
  const mealPreferences = ['protein-first', 'carb-last', 'balanced'] as const;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.topLinksRow}>
        <TouchableOpacity style={styles.helpLink} onPress={() => navigation.navigate('HelpCenter')}>
          <Text style={styles.helpLinkText}>Open Help Center</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.helpLink} onPress={() => navigation.navigate('LearnAlignOSTour')}>
          <Text style={styles.helpLinkText}>Learn AlignOS Tour</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.title}>Setup Your Profile</Text>
      <Text style={styles.subtitle}>Step {step} of 4</Text>

      {step === 1 && (
        <View style={styles.stepContainer}>
          <Text style={styles.stepTitle}>Basic Schedule</Text>
          
          <Text style={styles.label}>Wake Time</Text>
          <TextInput
            style={styles.input}
            value={wakeTime}
            onChangeText={setWakeTime}
            placeholder="07:00"
            placeholderTextColor="#666"
          />

          <Text style={styles.label}>Sleep Time</Text>
          <TextInput
            style={styles.input}
            value={sleepTime}
            onChangeText={setSleepTime}
            placeholder="23:00"
            placeholderTextColor="#666"
          />

          <Text style={styles.label}>Preferred Fasting Hours</Text>
          <TextInput
            style={styles.input}
            value={fastingHours}
            onChangeText={setFastingHours}
            keyboardType="numeric"
            placeholder="14"
            placeholderTextColor="#666"
          />

          <TouchableOpacity style={styles.button} onPress={() => setStep(2)}>
            <Text style={styles.buttonText}>Next</Text>
          </TouchableOpacity>
        </View>
      )}

      {step === 2 && (
        <View style={styles.stepContainer}>
          <Text style={styles.stepTitle}>Physiology Basics</Text>
          
          <View style={styles.switchRow}>
            <Text style={styles.label}>Low Caffeine Tolerance</Text>
            <Switch
              value={caffeineToleranceLow}
              onValueChange={setCaffeineToleranceLow}
              trackColor={{ false: '#333', true: '#00ff88' }}
              thumbColor={caffeineToleranceLow ? '#fff' : '#666'}
            />
          </View>

          <Text style={styles.label}>Baseline Stress (1-10)</Text>
          <TextInput
            style={styles.input}
            value={stressBaseline}
            onChangeText={setStressBaseline}
            keyboardType="numeric"
            placeholder="5"
            placeholderTextColor="#666"
          />

          <Text style={styles.label}>Resting HR (optional)</Text>
          <TextInput
            style={styles.input}
            value={restingHR}
            onChangeText={setRestingHR}
            keyboardType="numeric"
            placeholder="60"
            placeholderTextColor="#666"
          />

          <Text style={styles.label}>Max HR (optional)</Text>
          <TextInput
            style={styles.input}
            value={maxHR}
            onChangeText={setMaxHR}
            keyboardType="numeric"
            placeholder="180"
            placeholderTextColor="#666"
          />

          <View style={styles.buttonRow}>
            <TouchableOpacity style={[styles.button, styles.buttonSecondary]} onPress={() => setStep(1)}>
              <Text style={styles.buttonText}>Back</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.button} onPress={() => setStep(3)}>
              <Text style={styles.buttonText}>Next</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {step === 3 && (
        <View style={styles.stepContainer}>
          <Text style={styles.stepTitle}>Preferences</Text>
          
          <Text style={styles.label}>Default Day Mode</Text>
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

          <Text style={styles.label}>Meal Sequence</Text>
          <View style={styles.optionsContainer}>
            {mealPreferences.map((pref) => (
              <TouchableOpacity
                key={pref}
                style={[styles.option, mealPreference === pref && styles.optionSelected]}
                onPress={() => setMealPreference(pref)}
              >
                <Text style={[styles.optionText, mealPreference === pref && styles.optionTextSelected]}>
                  {pref}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.buttonRow}>
            <TouchableOpacity style={[styles.button, styles.buttonSecondary]} onPress={() => setStep(2)}>
              <Text style={styles.buttonText}>Back</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.button} onPress={() => setStep(4)}>
              <Text style={styles.buttonText}>Next</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {step === 4 && (
        <View style={styles.stepContainer}>
          <Text style={styles.stepTitle}>Work & Exercise (Optional)</Text>
          <Text style={styles.hint}>Add your typical schedule so the plan works around it</Text>
          
          <Text style={styles.label}>Work Start Time</Text>
          <TextInput
            style={styles.input}
            value={workStartTime}
            onChangeText={setWorkStartTime}
            placeholder="09:00 (optional)"
            placeholderTextColor="#666"
          />

          <Text style={styles.label}>Work End Time</Text>
          <TextInput
            style={styles.input}
            value={workEndTime}
            onChangeText={setWorkEndTime}
            placeholder="17:00 (optional)"
            placeholderTextColor="#666"
          />

          <Text style={styles.label}>Commute Duration (minutes)</Text>
          <TextInput
            style={styles.input}
            value={commuteDuration}
            onChangeText={setCommuteDuration}
            keyboardType="numeric"
            placeholder="30 (optional)"
            placeholderTextColor="#666"
          />

          <Text style={styles.label}>Lunch Time</Text>
          <TextInput
            style={styles.input}
            value={lunchTime}
            onChangeText={setLunchTime}
            placeholder="12:30"
            placeholderTextColor="#666"
          />

          <Text style={styles.label}>Lunch Duration (minutes)</Text>
          <TextInput
            style={styles.input}
            value={lunchDurationMin}
            onChangeText={setLunchDurationMin}
            keyboardType="numeric"
            placeholder="30"
            placeholderTextColor="#666"
          />

          <Text style={styles.hint}>💡 You can add specific meetings and exercise times each day in the daily setup</Text>

          <View style={styles.buttonRow}>
            <TouchableOpacity style={[styles.button, styles.buttonSecondary]} onPress={() => setStep(3)}>
              <Text style={styles.buttonText}>Back</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.button} onPress={handleComplete}>
              <Text style={styles.buttonText}>Complete</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
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
  topLinksRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: 12,
  },
  helpLink: {
    alignSelf: 'auto',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#22D3EE',
    borderRadius: 8,
    marginLeft: 8,
  },
  helpLinkText: {
    color: '#22D3EE',
    fontSize: 12,
    fontWeight: '600',
  },
  stepContainer: {
    flex: 1,
  },
  stepTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 24,
  },
  label: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 8,
    marginTop: 16,
  },
  hint: {
    color: '#888',
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
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
  },
  optionsContainer: {
    gap: 8,
    marginTop: 8,
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
  button: {
    backgroundColor: '#00ff88',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 32,
    flex: 1,
  },
  buttonSecondary: {
    backgroundColor: '#333',
    marginRight: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    marginTop: 32,
  },
  buttonText: {
    color: '#000',
    fontSize: 18,
    fontWeight: '700',
  },
});
