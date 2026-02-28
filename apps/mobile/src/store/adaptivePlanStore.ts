/**
 * Adaptive Plan Store
 * Real-time plan adjustments based on actual completion times
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { differenceInMinutes, addMinutes, parseISO } from 'date-fns';
import type { ScheduleItem } from '@physiology-engine/shared';

interface CompletionRecord {
  itemId: string;
  scheduledTime: Date;
  actualTime: Date;
  delayMinutes: number;
  itemType: string;
}

interface AdaptiveState {
  completedToday: CompletionRecord[];
  averageDelay: number;
  isRunningBehind: boolean;
  minutesBehind: number;
  adaptiveMode: boolean;
  
  // Historical learning data
  historicalDelays: { [itemType: string]: number[] };
  
  // Actions
  initialize: () => Promise<void>;
  markItemCompleted: (item: ScheduleItem, actualTime: Date) => Promise<void>;
  getAdjustedSchedule: (remainingItems: ScheduleItem[]) => ScheduleItem[];
  getPredictedDelay: (itemType: string) => number;
  toggleAdaptiveMode: () => void;
  clearToday: () => void;
}

const STORAGE_KEY = '@adaptive_plan';
const HISTORY_KEY = '@adaptive_history';

export const useAdaptivePlanStore = create<AdaptiveState>((set, get) => ({
  completedToday: [],
  averageDelay: 0,
  isRunningBehind: false,
  minutesBehind: 0,
  adaptiveMode: true,
  historicalDelays: {},

  initialize: async () => {
    try {
      const [todayData, historyData] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEY),
        AsyncStorage.getItem(HISTORY_KEY),
      ]);

      if (todayData) {
        const parsed = JSON.parse(todayData);
        set({
          completedToday: parsed.completedToday.map((r: any) => ({
            ...r,
            scheduledTime: new Date(r.scheduledTime),
            actualTime: new Date(r.actualTime),
          })),
          averageDelay: parsed.averageDelay,
          isRunningBehind: parsed.isRunningBehind,
          minutesBehind: parsed.minutesBehind,
          adaptiveMode: parsed.adaptiveMode ?? true,
        });
      }

      if (historyData) {
        set({ historicalDelays: JSON.parse(historyData) });
      }
    } catch (error) {
      console.error('[AdaptivePlan] Failed to initialize:', error);
    }
  },

  markItemCompleted: async (item: ScheduleItem, actualTime: Date) => {
    const state = get();
    const scheduledTime = parseISO(item.startISO);
    const delayMinutes = differenceInMinutes(actualTime, scheduledTime);

    const record: CompletionRecord = {
      itemId: item.id,
      scheduledTime,
      actualTime,
      delayMinutes,
      itemType: item.type,
    };

    const completedToday = [...state.completedToday, record];

    // Calculate running stats
    const totalDelay = completedToday.reduce((sum, r) => sum + r.delayMinutes, 0);
    const averageDelay = totalDelay / completedToday.length;
    const minutesBehind = Math.max(0, averageDelay);
    const isRunningBehind = averageDelay > 5; // More than 5 minutes behind on average

    // Update historical learning data
    const historicalDelays = { ...state.historicalDelays };
    if (!historicalDelays[item.type]) {
      historicalDelays[item.type] = [];
    }
    historicalDelays[item.type].push(delayMinutes);
    
    // Keep last 30 records per type
    if (historicalDelays[item.type].length > 30) {
      historicalDelays[item.type].shift();
    }

    set({
      completedToday,
      averageDelay,
      isRunningBehind,
      minutesBehind,
      historicalDelays,
    });

    // Save to storage
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({
        completedToday,
        averageDelay,
        isRunningBehind,
        minutesBehind,
        adaptiveMode: state.adaptiveMode,
      }));
      await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(historicalDelays));
    } catch (error) {
      console.error('[AdaptivePlan] Failed to save:', error);
    }
  },

  getAdjustedSchedule: (remainingItems: ScheduleItem[]) => {
    const state = get();
    
    if (!state.adaptiveMode || !state.isRunningBehind) {
      return remainingItems;
    }

    // Shift all remaining non-fixed items forward by the delay amount
    const shiftMinutes = Math.round(state.minutesBehind);
    
    return remainingItems.map(item => {
      if (item.fixed) {
        return item; // Don't adjust fixed items (like work meetings)
      }

      const adjustedStart = addMinutes(parseISO(item.startISO), shiftMinutes);
      const adjustedEnd = addMinutes(parseISO(item.endISO), shiftMinutes);

      return {
        ...item,
        startISO: adjustedStart.toISOString(),
        endISO: adjustedEnd.toISOString(),
        notes: item.notes 
          ? `${item.notes} (Auto-adjusted +${shiftMinutes}min)`
          : `Auto-adjusted +${shiftMinutes}min due to delays`,
      };
    });
  },

  getPredictedDelay: (itemType: string) => {
    const state = get();
    const delays = state.historicalDelays[itemType];
    
    if (!delays || delays.length === 0) {
      return 0;
    }

    // Calculate weighted average (more recent = higher weight)
    const weights = delays.map((_, i) => i + 1);
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    const weightedSum = delays.reduce((sum, delay, i) => sum + delay * weights[i], 0);
    
    return Math.round(weightedSum / totalWeight);
  },

  toggleAdaptiveMode: () => {
    const state = get();
    const newMode = !state.adaptiveMode;
    set({ adaptiveMode: newMode });
    
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({
      ...state,
      adaptiveMode: newMode,
    })).catch(error => console.error('[AdaptivePlan] Failed to save mode:', error));
  },

  clearToday: () => {
    set({
      completedToday: [],
      averageDelay: 0,
      isRunningBehind: false,
      minutesBehind: 0,
    });
    
    AsyncStorage.removeItem(STORAGE_KEY)
      .catch(error => console.error('[AdaptivePlan] Failed to clear:', error));
  },
}));
