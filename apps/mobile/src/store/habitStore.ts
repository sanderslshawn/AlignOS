import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { format, differenceInDays, startOfDay, subDays, parseISO } from 'date-fns';

export interface Habit {
  id: string;
  name: string;
  description: string;
  category: 'nutrition' | 'exercise' | 'sleep' | 'hydration' | 'mindfulness' | 'custom';
  frequency: 'daily' | 'weekdays' | 'weekends' | 'custom'; // custom uses customDays
  customDays?: number[]; // 0=Sunday, 6=Saturday
  targetValue?: number; // Optional target (e.g., 8 glasses of water)
  unit?: string; // Optional unit (e.g., 'glasses', 'minutes')
  icon: string; // Emoji
  color: string; // Hex color
  reminder?: string; // HH:MM format for reminder time
  createdAt: string; // ISO date
}

export interface HabitCompletion {
  habitId: string;
  date: string; // YYYY-MM-DD
  completed: boolean;
  value?: number; // If habit has a target value
  timestamp: string; // ISO datetime when marked complete
}

export interface HabitStats {
  currentStreak: number;
  longestStreak: number;
  totalCompletions: number;
  completionRate: number; // Percentage
  lastCompletedDate?: string;
}

interface HabitState {
  habits: Habit[];
  completions: HabitCompletion[];
  
  addHabit: (habit: Omit<Habit, 'id' | 'createdAt'>) => void;
  editHabit: (id: string, updates: Partial<Habit>) => void;
  deleteHabit: (id: string) => void;
  
  markComplete: (habitId: string, date: string, value?: number) => void;
  markIncomplete: (habitId: string, date: string) => void;
  
  getHabitStats: (habitId: string) => HabitStats;
  getHabitsForDate: (date: string) => Habit[];
  
  saveToStorage: () => Promise<void>;
  loadFromStorage: () => Promise<void>;
}

export const useHabitStore = create<HabitState>((set, get) => ({
  habits: [],
  completions: [],
  
  addHabit: (habitData) => {
    const habit: Habit = {
      ...habitData,
      id: `habit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
    };
    
    set((state) => ({
      habits: [...state.habits, habit],
    }));
    
    get().saveToStorage();
  },
  
  editHabit: (id, updates) => {
    set((state) => ({
      habits: state.habits.map((h) => (h.id === id ? { ...h, ...updates } : h)),
    }));
    
    get().saveToStorage();
  },
  
  deleteHabit: (id) => {
    set((state) => ({
      habits: state.habits.filter((h) => h.id !== id),
      completions: state.completions.filter((c) => c.habitId !== id),
    }));
    
    get().saveToStorage();
  },
  
  markComplete: (habitId, date, value) => {
    const existing = get().completions.find(
      (c) => c.habitId === habitId && c.date === date
    );
    
    if (existing) {
      // Update existing
      set((state) => ({
        completions: state.completions.map((c) =>
          c.habitId === habitId && c.date === date
            ? { ...c, completed: true, value, timestamp: new Date().toISOString() }
            : c
        ),
      }));
    } else {
      // Create new
      const completion: HabitCompletion = {
        habitId,
        date,
        completed: true,
        value,
        timestamp: new Date().toISOString(),
      };
      
      set((state) => ({
        completions: [...state.completions, completion],
      }));
    }
    
    get().saveToStorage();
  },
  
  markIncomplete: (habitId, date) => {
    set((state) => ({
      completions: state.completions.filter(
        (c) => !(c.habitId === habitId && c.date === date)
      ),
    }));
    
    get().saveToStorage();
  },
  
  getHabitStats: (habitId) => {
    const { completions } = get();
    const habitCompletions = completions
      .filter((c) => c.habitId === habitId && c.completed)
      .sort((a, b) => a.date.localeCompare(b.date));
    
    if (habitCompletions.length === 0) {
      return {
        currentStreak: 0,
        longestStreak: 0,
        totalCompletions: 0,
        completionRate: 0,
      };
    }
    
    // Calculate current streak
    let currentStreak = 0;
    const today = format(new Date(), 'yyyy-MM-dd');
    let checkDate = today;
    
    while (true) {
      const hasCompletion = habitCompletions.some((c) => c.date === checkDate);
      if (!hasCompletion) break;
      currentStreak++;
      checkDate = format(subDays(parseISO(checkDate), 1), 'yyyy-MM-dd');
    }
    
    // Calculate longest streak
    let longestStreak = 0;
    let tempStreak = 1;
    
    for (let i = 1; i < habitCompletions.length; i++) {
      const prevDate = parseISO(habitCompletions[i - 1].date);
      const currDate = parseISO(habitCompletions[i].date);
      const daysDiff = differenceInDays(currDate, prevDate);
      
      if (daysDiff === 1) {
        tempStreak++;
      } else {
        longestStreak = Math.max(longestStreak, tempStreak);
        tempStreak = 1;
      }
    }
    longestStreak = Math.max(longestStreak, tempStreak);
    
    // Calculate completion rate (last 30 days)
    const thirtyDaysAgo = format(subDays(new Date(), 30), 'yyyy-MM-dd');
    const recentCompletions = habitCompletions.filter((c) => c.date >= thirtyDaysAgo);
    const completionRate = (recentCompletions.length / 30) * 100;
    
    return {
      currentStreak,
      longestStreak,
      totalCompletions: habitCompletions.length,
      completionRate: Math.round(completionRate),
      lastCompletedDate: habitCompletions[habitCompletions.length - 1]?.date,
    };
  },
  
  getHabitsForDate: (date) => {
    const { habits } = get();
    const dayOfWeek = parseISO(date).getDay(); // 0=Sunday, 6=Saturday
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    
    return habits.filter((habit) => {
      switch (habit.frequency) {
        case 'daily':
          return true;
        case 'weekdays':
          return !isWeekend;
        case 'weekends':
          return isWeekend;
        case 'custom':
          return habit.customDays?.includes(dayOfWeek) ?? false;
        default:
          return true;
      }
    });
  },
  
  saveToStorage: async () => {
    const { habits, completions } = get();
    await AsyncStorage.setItem('habits', JSON.stringify(habits));
    await AsyncStorage.setItem('habit_completions', JSON.stringify(completions));
  },
  
  loadFromStorage: async () => {
    try {
      const habitsData = await AsyncStorage.getItem('habits');
      const completionsData = await AsyncStorage.getItem('habit_completions');
      
      if (habitsData) {
        const habits = JSON.parse(habitsData);
        set({ habits });
      }
      
      if (completionsData) {
        const completions = JSON.parse(completionsData);
        set({ completions });
      }
    } catch (error) {
      console.error('Failed to load habits from storage:', error);
    }
  },
}));

// Predefined habit templates
export const HABIT_TEMPLATES: Omit<Habit, 'id' | 'createdAt'>[] = [
  {
    name: 'Morning Sunlight',
    description: 'Get 10-15 minutes of sunlight within 30 min of waking',
    category: 'mindfulness',
    frequency: 'daily',
    icon: '🌅',
    color: '#ffd60a',
    targetValue: 15,
    unit: 'minutes',
  },
  {
    name: 'Daily Protein Goal',
    description: 'Hit your daily protein target',
    category: 'nutrition',
    frequency: 'daily',
    icon: '🍗',
    color: '#22D3EE',
    targetValue: 150,
    unit: 'grams',
  },
  {
    name: 'Post-Meal Walk',
    description: 'Walk 10-15 min after largest meal',
    category: 'exercise',
    frequency: 'daily',
    icon: 'walk',
    color: '#00b4d8',
    targetValue: 15,
    unit: 'minutes',
  },
  {
    name: '8 Hours Sleep',
    description: 'Get 7-9 hours of quality sleep',
    category: 'sleep',
    frequency: 'daily',
    icon: '😴',
    color: '#9d4edd',
    targetValue: 8,
    unit: 'hours',
  },
  {
    name: 'Hydration Goal',
    description: 'Drink 8-10 glasses of water',
    category: 'hydration',
    frequency: 'daily',
    icon: '💧',
    color: '#06ffa5',
    targetValue: 8,
    unit: 'glasses',
  },
  {
    name: 'Workout Session',
    description: 'Complete planned workout',
    category: 'exercise',
    frequency: 'weekdays',
    icon: 'workout',
    color: '#ff6b6b',
    targetValue: 45,
    unit: 'minutes',
  },
  {
    name: 'Meditation',
    description: '10 minutes of mindfulness or meditation',
    category: 'mindfulness',
    frequency: 'daily',
    icon: '🧘',
    color: '#7209b7',
    targetValue: 10,
    unit: 'minutes',
  },
  {
    name: 'No Late Night Eating',
    description: 'Finish eating 3+ hours before bed',
    category: 'nutrition',
    frequency: 'daily',
    icon: '🚫',
    color: '#ff9500',
  },
  {
    name: 'Caffeine Cutoff',
    description: 'No caffeine after 2 PM',
    category: 'nutrition',
    frequency: 'daily',
    icon: '☕',
    color: '#845F3D',
  },
  {
    name: 'Stretching Routine',
    description: '10-15 minutes of stretching',
    category: 'exercise',
    frequency: 'daily',
    icon: '🤸',
    color: '#34c759',
    targetValue: 15,
    unit: 'minutes',
  },
];
