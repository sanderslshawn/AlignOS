import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Storage keys
const BIOMETRIC_DATA_KEY = '@biometric_data';
const BIOMETRIC_SETTINGS_KEY = '@biometric_settings';

// Biometric data types
export type BiometricSource = 'apple_health' | 'google_fit' | 'fitbit' | 'oura' | 'whoop' | 'manual';

export interface HeartRateData {
  timestamp: Date;
  value: number; // BPM
  source: BiometricSource;
  context?: 'resting' | 'active' | 'workout' | 'sleep';
}

export interface SleepData {
  date: Date;
  totalMinutes: number;
  deepMinutes: number;
  remMinutes: number;
  lightMinutes: number;
  awakeMinutes: number;
  sleepScore: number; // 0-100
  source: BiometricSource;
}

export interface HRVData {
  timestamp: Date;
  value: number; // RMSSD in milliseconds
  source: BiometricSource;
}

export interface ActivityData {
  date: Date;
  steps: number;
  caloriesBurned: number;
  activeMinutes: number;
  distance: number; // meters
  source: BiometricSource;
}

export interface BodyMetrics {
  date: Date;
  weight?: number; // kg
  bodyFat?: number; // percentage
  muscleMass?: number; // kg
  restingHeartRate?: number; // BPM
  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;
  source: BiometricSource;
}

export interface RecoveryScore {
  date: Date;
  score: number; // 0-100
  hrv: number;
  restingHeartRate: number;
  sleepScore: number;
  recommendation: 'rest' | 'light' | 'moderate' | 'intense';
  source: BiometricSource;
}

export interface BiometricSettings {
  enabledSources: BiometricSource[];
  syncInterval: number; // minutes
  autoSync: boolean;
  showRealTimeHR: boolean;
  trackRecovery: boolean;
  notifyLowRecovery: boolean;
}

interface BiometricState {
  // Data
  heartRateHistory: HeartRateData[];
  sleepHistory: SleepData[];
  hrvHistory: HRVData[];
  activityHistory: ActivityData[];
  bodyMetrics: BodyMetrics[];
  recoveryScores: RecoveryScore[];
  
  // Current readings
  currentHeartRate?: number;
  lastSyncTime?: Date;
  
  // Settings
  settings: BiometricSettings;
  
  // Actions - Data
  addHeartRateData: (data: HeartRateData) => void;
  addSleepData: (data: SleepData) => void;
  addHRVData: (data: HRVData) => void;
  addActivityData: (data: ActivityData) => void;
  addBodyMetrics: (data: BodyMetrics) => void;
  addRecoveryScore: (data: RecoveryScore) => void;
  
  // Actions - Real-time
  updateCurrentHeartRate: (hr: number) => void;
  startHeartRateMonitoring: () => void;
  stopHeartRateMonitoring: () => void;
  
  // Actions - Sync
  syncFromSource: (source: BiometricSource) => Promise<void>;
  syncAllSources: () => Promise<void>;
  
  // Actions - Settings
  updateSettings: (updates: Partial<BiometricSettings>) => void;
  
  // Actions - Analysis
  getLatestSleep: () => SleepData | undefined;
  getAverageHRV: (days: number) => number;
  getRecoveryTrend: (days: number) => 'improving' | 'stable' | 'declining';
  getTodayActivity: () => ActivityData | undefined;
  
  // Persistence
  loadFromStorage: () => Promise<void>;
  saveToStorage: () => Promise<void>;
}

export const useBiometricStore = create<BiometricState>((set, get) => ({
  // Initial state
  heartRateHistory: [],
  sleepHistory: [],
  hrvHistory: [],
  activityHistory: [],
  bodyMetrics: [],
  recoveryScores: [],
  currentHeartRate: undefined,
  lastSyncTime: undefined,
  settings: {
    enabledSources: ['manual'],
    syncInterval: 60,
    autoSync: false,
    showRealTimeHR: false,
    trackRecovery: true,
    notifyLowRecovery: true,
  },
  
  // Data actions
  addHeartRateData: (data) => {
    set((state) => ({
      heartRateHistory: [data, ...state.heartRateHistory].slice(0, 1000), // Keep last 1000
    }));
    get().saveToStorage();
  },
  
  addSleepData: (data) => {
    set((state) => ({
      sleepHistory: [data, ...state.sleepHistory].slice(0, 90), // Keep last 90 days
    }));
    get().saveToStorage();
  },
  
  addHRVData: (data) => {
    set((state) => ({
      hrvHistory: [data, ...state.hrvHistory].slice(0, 90), // Keep last 90 days
    }));
    get().saveToStorage();
  },
  
  addActivityData: (data) => {
    set((state) => ({
      activityHistory: [data, ...state.activityHistory].slice(0, 90), // Keep last 90 days
    }));
    get().saveToStorage();
  },
  
  addBodyMetrics: (data) => {
    set((state) => ({
      bodyMetrics: [data, ...state.bodyMetrics].slice(0, 365), // Keep last year
    }));
    get().saveToStorage();
  },
  
  addRecoveryScore: (data) => {
    set((state) => ({
      recoveryScores: [data, ...state.recoveryScores].slice(0, 30), // Keep last 30 days
    }));
    
    // Check if recovery is low and notifications are enabled
    if (data.score < 50 && get().settings.notifyLowRecovery) {
      console.log('⚠️ Low recovery detected:', data.score);
      // In real app, would trigger push notification
    }
    
    get().saveToStorage();
  },
  
  // Real-time actions
  updateCurrentHeartRate: (hr) => {
    set({ currentHeartRate: hr });
    
    // Add to history
    get().addHeartRateData({
      timestamp: new Date(),
      value: hr,
      source: 'manual', // Would be the actual source in real app
    });
  },
  
  startHeartRateMonitoring: () => {
    console.log('🫀 Starting heart rate monitoring...');
    // In real app, would connect to device sensors
    // For demo, simulate with random data
    const interval = setInterval(() => {
      const baseHR = 75;
      const variance = Math.random() * 20 - 10;
      get().updateCurrentHeartRate(Math.round(baseHR + variance));
    }, 5000);
    
    // Store interval ID for cleanup
    (get as any).hrMonitoringInterval = interval;
  },
  
  stopHeartRateMonitoring: () => {
    console.log('🫀 Stopping heart rate monitoring...');
    const interval = (get as any).hrMonitoringInterval;
    if (interval) {
      clearInterval(interval);
      set({ currentHeartRate: undefined });
    }
  },
  
  // Sync actions
  syncFromSource: async (source) => {
    console.log(`🔄 Syncing from ${source}...`);
    
    // In real app, would call actual API
    // For demo, simulate with mock data
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    set({ lastSyncTime: new Date() });
    get().saveToStorage();
  },
  
  syncAllSources: async () => {
    const { enabledSources } = get().settings;
    
    for (const source of enabledSources) {
      await get().syncFromSource(source);
    }
  },
  
  // Settings actions
  updateSettings: (updates) => {
    set((state) => ({
      settings: { ...state.settings, ...updates },
    }));
    get().saveToStorage();
  },
  
  // Analysis actions
  getLatestSleep: () => {
    const { sleepHistory } = get();
    return sleepHistory[0];
  },
  
  getAverageHRV: (days) => {
    const { hrvHistory } = get();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    const recentHRV = hrvHistory.filter(
      h => new Date(h.timestamp) >= cutoffDate
    );
    
    if (recentHRV.length === 0) return 0;
    
    const sum = recentHRV.reduce((acc, h) => acc + h.value, 0);
    return sum / recentHRV.length;
  },
  
  getRecoveryTrend: (days) => {
    const { recoveryScores } = get();
    
    if (recoveryScores.length < 2) return 'stable';
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    const recentScores = recoveryScores
      .filter(r => new Date(r.date) >= cutoffDate)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    if (recentScores.length < 2) return 'stable';
    
    const firstHalf = recentScores.slice(0, Math.floor(recentScores.length / 2));
    const secondHalf = recentScores.slice(Math.floor(recentScores.length / 2));
    
    const firstAvg = firstHalf.reduce((acc, r) => acc + r.score, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((acc, r) => acc + r.score, 0) / secondHalf.length;
    
    const difference = secondAvg - firstAvg;
    
    if (difference > 5) return 'improving';
    if (difference < -5) return 'declining';
    return 'stable';
  },
  
  getTodayActivity: () => {
    const { activityHistory } = get();
    const today = new Date().toDateString();
    
    return activityHistory.find(
      a => new Date(a.date).toDateString() === today
    );
  },
  
  // Persistence
  loadFromStorage: async () => {
    try {
      const [dataStr, settingsStr] = await Promise.all([
        AsyncStorage.getItem(BIOMETRIC_DATA_KEY),
        AsyncStorage.getItem(BIOMETRIC_SETTINGS_KEY),
      ]);
      
      if (dataStr) {
        const data = JSON.parse(dataStr);
        set({
          heartRateHistory: data.heartRateHistory || [],
          sleepHistory: data.sleepHistory || [],
          hrvHistory: data.hrvHistory || [],
          activityHistory: data.activityHistory || [],
          bodyMetrics: data.bodyMetrics || [],
          recoveryScores: data.recoveryScores || [],
        });
      }
      
      if (settingsStr) {
        const settings = JSON.parse(settingsStr);
        set({ settings });
      }
    } catch (error) {
      console.error('Failed to load biometric data:', error);
    }
  },
  
  saveToStorage: async () => {
    try {
      const state = get();
      
      const data = {
        heartRateHistory: state.heartRateHistory,
        sleepHistory: state.sleepHistory,
        hrvHistory: state.hrvHistory,
        activityHistory: state.activityHistory,
        bodyMetrics: state.bodyMetrics,
        recoveryScores: state.recoveryScores,
      };
      
      await Promise.all([
        AsyncStorage.setItem(BIOMETRIC_DATA_KEY, JSON.stringify(data)),
        AsyncStorage.setItem(BIOMETRIC_SETTINGS_KEY, JSON.stringify(state.settings)),
      ]);
    } catch (error) {
      console.error('Failed to save biometric data:', error);
    }
  },
}));

// Helper function to calculate recovery score from biometric data
export function calculateRecoveryScore(
  hrv: number,
  restingHR: number,
  sleepScore: number
): RecoveryScore {
  // Weighted formula: HRV (40%), RHR (30%), Sleep (30%)
  const hrvScore = Math.min((hrv / 100) * 100, 100); // Normalize HRV
  const rhrScore = Math.max(100 - ((restingHR - 50) * 2), 0); // Lower is better
  const finalScore = (hrvScore * 0.4) + (rhrScore * 0.3) + (sleepScore * 0.3);
  
  let recommendation: RecoveryScore['recommendation'];
  if (finalScore < 40) recommendation = 'rest';
  else if (finalScore < 60) recommendation = 'light';
  else if (finalScore < 80) recommendation = 'moderate';
  else recommendation = 'intense';
  
  return {
    date: new Date(),
    score: Math.round(finalScore),
    hrv,
    restingHeartRate: restingHR,
    sleepScore,
    recommendation,
    source: 'manual',
  };
}
