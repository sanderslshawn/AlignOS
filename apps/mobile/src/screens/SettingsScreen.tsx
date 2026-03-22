import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  Alert,
} from 'react-native';
import { usePlanStore } from '../store/planStore';
import { getApiBaseUrl } from '../utils/apiBaseUrl';
import { parseTimeToMinutes, minutesToHHmm } from '../utils/time';
import ClockTimeField from '../components/ClockTimeField';
import { formatClockTime, parseClockTime } from '../utils/clockTime';
import { useThemeStore } from '../store/themeStore';
import { useHabitStore } from '../store/habitStore';
import type { UserProfile, DayMode, DietFoundation, FitnessGoal, ClockTime } from '@physiology-engine/shared';
import { useNavigation } from '@react-navigation/native';
import { 
  requestNotificationPermissions, 
  loadNotificationSettings, 
  saveNotificationSettings,
  cancelAllNotifications,
  getScheduledNotificationsDebugInfo,
  scheduleDayPlanNotifications,
  type NotificationSettings 
} from '../utils/notifications';
import * as Haptics from 'expo-haptics';

type RhythmConfidence = 'low' | 'medium' | 'high';

interface RhythmProfile {
  daysObserved: number;
  confidence: RhythmConfidence;
  rollingMedians: {
    wake?: string;
    sleep?: string;
    firstMeal?: string;
    lunch?: string;
    lastMeal?: string;
  };
  commonBins: {
    walk: string[];
    workout: string[];
  };
  adherenceScore: number;
  disruptionWindows: number[];
}

export default function SettingsScreen() {
  const navigation = useNavigation();
  const { profile, saveProfile, todayEntries, fullDayPlan, deviceId } = usePlanStore();
  const { mode: themeMode, setThemeMode } = useThemeStore();
  const { habits } = useHabitStore();
  const API_BASE_URL = getApiBaseUrl();
  
  const [editedProfile, setEditedProfile] = useState<UserProfile | null>(profile);
  const [hasChanges, setHasChanges] = useState(false);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings | null>(null);
  const [rhythmProfile, setRhythmProfile] = useState<RhythmProfile | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    schedule: true,
    weekend: false,
    work: false,
    rhythm: false,
    physiology: false,
    preferences: false,
    notifications: false,
    appearance: false,
    habits: false,
    data: false,
  });
  
  useEffect(() => {
    loadNotificationSettings().then(setNotificationSettings);
  }, []);

  useEffect(() => {
    const resyncNotifications = async () => {
      if (!notificationSettings || !fullDayPlan || !editedProfile) return;

      if (!notificationSettings.enabled) {
        await cancelAllNotifications();
        return;
      }

      await scheduleDayPlanNotifications(fullDayPlan, editedProfile, notificationSettings);
    };

    resyncNotifications().catch((error) => {
      console.warn('[Settings] Failed to resync notifications', error);
    });
  }, [notificationSettings, fullDayPlan, editedProfile]);

  useEffect(() => {
    const loadRhythm = async () => {
      if (!deviceId) return;
      try {
        const response = await fetch(`${API_BASE_URL}/day/${deviceId}/rhythm`);
        if (!response.ok) return;
        const payload = (await response.json()) as RhythmProfile;
        setRhythmProfile(payload);
      } catch (error) {
        console.warn('[Settings] Failed to load rhythm profile', error);
      }
    };

    void loadRhythm();
  }, [deviceId]);

  if (!editedProfile) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyText}>No profile found</Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.navigate('Onboarding' as never)}
        >
          <Text style={styles.buttonText}>Go to Onboarding</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleUpdate = (field: keyof UserProfile, value: any) => {
    const nextProfile: UserProfile = { ...editedProfile!, [field]: value };

    const timeToMinField: Partial<Record<keyof UserProfile, keyof UserProfile>> = {
      wakeTime: 'wakeMin',
      sleepTime: 'sleepMin',
      workStartTime: 'workStartMin',
      workEndTime: 'workEndMin',
      lunchTime: 'lunchStartMin',
    };

    const matchedMinuteField = timeToMinField[field];
    if (matchedMinuteField && typeof value === 'string') {
      const minutes = parseTimeToMinutes(value);
      if (minutes !== null && minutes !== undefined) {
        (nextProfile as any)[field] = minutesToHHmm(minutes);
        (nextProfile as any)[matchedMinuteField] = minutes;
      }
    }

    if (typeof value === 'object' && value?.hour && value?.minute !== undefined) {
      const clockTime = parseClockTime(value as ClockTime);
      if (clockTime && matchedMinuteField) {
        const hhmm = minutesToHHmm((clockTime.period === 'PM' ? (clockTime.hour % 12) + 12 : clockTime.hour % 12) * 60 + clockTime.minute);
        (nextProfile as any)[field] = hhmm;
        (nextProfile as any)[matchedMinuteField] = parseTimeToMinutes(hhmm);
      }
    }

    setEditedProfile(nextProfile);
    setHasChanges(true);
  };

  const handleClockFieldUpdate = (
    field: keyof UserProfile,
    clockField: keyof UserProfile,
    value: ClockTime
  ) => {
    if (!editedProfile) return;
    const formatted = formatClockTime(value);
    const minutes = parseTimeToMinutes(minutesToHHmm((value.period === 'PM' ? (value.hour % 12) + 12 : value.hour % 12) * 60 + value.minute));
    const nextProfile: UserProfile = {
      ...editedProfile,
      [field]: formatted,
      [clockField]: value,
    } as UserProfile;

    const timeToMinField: Partial<Record<keyof UserProfile, keyof UserProfile>> = {
      wakeTime: 'wakeMin',
      sleepTime: 'sleepMin',
      workStartTime: 'workStartMin',
      workEndTime: 'workEndMin',
      lunchTime: 'lunchStartMin',
    };

    const minField = timeToMinField[field];
    if (minField && minutes !== null && minutes !== undefined) {
      (nextProfile as any)[minField] = minutes;
      (nextProfile as any)[field] = minutesToHHmm(minutes);
    }

    setEditedProfile(nextProfile);
    setHasChanges(true);
  };

  const handleNotificationUpdate = async (field: keyof NotificationSettings, value: any) => {
    if (!notificationSettings) return;
    
    const updated = { ...notificationSettings, [field]: value };
    setNotificationSettings(updated);
    await saveNotificationSettings(updated);
    
    // Re-schedule notifications with new settings
    if (fullDayPlan && editedProfile) {
      await scheduleDayPlanNotifications(fullDayPlan, editedProfile, updated);
    }
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };
  
  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };
  
  const handleSave = async () => {
    if (editedProfile) {
      await saveProfile(editedProfile);
      setHasChanges(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Success', 'Profile updated successfully');
    }
  };
  
  const handleEnableNotifications = async () => {
    const granted = await requestNotificationPermissions();
    if (granted) {
      if (!notificationSettings) return;
      const updated = {
        ...notificationSettings,
        enabled: true,
        hasPermission: true,
      };
      setNotificationSettings(updated);
      await saveNotificationSettings(updated);

      if (fullDayPlan && editedProfile) {
        await scheduleDayPlanNotifications(fullDayPlan, editedProfile, updated);
      }

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      Alert.alert('Success', 'Notifications enabled! You\'ll receive smart reminders based on your schedule.');
    } else {
      if (notificationSettings) {
        const updated = {
          ...notificationSettings,
          enabled: false,
          hasPermission: false,
        };
        setNotificationSettings(updated);
        await saveNotificationSettings(updated);
      }
      Alert.alert('Permission Denied', 'Please enable notifications in your device settings to receive reminders.');
    }
  };

  const handleCheckScheduledNotifications = async () => {
    const debugInfo = await getScheduledNotificationsDebugInfo();
    const enabledSetting = notificationSettings?.enabled ? 'on' : 'off';
    const sampleIds = debugInfo.identifiers.length ? `\nSample IDs: ${debugInfo.identifiers.join(', ')}` : '';

    Alert.alert(
      'Notification Debug',
      `Permission: ${debugInfo.hasPermission ? 'granted' : 'not granted'}\nSetting enabled: ${enabledSetting}\nScheduled count: ${debugInfo.count}${sampleIds}`
    );
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleReset = () => {
    Alert.alert(
      'Reset Profile',
      'This will clear your profile and return you to onboarding. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            // Clear all storage
            const AsyncStorage = require('@react-native-async-storage/async-storage').default;
            await AsyncStorage.multiRemove(['userProfile', 'deviceId']);
            // Clear all dayState entries
            const allKeys = await AsyncStorage.getAllKeys();
            const dayStateKeys = allKeys.filter((key: string) => key.startsWith('dayState_'));
            if (dayStateKeys.length > 0) {
              await AsyncStorage.multiRemove(dayStateKeys);
            }
            // Reset store
            usePlanStore.setState({ profile: null, dayState: null, computedPlan: null });
            navigation.navigate('Welcome' as never);
          },
        },
      ]
    );
  };

  const handleClearTodayData = () => {
    Alert.alert(
      'Clear Today\'s Data',
      'This will clear your current day state and plan. Your profile will be kept. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            const AsyncStorage = require('@react-native-async-storage/async-storage').default;
            const dateKey = require('date-fns').format(new Date(), 'yyyy-MM-dd');
            await AsyncStorage.removeItem(`dayState_${dateKey}`);
            usePlanStore.setState({ dayState: null, computedPlan: null });
            navigation.navigate('TodaySetup' as never);
          },
        },
      ]
    );
  };

  const dayModes: DayMode[] = ['tight', 'flex', 'recovery', 'high-output', 'low-output'];
  const mealPreferences = ['protein-first', 'carb-last', 'balanced'] as const;
  const dietFoundations = [
    'BALANCED',
    'KETO',
    'CARNIVORE',
    'MEDITERRANEAN',
    'LOW_CALORIE',
    'LOW_FAT',
    'LOW_CARB',
    'HIGH_PROTEIN',
  ] as const;
  const fitnessGoals: FitnessGoal[] = [
    'FAT_LOSS',
    'WEIGHT_LOSS',
    'MAINTENANCE',
    'MUSCLE_GAIN',
    'PERFORMANCE',
    'GENERAL_HEALTH',
  ];

  const confidenceLabel =
    rhythmProfile?.confidence === 'high'
      ? 'High'
      : rhythmProfile?.confidence === 'medium'
        ? 'Med'
        : 'Low';

  const fallbackUseLearnedRhythm =
    (rhythmProfile?.confidence === 'medium' || rhythmProfile?.confidence === 'high');

  const useLearnedRhythm = editedProfile.useLearnedRhythm ?? fallbackUseLearnedRhythm;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.header}>⚙️ Settings</Text>
      <Text style={styles.subtitle}>Personalize your optimization experience</Text>

      {/* WEEKEND SCHEDULE SECTION */}
      <TouchableOpacity
        style={styles.sectionHeader}
        onPress={() => toggleSection('weekend')}
      >
        <Text style={styles.sectionTitle}>🌴 Weekend Schedule</Text>
        <Text style={styles.expandIcon}>{expandedSections.weekend ? '▼' : '▶'}</Text>
      </TouchableOpacity>
      
      {expandedSections.weekend && (
        <View style={styles.section}>
          <View style={styles.row}>
            <Text style={styles.label}>Use Weekend Schedule</Text>
            <Switch
              value={editedProfile?.useWeekendSchedule ?? false}
              onValueChange={(value) => handleUpdate('useWeekendSchedule', value)}
              trackColor={{ false: '#444', true: '#22D3EE' }}
              thumbColor="#fff"
            />
          </View>
          <Text style={styles.helpText}>
            Set different wake/sleep times for Saturday & Sunday
          </Text>
          
          {editedProfile?.useWeekendSchedule && (
            <>
              <View style={styles.row}>
                <Text style={styles.label}>Weekend Wake Time</Text>
                <TextInput
                  style={styles.input}
                  value={editedProfile.weekendWakeTime || editedProfile.wakeTime}
                  onChangeText={(text) => handleUpdate('weekendWakeTime', text)}
                  placeholder={editedProfile.wakeTime}
                  placeholderTextColor="#666"
                />
              </View>

              <View style={styles.row}>
                <Text style={styles.label}>Weekend Sleep Time</Text>
                <TextInput
                  style={styles.input}
                  value={editedProfile.weekendSleepTime || editedProfile.sleepTime}
                  onChangeText={(text) => handleUpdate('weekendSleepTime', text)}
                  placeholder={editedProfile.sleepTime}
                  placeholderTextColor="#666"
                />
              </View>

              <View style={styles.row}>
                <Text style={styles.label}>Weekend Work Start</Text>
                <TextInput
                  style={styles.input}
                  value={editedProfile.weekendWorkStartTime || ''}
                  onChangeText={(text) => handleUpdate('weekendWorkStartTime', text || undefined)}
                  placeholder="None"
                  placeholderTextColor="#666"
                />
              </View>

              <View style={styles.row}>
                <Text style={styles.label}>Weekend Work End</Text>
                <TextInput
                  style={styles.input}
                  value={editedProfile.weekendWorkEndTime || ''}
                  onChangeText={(text) => handleUpdate('weekendWorkEndTime', text || undefined)}
                  placeholder="None"
                  placeholderTextColor="#666"
                />
              </View>
            </>
          )}
        </View>
      )}

      {/* NOTIFICATIONS SECTION */}
      <TouchableOpacity
        style={styles.sectionHeader}
        onPress={() => toggleSection('notifications')}
      >
        <Text style={styles.sectionTitle}>🔔 Smart Notifications</Text>
        <Text style={styles.expandIcon}>{expandedSections.notifications ? '▼' : '▶'}</Text>
      </TouchableOpacity>
      
      {expandedSections.notifications && notificationSettings && (
        <View style={styles.section}>
          <View style={styles.row}>
            <Text style={styles.label}>Enable Notifications</Text>
            <Switch
              value={notificationSettings.enabled}
              onValueChange={(value) => 
                value ? handleEnableNotifications() : handleNotificationUpdate('enabled', value)
              }
              trackColor={{ false: '#444', true: '#22D3EE' }}
              thumbColor="#fff"
            />
          </View>
          
          {notificationSettings.enabled && (
            <>
              <Text style={[styles.label, { marginTop: 16, marginBottom: 8 }]}>
                Reminder Types
              </Text>
              
              <View style={styles.row}>
                <Text style={styles.sublabel}>🍽️ Meal Reminders</Text>
                <Switch
                  value={notificationSettings.mealReminders}
                  onValueChange={(value) => handleNotificationUpdate('mealReminders', value)}
                  trackColor={{ false: '#444', true: '#22D3EE' }}
                  thumbColor="#fff"
                />
              </View>
              
              <View style={styles.row}>
                <Text style={styles.sublabel}>💪 Workout Reminders</Text>
                <Switch
                  value={notificationSettings.workoutReminders}
                  onValueChange={(value) => handleNotificationUpdate('workoutReminders', value)}
                  trackColor={{ false: '#444', true: '#22D3EE' }}
                  thumbColor="#fff"
                />
              </View>
              
              <View style={styles.row}>
                <Text style={styles.sublabel}>🚶 Walk Reminders</Text>
                <Switch
                  value={notificationSettings.walkReminders}
                  onValueChange={(value) => handleNotificationUpdate('walkReminders', value)}
                  trackColor={{ false: '#444', true: '#22D3EE' }}
                  thumbColor="#fff"
                />
              </View>
              
              <View style={styles.row}>
                <Text style={styles.sublabel}>💧 Hydration Reminders</Text>
                <Switch
                  value={notificationSettings.hydrationReminders}
                  onValueChange={(value) => handleNotificationUpdate('hydrationReminders', value)}
                  trackColor={{ false: '#444', true: '#22D3EE' }}
                  thumbColor="#fff"
                />
              </View>
              
              <View style={styles.row}>
                <Text style={styles.sublabel}>⚡ Energy Alerts</Text>
                <Switch
                  value={notificationSettings.energyAlerts}
                  onValueChange={(value) => handleNotificationUpdate('energyAlerts', value)}
                  trackColor={{ false: '#444', true: '#22D3EE' }}
                  thumbColor="#fff"
                />
              </View>
              
              <View style={styles.row}>
                <Text style={styles.sublabel}>🌅 Morning Motivation</Text>
                <Switch
                  value={notificationSettings.morningMotivation}
                  onValueChange={(value) => handleNotificationUpdate('morningMotivation', value)}
                  trackColor={{ false: '#444', true: '#22D3EE' }}
                  thumbColor="#fff"
                />
              </View>
              
              <View style={styles.row}>
                <Text style={styles.sublabel}>🌙 Evening Wind-Down</Text>
                <Switch
                  value={notificationSettings.eveningWindown}
                  onValueChange={(value) => handleNotificationUpdate('eveningWindown', value)}
                  trackColor={{ false: '#444', true: '#22D3EE' }}
                  thumbColor="#fff"
                />
              </View>
              
              <Text style={[styles.label, { marginTop: 16, marginBottom: 8 }]}>
                Timing
              </Text>
              
              <View style={styles.row}>
                <Text style={styles.sublabel}>Meal Reminder (min before)</Text>
                <TextInput
                  style={styles.smallInput}
                  value={notificationSettings.preMealMinutes.toString()}
                  onChangeText={(text) => handleNotificationUpdate('preMealMinutes', parseInt(text) || 15)}
                  keyboardType="number-pad"
                />
              </View>
              
              <View style={styles.row}>
                <Text style={styles.sublabel}>Workout Reminder (min before)</Text>
                <TextInput
                  style={styles.smallInput}
                  value={notificationSettings.preWorkoutMinutes.toString()}
                  onChangeText={(text) => handleNotificationUpdate('preWorkoutMinutes', parseInt(text) || 30)}
                  keyboardType="number-pad"
                />
              </View>
              
              <Text style={[styles.label, { marginTop: 16, marginBottom: 8 }]}>
                Quiet Hours
              </Text>
              <Text style={styles.helpText}>No notifications during this time</Text>
              
              <View style={styles.row}>
                <Text style={styles.sublabel}>Start</Text>
                <TextInput
                  style={styles.input}
                  value={notificationSettings.quietHoursStart}
                  onChangeText={(text) => handleNotificationUpdate('quietHoursStart', text)}
                  placeholder="22:00"
                  placeholderTextColor="#666"
                />
              </View>
              
              <View style={styles.row}>
                <Text style={styles.sublabel}>End</Text>
                <TextInput
                  style={styles.input}
                  value={notificationSettings.quietHoursEnd}
                  onChangeText={(text) => handleNotificationUpdate('quietHoursEnd', text)}
                  placeholder="07:00"
                  placeholderTextColor="#666"
                />
              </View>

              <TouchableOpacity
                style={[styles.primaryButton, { marginTop: 8 }]}
                onPress={handleCheckScheduledNotifications}
              >
                <Text style={styles.primaryButtonText}>Check Scheduled Notifications</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}

      {/* APPEARANCE SECTION */}
      <TouchableOpacity
        style={styles.sectionHeader}
        onPress={() => toggleSection('appearance')}
      >
        <Text style={styles.sectionTitle}>🎨 Appearance</Text>
        <Text style={styles.expandIcon}>{expandedSections.appearance ? '▼' : '▶'}</Text>
      </TouchableOpacity>
      
      {expandedSections.appearance && (
        <View style={styles.section}>
          <Text style={styles.label}>Theme Mode</Text>
          <Text style={styles.helpText}>
            Auto mode switches to dark after 8 PM for optimal melatonin production
          </Text>
          <View style={styles.chipContainer}>
            {(['light', 'dark', 'auto'] as const).map((mode) => (
              <TouchableOpacity
                key={mode}
                style={[
                  styles.chip,
                  themeMode === mode && styles.chipSelected,
                ]}
                onPress={() => {
                  setThemeMode(mode);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
              >
                <Text
                  style={[
                    styles.chipText,
                    themeMode === mode && styles.chipTextSelected,
                  ]}
                >
                  {mode === 'light' ? '☀️ Light' : mode === 'dark' ? '🌙 Dark' : '🔄 Auto'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* HABITS SECTION */}
      <TouchableOpacity
        style={styles.sectionHeader}
        onPress={() => toggleSection('habits')}
      >
        <Text style={styles.sectionTitle}>📋 Habits ({habits.length})</Text>
        <Text style={styles.expandIcon}>{expandedSections.habits ? '▼' : '▶'}</Text>
      </TouchableOpacity>
      
      {expandedSections.habits && (
        <View style={styles.section}>
          <Text style={styles.helpText}>
            Track daily habits and build lasting routines
          </Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              navigation.navigate('Habits' as never);
            }}
          >
            <Text style={styles.primaryButtonText}>
              {habits.length > 0 ? 'Manage Habits' : 'Add Your First Habit'}
            </Text>
          </TouchableOpacity>
          
          {habits.length > 0 && (
            <View style={{ marginTop: 12 }}>
              {habits.slice(0, 3).map((habit) => (
                <View key={habit.id} style={styles.habitPreview}>
                  <Text style={styles.habitIcon}>{habit.icon}</Text>
                  <Text style={styles.habitName}>{habit.name}</Text>
                </View>
              ))}
              {habits.length > 3 && (
                <Text style={styles.moreText}>+ {habits.length - 3} more habits</Text>
              )}
            </View>
          )}
        </View>
      )}

      {/* WEEKLY SUMMARY */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📊 Weekly Summary</Text>
        <Text style={styles.helpText}>
          View your weekly performance and insights
        </Text>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            navigation.navigate('WeeklySummary' as never);
          }}
        >
          <Text style={styles.primaryButtonText}>View This Week's Report</Text>
        </TouchableOpacity>
      </View>

      {/* Schedule Section */}
      <TouchableOpacity
        style={styles.sectionHeader}
        onPress={() => toggleSection('schedule')}
      >
        <Text style={styles.sectionTitle}>⏰ Daily Schedule</Text>
        <Text style={styles.expandIcon}>{expandedSections.schedule ? '▼' : '▶'}</Text>
      </TouchableOpacity>
      
      {expandedSections.schedule && (
        <View style={styles.section}>
          <View style={styles.row}>
            <Text style={styles.label}>Wake Time</Text>
            <ClockTimeField
              value={editedProfile.wakeClockTime || parseClockTime(editedProfile.wakeTime)}
              onChange={(value) => handleClockFieldUpdate('wakeTime', 'wakeClockTime', value)}
              placeholder="7:00 AM"
            />
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Sleep Time</Text>
            <ClockTimeField
              value={editedProfile.sleepClockTime || parseClockTime(editedProfile.sleepTime)}
              onChange={(value) => handleClockFieldUpdate('sleepTime', 'sleepClockTime', value)}
              placeholder="11:00 PM"
            />
          </View>

          <View style={styles.row}>
            <View style={styles.inlineLabelContainer}>
              <Text style={[styles.label, styles.inlineLabelText]}>Fasting Hours</Text>
              <TouchableOpacity
                onPress={() => (navigation as any).navigate('HelpCenter', { initialTab: 'glossary', term: 'fasting' })}
                style={{ marginLeft: 6 }}
              >
                <Text style={{ color: '#22D3EE', fontWeight: '700' }}>?</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.input, styles.numericInput]}
              value={editedProfile.preferredFastingHours.toString()}
              onChangeText={(text) => handleUpdate('preferredFastingHours', parseInt(text) || 0)}
              keyboardType="number-pad"
              placeholder="16"
              placeholderTextColor="#666"
            />
          </View>
        </View>
      )}

      {/* Work Schedule Section */}
      <TouchableOpacity
        style={styles.sectionHeader}
        onPress={() => toggleSection('work')}
      >
        <Text style={styles.sectionTitle}>💼 Work Schedule</Text>
        <Text style={styles.expandIcon}>{expandedSections.work ? '▼' : '▶'}</Text>
      </TouchableOpacity>
      
      {expandedSections.work && (
        <View style={styles.section}>
          <View style={styles.row}>
            <Text style={styles.label}>Work Start</Text>
            <ClockTimeField
              value={editedProfile.workStartClockTime || parseClockTime(editedProfile.workStartTime)}
              onChange={(value) => handleClockFieldUpdate('workStartTime', 'workStartClockTime', value)}
              placeholder="9:00 AM"
            />
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Work End</Text>
            <ClockTimeField
              value={editedProfile.workEndClockTime || parseClockTime(editedProfile.workEndTime)}
              onChange={(value) => handleClockFieldUpdate('workEndTime', 'workEndClockTime', value)}
              placeholder="5:00 PM"
            />
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Commute (min)</Text>
            <TextInput
              style={styles.input}
              value={editedProfile.commuteDuration?.toString() || ''}
              onChangeText={(text) => handleUpdate('commuteDuration', text ? parseInt(text) : undefined)}
              keyboardType="number-pad"
              placeholder="30"
              placeholderTextColor="#666"
            />
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Lunch Time</Text>
            <ClockTimeField
              value={editedProfile.lunchClockTime || parseClockTime(editedProfile.lunchTime)}
              onChange={(value) => handleClockFieldUpdate('lunchTime', 'lunchClockTime', value)}
              placeholder="12:30 PM"
            />
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Lunch Duration (min)</Text>
            <TextInput
              style={styles.input}
              value={(editedProfile.lunchDurationMin || 30).toString()}
              onChangeText={(text) => handleUpdate('lunchDurationMin', text ? parseInt(text) : 30)}
              keyboardType="number-pad"
              placeholder="30"
              placeholderTextColor="#666"
            />
          </View>
        </View>
      )}

      {/* Rhythm Learning Section */}
      <TouchableOpacity
        style={styles.sectionHeader}
        onPress={() => toggleSection('rhythm')}
      >
        <Text style={styles.sectionTitle}>🧠 System Learned</Text>
        <Text style={styles.expandIcon}>{expandedSections.rhythm ? '▼' : '▶'}</Text>
      </TouchableOpacity>

      {expandedSections.rhythm && (
        <View style={styles.section}>
          <View style={styles.row}>
            <Text style={styles.label}>Use Learned Rhythm</Text>
            <Switch
              value={useLearnedRhythm}
              onValueChange={(value) => handleUpdate('useLearnedRhythm', value)}
              trackColor={{ false: '#444', true: '#22D3EE' }}
              thumbColor="#fff"
            />
          </View>

          <Text style={styles.helpText}>
            Confidence: {confidenceLabel} • Days observed: {rhythmProfile?.daysObserved || 0}
          </Text>
          <Text style={styles.helpText}>Adherence: {Math.round((rhythmProfile?.adherenceScore || 0) * 100)}%</Text>

          <Text style={[styles.label, { marginTop: 8, marginBottom: 6 }]}>Learned Medians</Text>
          <Text style={styles.helpText}>Wake: {rhythmProfile?.rollingMedians.wake || '--:--'}</Text>
          <Text style={styles.helpText}>Sleep: {rhythmProfile?.rollingMedians.sleep || '--:--'}</Text>
          <Text style={styles.helpText}>First Meal: {rhythmProfile?.rollingMedians.firstMeal || '--:--'}</Text>
          <Text style={styles.helpText}>Lunch: {rhythmProfile?.rollingMedians.lunch || '--:--'}</Text>
          <Text style={styles.helpText}>Last Meal: {rhythmProfile?.rollingMedians.lastMeal || '--:--'}</Text>

          <Text style={[styles.label, { marginTop: 8, marginBottom: 6 }]}>Common Anchor Bins</Text>
          <Text style={styles.helpText}>Walk: {rhythmProfile?.commonBins.walk?.join(', ') || '--'}</Text>
          <Text style={styles.helpText}>Workout: {rhythmProfile?.commonBins.workout?.join(', ') || '--'}</Text>
          <Text style={styles.helpText}>
            Disruption windows: {rhythmProfile?.disruptionWindows?.length ? rhythmProfile.disruptionWindows.map((hour) => `${hour}:00`).join(', ') : '--'}
          </Text>
        </View>
      )}

      {/* Physiology Section */}
      <TouchableOpacity
        style={styles.sectionHeader}
        onPress={() => toggleSection('physiology')}
      >
        <Text style={styles.sectionTitle}>🧬 Physiology</Text>
        <Text style={styles.expandIcon}>{expandedSections.physiology ? '▼' : '▶'}</Text>
      </TouchableOpacity>
      
      {expandedSections.physiology && (
        <View style={styles.section}>
          <View style={styles.row}>
            <Text style={styles.label}>Caffeine Sensitive</Text>
            <Switch
              value={editedProfile.caffeineToleranceLow}
              onValueChange={(value) => handleUpdate('caffeineToleranceLow', value)}
              trackColor={{ false: '#444', true: '#22D3EE' }}
              thumbColor="#fff"
            />
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Stress Baseline (1-10)</Text>
            <TextInput
              style={styles.input}
              value={editedProfile.stressBaseline.toString()}
              onChangeText={(text) => {
                const val = parseInt(text) || 1;
                handleUpdate('stressBaseline', Math.max(1, Math.min(10, val)));
              }}
              keyboardType="number-pad"
              placeholder="5"
              placeholderTextColor="#666"
            />
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Resting HR (bpm)</Text>
            <TextInput
              style={styles.input}
              value={editedProfile.restingHR?.toString() || ''}
              onChangeText={(text) => handleUpdate('restingHR', text ? parseInt(text) : undefined)}
              keyboardType="number-pad"
              placeholder="60"
              placeholderTextColor="#666"
            />
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Max HR (bpm)</Text>
            <TextInput
              style={styles.input}
              value={editedProfile.maxHR?.toString() || ''}
              onChangeText={(text) => handleUpdate('maxHR', text ? parseInt(text) : undefined)}
              keyboardType="number-pad"
              placeholder="185"
              placeholderTextColor="#666"
            />
          </View>
        </View>
      )}

      {/* Preferences Section */}
      <TouchableOpacity
        style={styles.sectionHeader}
        onPress={() => toggleSection('preferences')}
      >
        <Text style={styles.sectionTitle}>🎯 Preferences</Text>
        <Text style={styles.expandIcon}>{expandedSections.preferences ? '▼' : '▶'}</Text>
      </TouchableOpacity>
      
      {expandedSections.preferences && (
        <View style={styles.section}>
          <Text style={styles.label}>Default Day Mode</Text>
          <View style={styles.chipContainer}>
            {dayModes.map((mode) => (
              <TouchableOpacity
                key={mode}
                style={[
                  styles.chip,
                  editedProfile.defaultDayMode === mode && styles.chipSelected,
                ]}
                onPress={() => handleUpdate('defaultDayMode', mode)}
              >
                <Text
                  style={[
                    styles.chipText,
                    editedProfile.defaultDayMode === mode && styles.chipTextSelected,
                  ]}
                >
                  {mode}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.label, { marginTop: 16 }]}>Meal Sequence</Text>
          <View style={styles.chipContainer}>
            {mealPreferences.map((pref) => (
              <TouchableOpacity
                key={pref}
                style={[
                  styles.chip,
                  editedProfile.mealSequencePreference === pref && styles.chipSelected,
                ]}
                onPress={() => handleUpdate('mealSequencePreference', pref)}
              >
                <Text
                  style={[
                    styles.chipText,
                    editedProfile.mealSequencePreference === pref && styles.chipTextSelected,
                  ]}
                >
                  {pref}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.label, { marginTop: 16 }]}>Diet Foundation</Text>
          <Text style={styles.helpText}>
            Influences meal structure suggestions (not nutrition tracking)
          </Text>
          <View style={styles.chipContainer}>
            {dietFoundations.map((foundation) => (
              <TouchableOpacity
                key={foundation}
                style={[
                  styles.chip,
                  editedProfile.dietFoundation === foundation && styles.chipSelected,
                ]}
                onPress={() => handleUpdate('dietFoundation', foundation)}
              >
                <Text
                  style={[
                    styles.chipText,
                    editedProfile.dietFoundation === foundation && styles.chipTextSelected,
                  ]}
                >
                  {foundation}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.label, { marginTop: 16 }]}>Fitness Goal</Text>
          <Text style={styles.helpText}>
            Influences workout timing, meal spacing, and activity types in your daily plan
          </Text>
          <View style={styles.chipContainer}>
            {fitnessGoals.map((goal) => (
              <TouchableOpacity
                key={goal}
                style={[
                  styles.chip,
                  editedProfile.fitnessGoal === goal && styles.chipSelected,
                ]}
                onPress={() => handleUpdate('fitnessGoal', goal)}
              >
                <Text
                  style={[
                    styles.chipText,
                    editedProfile.fitnessGoal === goal && styles.chipTextSelected,
                  ]}
                >
                  {goal.replace('_', ' ')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={[styles.row, { marginTop: 16 }]}>
            <Text style={styles.label}>Allow Comfort Window</Text>
            <Switch
              value={editedProfile.allowComfortWindow}
              onValueChange={(value) => handleUpdate('allowComfortWindow', value)}
              trackColor={{ false: '#333', true: '#22D3EE' }}
              thumbColor={editedProfile.allowComfortWindow ? '#fff' : '#ccc'}
            />
          </View>
        </View>
      )}

      {/* Data Management Section */}
      <TouchableOpacity
        style={styles.sectionHeader}
        onPress={() => toggleSection('data')}
      >
        <Text style={styles.sectionTitle}>🗄️ Data Management</Text>
        <Text style={styles.expandIcon}>{expandedSections.data ? '▼' : '▶'}</Text>
      </TouchableOpacity>
      
      {expandedSections.data && (
        <View style={styles.section}>
          <TouchableOpacity style={styles.dangerButton} onPress={handleClearTodayData}>
            <Text style={styles.dangerButtonText}>Clear Today's Data</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.dangerButton} onPress={handleReset}>
            <Text style={styles.dangerButtonText}>Reset Profile</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Save Button */}
      {hasChanges && (
        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>Save Changes</Text>
        </TouchableOpacity>
      )}

      {/* App Info */}
      <View style={[styles.section, { marginBottom: 40 }]}>
        <Text style={styles.sectionTitle}>About</Text>
        <Text style={styles.infoText}>AlignOS</Text>
        <Text style={styles.infoText}>Version 1.0.0</Text>
        <Text style={styles.infoSubtext}>Metabolic rhythm optimization</Text>
        <TouchableOpacity
          style={[styles.primaryButton, { marginTop: 12 }]}
          onPress={() => (navigation as any).navigate('HelpCenter')}
        >
          <Text style={styles.primaryButtonText}>Open Help & Glossary</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.primaryButton, { marginTop: 8 }]}
          onPress={() => (navigation as any).navigate('LearnAlignOSTour')}
        >
          <Text style={styles.primaryButtonText}>Learn AlignOS</Text>
        </TouchableOpacity>
      </View>
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
    paddingBottom: 60,
  },
  header: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#888',
    marginBottom: 32,
  },
  emptyText: {
    color: '#888',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 12,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#333',
  },
  section: {
    backgroundColor: '#111',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#222',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#22D3EE',
    flex: 1,
  },
  expandIcon: {
    color: '#666',
    fontSize: 14,
    fontWeight: 'bold',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  inlineLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  inlineLabelText: {
    flex: 0,
    flexShrink: 1,
  },
  label: {
    fontSize: 16,
    color: '#fff',
    flex: 1,
    fontWeight: '500',
  },
  sublabel: {
    fontSize: 15,
    color: '#ccc',
    flex: 1,
  },
  helpText: {
    fontSize: 13,
    color: '#888',
    marginBottom: 12,
    lineHeight: 18,
  },
  input: {
    backgroundColor: '#1a1a1a',
    color: '#fff',
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
    minWidth: 100,
    textAlign: 'right',
    borderWidth: 1,
    borderColor: '#333',
  },
  numericInput: {
    width: 88,
    minWidth: 88,
    flexShrink: 0,
  },
  smallInput: {
    backgroundColor: '#1a1a1a',
    color: '#fff',
    padding: 10,
    borderRadius: 8,
    fontSize: 16,
    width: 70,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
  },
  chipSelected: {
    backgroundColor: '#22D3EE',
    borderColor: '#22D3EE',
  },
  chipText: {
    color: '#888',
    fontSize: 14,
    fontWeight: '500',
  },
  chipTextSelected: {
    color: '#000',
    fontWeight: '700',
  },
  primaryButton: {
    backgroundColor: '#22D3EE',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0,
    shadowRadius: 8,
    elevation: 2,
  },
  primaryButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  saveButton: {
    backgroundColor: '#22D3EE',
    padding: 18,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#22D3EE',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
  },
  saveButtonText: {
    color: '#000',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  button: {
    backgroundColor: '#22D3EE',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  dangerButton: {
    backgroundColor: '#1a1a1a',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#d32f2f',
  },
  dangerButtonText: {
    color: '#ff5252',
    fontSize: 16,
    fontWeight: '600',
  },
  habitPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  habitIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  habitName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },
  moreText: {
    color: '#22D3EE',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    fontWeight: '600',
  },
  infoText: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 4,
  },
  infoSubtext: {
    color: '#888',
    fontSize: 14,
    marginTop: 8,
  },
});
