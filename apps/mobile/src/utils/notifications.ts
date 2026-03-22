import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DayPlan, UserProfile } from '@physiology-engine/shared';

// Configure how notifications are handled when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export interface NotificationSettings {
  enabled: boolean;
  mealReminders: boolean;
  workoutReminders: boolean;
  walkReminders: boolean;
  hydrationReminders: boolean;
  energyAlerts: boolean;
  morningMotivation: boolean;
  eveningWindown: boolean;
  preMealMinutes: number;
  preWorkoutMinutes: number;
  quietHoursStart: string;
  quietHoursEnd: string;
  hasPermission: boolean;
}

export interface NotificationDebugInfo {
  count: number;
  hasPermission: boolean;
  identifiers: string[];
}

const DEFAULT_SETTINGS: NotificationSettings = {
  enabled: false,
  mealReminders: true,
  workoutReminders: true,
  walkReminders: true,
  hydrationReminders: true,
  energyAlerts: true,
  morningMotivation: true,
  eveningWindown: true,
  preMealMinutes: 15,
  preWorkoutMinutes: 30,
  quietHoursStart: '22:00',
  quietHoursEnd: '07:00',
  hasPermission: false,
};

const STORAGE_KEY = '@notification_settings';

async function scheduleAtTime(
  date: Date,
  content: Notifications.NotificationContentInput
): Promise<void> {
  const seconds = Math.floor((date.getTime() - Date.now()) / 1000);
  if (seconds <= 0) return;

  await Notifications.scheduleNotificationAsync({
    content,
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds,
      repeats: false,
    },
  });
}

/**
 * Request notification permissions from the user
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    return finalStatus === 'granted';
  } catch (error) {
    console.error('Error requesting notification permissions:', error);
    return false;
  }
}

/**
 * Load notification settings from storage
 */
export async function loadNotificationSettings(): Promise<NotificationSettings> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    const permission = await Notifications.getPermissionsAsync();
    const hasPermission = permission.status === 'granted';
    if (stored) {
      const merged = { ...DEFAULT_SETTINGS, ...JSON.parse(stored), hasPermission };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      return merged;
    }
    const defaults = { ...DEFAULT_SETTINGS, hasPermission };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(defaults));
    return defaults;
  } catch (error) {
    console.error('Error loading notification settings:', error);
    return DEFAULT_SETTINGS;
  }
}

/**
 * Save notification settings to storage
 */
export async function saveNotificationSettings(settings: NotificationSettings): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('Error saving notification settings:', error);
  }
}

/**
 * Check if a time is within quiet hours
 */
function isWithinQuietHours(time: Date, quietStart: string, quietEnd: string): boolean {
  const hour = time.getHours();
  const minute = time.getMinutes();
  const timeMinutes = hour * 60 + minute;
  
  const [startHour, startMin] = quietStart.split(':').map(Number);
  const [endHour, endMin] = quietEnd.split(':').map(Number);
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  
  if (startMinutes < endMinutes) {
    return timeMinutes >= startMinutes && timeMinutes < endMinutes;
  } else {
    // Quiet hours span midnight
    return timeMinutes >= startMinutes || timeMinutes < endMinutes;
  }
}

/**
 * Schedule notifications for a day plan
 */
export async function scheduleDayPlanNotifications(
  plan: DayPlan,
  profile: UserProfile,
  settings: NotificationSettings
): Promise<void> {
  try {
    // Cancel all existing notifications first
    await Notifications.cancelAllScheduledNotificationsAsync();

    const permission = await Notifications.getPermissionsAsync();
    const hasPermission = permission.status === 'granted';
    if (!settings.enabled || !hasPermission) {
      return;
    }

    // Morning Motivation
    if (settings.morningMotivation) {
      const wakeTime = new Date();
      const [wakeHour, wakeMin] = profile.wakeTime.split(':').map(Number);
      wakeTime.setHours(wakeHour, wakeMin + 5, 0, 0);

      if (!isWithinQuietHours(wakeTime, settings.quietHoursStart, settings.quietHoursEnd)) {
        await scheduleAtTime(wakeTime, {
          title: '🌅 Good Morning!',
          body: "Ready to optimize your day? Let's make it great!",
          sound: true,
        });
      }
    }

    // Meal Reminders
    if (settings.mealReminders) {
      for (const entry of plan.items) {
        if (entry.type === 'meal' && entry.startISO) {
          const mealTime = new Date(entry.startISO);
          mealTime.setMinutes(mealTime.getMinutes() - settings.preMealMinutes);

          if (!isWithinQuietHours(mealTime, settings.quietHoursStart, settings.quietHoursEnd)) {
            await scheduleAtTime(mealTime, {
              title: `${entry.title} Coming Up`,
              body: `Your ${entry.title.toLowerCase()} is in ${settings.preMealMinutes} minutes`,
              sound: true,
            });
          }
        }
      }
    }

    // Workout Reminders
    if (settings.workoutReminders) {
      for (const entry of plan.items) {
        if (entry.type === 'workout' && entry.startISO) {
          const workoutTime = new Date(entry.startISO);
          workoutTime.setMinutes(workoutTime.getMinutes() - settings.preWorkoutMinutes);

          if (!isWithinQuietHours(workoutTime, settings.quietHoursStart, settings.quietHoursEnd)) {
            await scheduleAtTime(workoutTime, {
              title: 'Workout Time Approaching',
              body: `Get ready! Your workout starts in ${settings.preWorkoutMinutes} minutes`,
              sound: true,
            });
          }
        }
      }
    }

    // Walk Reminders
    if (settings.walkReminders) {
      for (const entry of plan.items) {
        if (entry.type === 'walk' && entry.startISO) {
          const walkTime = new Date(entry.startISO);
          walkTime.setMinutes(walkTime.getMinutes() - 5);

          if (!isWithinQuietHours(walkTime, settings.quietHoursStart, settings.quietHoursEnd)) {
            await scheduleAtTime(walkTime, {
              title: 'Time for a Walk',
              body: entry.title,
              sound: true,
            });
          }
        }
      }
    }

    // Hydration Reminders (every 2 hours during waking hours)
    if (settings.hydrationReminders) {
      const [wakeHour, wakeMin] = profile.wakeTime.split(':').map(Number);
      const [sleepHour, sleepMin] = profile.sleepTime.split(':').map(Number);
      
      let currentHour = wakeHour + 2;
      while (currentHour < sleepHour) {
        const reminderTime = new Date();
        reminderTime.setHours(currentHour, 0, 0, 0);

        if (!isWithinQuietHours(reminderTime, settings.quietHoursStart, settings.quietHoursEnd)) {
          await scheduleAtTime(reminderTime, {
            title: '💧 Hydration Check',
            body: 'Time for some water! Stay hydrated for optimal performance.',
            sound: true,
          });
        }
        currentHour += 2;
      }
    }

    // Energy Alerts (afternoon dip warning)
    if (settings.energyAlerts) {
      const afternoonDipTime = new Date();
      afternoonDipTime.setHours(14, 0, 0, 0);

      if (!isWithinQuietHours(afternoonDipTime, settings.quietHoursStart, settings.quietHoursEnd)) {
        await scheduleAtTime(afternoonDipTime, {
          title: '⚡ Energy Dip Alert',
          body: 'Natural afternoon energy dip. Consider a short walk or light snack.',
          sound: true,
        });
      }
    }

    // Evening Wind-Down
    if (settings.eveningWindown) {
      const windDownTime = new Date();
      const [sleepHour, sleepMin] = profile.sleepTime.split(':').map(Number);
      windDownTime.setHours(sleepHour - 1, sleepMin, 0, 0);

      if (!isWithinQuietHours(windDownTime, settings.quietHoursStart, settings.quietHoursEnd)) {
        await scheduleAtTime(windDownTime, {
          title: '🌙 Time to Wind Down',
          body: 'Start your evening routine for optimal sleep quality.',
          sound: true,
        });
      }
    }

  } catch (error) {
    console.error('Error scheduling notifications:', error);
  }
}

/**
 * Cancel all scheduled notifications
 */
export async function cancelAllNotifications(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (error) {
    console.error('Error canceling notifications:', error);
  }
}

/**
 * Read scheduled notification diagnostics for quick in-app debugging.
 */
export async function getScheduledNotificationsDebugInfo(): Promise<NotificationDebugInfo> {
  try {
    const permission = await Notifications.getPermissionsAsync();
    const hasPermission = permission.status === 'granted';
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();

    return {
      count: scheduled.length,
      hasPermission,
      identifiers: scheduled.slice(0, 5).map((item) => item.identifier),
    };
  } catch (error) {
    console.error('Error loading notification debug info:', error);
    return {
      count: 0,
      hasPermission: false,
      identifiers: [],
    };
  }
}
