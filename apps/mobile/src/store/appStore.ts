import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { UserProfile, DayState, PlanOutput } from '@physiology-engine/shared';
import { generatePlan } from '@physiology-engine/engine';

interface AppState {
  userProfile: UserProfile | null;
  dayState: DayState | null;
  currentPlan: PlanOutput | null;
  isDemoMode: boolean;
  
  setUserProfile: (profile: UserProfile) => void;
  setDayState: (state: DayState) => void;
  setDemoMode: (enabled: boolean) => void;
  regeneratePlan: () => void;
  updateDayState: (updates: Partial<DayState>) => void;
  
  saveToStorage: () => Promise<void>;
  loadFromStorage: () => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  userProfile: null,
  dayState: null,
  currentPlan: null,
  isDemoMode: false,
  
  setUserProfile: (profile) => {
    set({ userProfile: profile });
    get().saveToStorage();
  },
  
  setDayState: (state) => {
    set({ dayState: state });
    get().regeneratePlan();
  },
  
  setDemoMode: (enabled) => {
    set({ isDemoMode: enabled });
  },
  
  regeneratePlan: () => {
    const { userProfile, dayState } = get();
    if (!userProfile || !dayState) {
      console.log('Cannot regenerate plan: missing profile or dayState', { userProfile: !!userProfile, dayState: !!dayState });
      return;
    }
    
    try {
      console.log('Generating plan with:', { userProfile, dayState });
      const plan = generatePlan(userProfile, dayState);
      console.log('Plan generated:', plan);
      set({ currentPlan: plan });
      get().saveToStorage();
    } catch (error) {
      console.error('Error generating plan:', error);
    }
  },
  
  updateDayState: (updates) => {
    const { dayState } = get();
    if (!dayState) return;
    
    const newState = { ...dayState, ...updates };
    set({ dayState: newState });
    get().regeneratePlan();
  },
  
  saveToStorage: async () => {
    try {
      const { userProfile, dayState, currentPlan } = get();
      await AsyncStorage.setItem(
        'appState',
        JSON.stringify({ userProfile, dayState, currentPlan })
      );
    } catch (error) {
      console.error('Failed to save to storage:', error);
    }
  },
  
  loadFromStorage: async () => {
    try {
      const data = await AsyncStorage.getItem('appState');
      if (data) {
        const { userProfile, dayState, currentPlan } = JSON.parse(data);
        set({ userProfile, dayState, currentPlan });
      }
    } catch (error) {
      console.error('Failed to load from storage:', error);
    }
  },
}));
