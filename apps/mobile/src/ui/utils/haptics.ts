// AlignOS Haptics Utilities

import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * Light tap feedback (for selections, toggles)
 */
export function hapticLight() {
  if (Platform.OS === 'ios') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
}

/**
 * Medium tap feedback (for button presses)
 */
export function hapticMedium() {
  if (Platform.OS === 'ios') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }
}

/**
 * Heavy tap feedback (for important actions)
 */
export function hapticHeavy() {
  if (Platform.OS === 'ios') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  }
}

/**
 * Success feedback
 */
export function hapticSuccess() {
  if (Platform.OS === 'ios') {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }
}

/**
 * Warning feedback
 */
export function hapticWarning() {
  if (Platform.OS === 'ios') {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  }
}

/**
 * Error feedback
 */
export function hapticError() {
  if (Platform.OS === 'ios') {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  }
}

/**
 * Selection change feedback
 */
export function hapticSelection() {
  if (Platform.OS === 'ios') {
    Haptics.selectionAsync();
  }
}
