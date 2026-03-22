import AsyncStorage from '@react-native-async-storage/async-storage';
import { format } from 'date-fns';

const MAX_CUSTOM_QUESTIONS_PER_DAY = 5;
const STORAGE_KEY_PREFIX = 'advisor_custom_count_';

/**
 * Get the storage key for today
 */
function getTodayKey(): string {
  const today = format(new Date(), 'yyyy-MM-dd');
  return `${STORAGE_KEY_PREFIX}${today}`;
}

/**
 * Get the number of custom (LLM) questions remaining today
 * @returns Number between 0 and 5
 */
export async function getRemainingCustomQuestions(): Promise<number> {
  try {
    const key = getTodayKey();
    const value = await AsyncStorage.getItem(key);
    
    if (!value) {
      return MAX_CUSTOM_QUESTIONS_PER_DAY;
    }
    
    const used = parseInt(value, 10);
    if (isNaN(used)) {
      return MAX_CUSTOM_QUESTIONS_PER_DAY;
    }
    
    const remaining = MAX_CUSTOM_QUESTIONS_PER_DAY - used;
    return Math.max(0, remaining);
  } catch (error) {
    console.error('Failed to get remaining custom questions:', error);
    return MAX_CUSTOM_QUESTIONS_PER_DAY; // Fail open
  }
}

/**
 * Increment the count of custom questions used today
 * Should be called after successfully calling the LLM
 */
export async function incrementCustomUsed(): Promise<void> {
  try {
    const key = getTodayKey();
    const value = await AsyncStorage.getItem(key);
    
    const current = value ? parseInt(value, 10) : 0;
    const newCount = Math.min(MAX_CUSTOM_QUESTIONS_PER_DAY, current + 1);
    
    await AsyncStorage.setItem(key, String(newCount));
  } catch (error) {
    console.error('Failed to increment custom questions count:', error);
  }
}

/**
 * Check if the user has remaining custom questions
 * @returns true if user can ask a custom question, false if limit reached
 */
export async function canAskCustomQuestion(): Promise<boolean> {
  const remaining = await getRemainingCustomQuestions();
  return remaining > 0;
}

/**
 * Reset the daily limit (useful for testing or manual reset)
 * WARNING: This will erase the count for today
 */
export async function resetDailyLimit(): Promise<void> {
  try {
    const key = getTodayKey();
    await AsyncStorage.removeItem(key);
  } catch (error) {
    console.error('Failed to reset daily limit:', error);
  }
}

/**
 * Clean up old daily limit keys (older than 7 days)
 * Should be called periodically to avoid storage bloat
 */
export async function cleanupOldLimits(): Promise<void> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const limitKeys = allKeys.filter(key => key.startsWith(STORAGE_KEY_PREFIX));
    
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const keysToRemove: string[] = [];
    
    for (const key of limitKeys) {
      const dateStr = key.replace(STORAGE_KEY_PREFIX, '');
      try {
        const keyDate = new Date(dateStr);
        if (keyDate < sevenDaysAgo) {
          keysToRemove.push(key);
        }
      } catch {
        // Invalid date format, remove it
        keysToRemove.push(key);
      }
    }
    
    if (keysToRemove.length > 0) {
      await AsyncStorage.multiRemove(keysToRemove);
      console.log(`Cleaned up ${keysToRemove.length} old daily limit keys`);
    }
  } catch (error) {
    console.error('Failed to cleanup old limits:', error);
  }
}

/**
 * Get the current count of custom questions used today
 * Useful for displaying "X/5 used" in the UI
 */
export async function getCustomQuestionsUsedToday(): Promise<number> {
  try {
    const key = getTodayKey();
    const value = await AsyncStorage.getItem(key);
    
    if (!value) {
      return 0;
    }
    
    const used = parseInt(value, 10);
    return isNaN(used) ? 0 : Math.min(MAX_CUSTOM_QUESTIONS_PER_DAY, used);
  } catch (error) {
    console.error('Failed to get custom questions used:', error);
    return 0;
  }
}
