/**
 * Achievements & Streak Tracking Store
 * Tracks user progress, streaks, and unlockable achievements
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { format } from 'date-fns';

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlockedAt: Date | null;
  requirement: number;
  currentProgress: number;
}

export interface DayCompletion {
  date: string; // yyyy-MM-dd
  totalActivities: number;
  completedActivities: number;
  completionRate: number;
}

interface AchievementState {
  // Streaks
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string | null;

  // Daily completions
  completionHistory: DayCompletion[];
  todayCompleted: Record<string, boolean>;

  // Achievements
  achievements: Achievement[];

  // Stats
  totalDaysActive: number;
  totalActivitiesCompleted: number;
  perfectDays: number; // Days with 100% completion

  // Actions
  initialize: () => Promise<void>;
  markActivityComplete: (activityId: string) => Promise<void>;
  markActivityIncomplete: (activityId: string) => void;
  updateDailyProgress: (total: number, completed: number) => Promise<void>;
  checkAndUpdateStreak: () => Promise<void>;
  unlockAchievement: (achievementId: string) => void;
}

const STORAGE_KEY = '@achievements_state';

const initialAchievements: Achievement[] = [
  {
    id: 'first_plan',
    title: 'Getting Started',
    description: 'Generate your first day plan',
    icon: '🌟',
    unlockedAt: null,
    requirement: 1,
    currentProgress: 0,
  },
  {
    id: 'week_streak',
    title: 'Week Stability',
    description: 'Maintain a 7-day streak',
    icon: 'fire',
    unlockedAt: null,
    requirement: 7,
    currentProgress: 0,
  },
  {
    id: 'month_streak',
    title: 'Monthly Consistency',
    description: 'Maintain a 30-day streak',
    icon: 'trending-up',
    unlockedAt: null,
    requirement: 30,
    currentProgress: 0,
  },
  {
    id: 'perfect_week',
    title: 'Execution Reliability',
    description: 'Complete 7 perfect days in a row',
    icon: 'check',
    unlockedAt: null,
    requirement: 7,
    currentProgress: 0,
  },
  {
    id: 'hundred_activities',
    title: 'Volume Milestone',
    description: 'Complete 100 activities',
    icon: 'target',
    unlockedAt: null,
    requirement: 100,
    currentProgress: 0,
  },
  {
    id: 'early_bird',
    title: 'Early Bird',
    description: 'Wake at your planned time for 7 days',
    icon: '🌅',
    unlockedAt: null,
    requirement: 7,
    currentProgress: 0,
  },
  {
    id: 'fitness_focused',
    title: 'Fitness Focused',
    description: 'Complete 30 workouts',
    icon: '🏋️',
    unlockedAt: null,
    requirement: 30,
    currentProgress: 0,
  },
  {
    id: 'walk_master',
    title: 'Movement Protocol',
    description: 'Complete 50 walks',
    icon: 'walk',
    unlockedAt: null,
    requirement: 50,
    currentProgress: 0,
  },
];

export const useAchievementStore = create<AchievementState>((set, get) => ({
  currentStreak: 0,
  longestStreak: 0,
  lastActiveDate: null,
  completionHistory: [],
  todayCompleted: {},
  achievements: initialAchievements,
  totalDaysActive: 0,
  totalActivitiesCompleted: 0,
  perfectDays: 0,

  initialize: async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        set({
          currentStreak: data.currentStreak || 0,
          longestStreak: data.longestStreak || 0,
          lastActiveDate: data.lastActiveDate || null,
          completionHistory: data.completionHistory || [],
          achievements: data.achievements || initialAchievements,
          totalDaysActive: data.totalDaysActive || 0,
          totalActivitiesCompleted: data.totalActivitiesCompleted || 0,
          perfectDays: data.perfectDays || 0,
        });
      }
      
      // Check streak on initialization
      await get().checkAndUpdateStreak();
    } catch (error) {
      console.error('[AchievementStore] Failed to initialize:', error);
    }
  },

  markActivityComplete: async (activityId: string) => {
    const state = get();
    const newCompleted = { ...state.todayCompleted, [activityId]: true };
    const totalCompleted = state.totalActivitiesCompleted + 1;

    set({ 
      todayCompleted: newCompleted,
      totalActivitiesCompleted: totalCompleted,
    });

    // Check achievements
    if (totalCompleted === 100) {
      get().unlockAchievement('hundred_activities');
    }

    await saveState(get());
  },

  markActivityIncomplete: (activityId: string) => {
    const state = get();
    const newCompleted = { ...state.todayCompleted };
    delete newCompleted[activityId];
    set({ todayCompleted: newCompleted });
  },

  updateDailyProgress: async (total: number, completed: number) => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const state = get();
    
    const completionRate = total > 0 ? (completed / total) * 100 : 0;
    
    // Update or add today's completion
    const existingIndex = state.completionHistory.findIndex(d => d.date === today);
    const newHistory = [...state.completionHistory];
    
    const dayCompletion: DayCompletion = {
      date: today,
      totalActivities: total,
      completedActivities: completed,
      completionRate,
    };

    if (existingIndex >= 0) {
      newHistory[existingIndex] = dayCompletion;
    } else {
      newHistory.push(dayCompletion);
    }

    // Check for perfect day
    let perfectDays = state.perfectDays;
    if (completionRate === 100 && completed > 0) {
      perfectDays += 1;
      
      // Check perfect week achievement
      const lastSevenDays = newHistory.slice(-7);
      const allPerfect = lastSevenDays.length === 7 && 
                        lastSevenDays.every(d => d.completionRate === 100);
      if (allPerfect) {
        get().unlockAchievement('perfect_week');
      }
    }

    set({ 
      completionHistory: newHistory,
      perfectDays,
    });

    await saveState(get());
  },

  checkAndUpdateStreak: async () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const state = get();
    
    if (!state.lastActiveDate) {
      // First time
      set({ 
        currentStreak: 1,
        longestStreak: 1,
        lastActiveDate: today,
        totalDaysActive: 1,
      });
      get().unlockAchievement('first_plan');
    } else if (state.lastActiveDate !== today) {
      // Check if yesterday
      const yesterday = format(new Date(Date.now() - 86400000), 'yyyy-MM-dd');
      
      if (state.lastActiveDate === yesterday) {
        // Continue streak
        const newStreak = state.currentStreak + 1;
        const newLongest = Math.max(newStreak, state.longestStreak);
        
        set({ 
          currentStreak: newStreak,
          longestStreak: newLongest,
          lastActiveDate: today,
          totalDaysActive: state.totalDaysActive + 1,
        });

        // Check streak achievements
        if (newStreak === 7) {
          get().unlockAchievement('week_streak');
        }
        if (newStreak === 30) {
          get().unlockAchievement('month_streak');
        }
      } else {
        // Streak broken
        set({ 
          currentStreak: 1,
          lastActiveDate: today,
          totalDaysActive: state.totalDaysActive + 1,
        });
      }
    }

    await saveState(get());
  },

  unlockAchievement: (achievementId: string) => {
    const state = get();
    const achievements = state.achievements.map(a => {
      if (a.id === achievementId && !a.unlockedAt) {
        return { ...a, unlockedAt: new Date(), currentProgress: a.requirement };
      }
      return a;
    });
    
    set({ achievements });
    saveState(get());
  },
}));

async function saveState(state: AchievementState) {
  try {
    const toSave = {
      currentStreak: state.currentStreak,
      longestStreak: state.longestStreak,
      lastActiveDate: state.lastActiveDate,
      completionHistory: state.completionHistory,
      achievements: state.achievements,
      totalDaysActive: state.totalDaysActive,
      totalActivitiesCompleted: state.totalActivitiesCompleted,
      perfectDays: state.perfectDays,
    };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch (error) {
    console.error('[AchievementStore] Failed to save:', error);
  }
}
