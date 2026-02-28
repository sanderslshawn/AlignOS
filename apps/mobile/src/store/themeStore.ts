import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance, ColorSchemeName } from 'react-native';

export type ThemeMode = 'light' | 'dark' | 'auto';

export interface ThemeColors {
  background: string;
  surface: string;
  card: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  primary: string;
  primaryLight: string;
  success: string;
  warning: string;
  error: string;
  border: string;
  shadow: string;
  gradient1: string;
  gradient2: string;
  gradient3: string;
}

const LIGHT_COLORS: ThemeColors = {
  background: '#f5f5f7',
  surface: '#ffffff',
  card: '#ffffff',
  text: '#1d1d1f',
  textSecondary: '#6e6e73',
  textTertiary: '#86868b',
  primary: '#00ff88',
  primaryLight: '#66ffb3',
  success: '#34c759',
  warning: '#ff9500',
  error: '#ff3b30',
  border: '#d2d2d7',
  shadow: 'rgba(0, 0, 0, 0.1)',
  gradient1: '#00ff88',
  gradient2: '#14967F',
  gradient3: '#0a7a5a',
};

const DARK_COLORS: ThemeColors = {
  background: '#000000',
  surface: '#1c1c1e',
  card: '#2c2c2e',
  text: '#f5f5f7',
  textSecondary: '#a1a1a6',
  textTertiary: '#75757a',
  primary: '#00ff88',
  primaryLight: '#66ffb3',
  success: '#30d158',
  warning: '#ff9f0a',
  error: '#ff453a',
  border: '#38383a',
  shadow: 'rgba(0, 0, 0, 0.5)',
  gradient1: '#00ff88',
  gradient2: '#14967F',
  gradient3: '#0a7a5a',
};

interface ThemeState {
  mode: ThemeMode;
  colors: ThemeColors;
  isDark: boolean;
  
  setThemeMode: (mode: ThemeMode) => void;
  initializeTheme: () => Promise<void>;
}

// Get the actual theme based on mode and system preference
function getEffectiveTheme(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'auto') {
    const systemTheme = Appearance.getColorScheme();
    return systemTheme === 'dark' ? 'dark' : 'light';
  }
  return mode;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: 'auto',
  colors: LIGHT_COLORS,
  isDark: false,
  
  setThemeMode: async (mode: ThemeMode) => {
    const effectiveTheme = getEffectiveTheme(mode);
    const colors = effectiveTheme === 'dark' ? DARK_COLORS : LIGHT_COLORS;
    const isDark = effectiveTheme === 'dark';
    
    set({ mode, colors, isDark });
    await AsyncStorage.setItem('theme_mode', mode);
  },
  
  initializeTheme: async () => {
    // Load saved theme mode
    const savedMode = await AsyncStorage.getItem('theme_mode');
    const mode = (savedMode as ThemeMode) || 'auto';
    
    const effectiveTheme = getEffectiveTheme(mode);
    const colors = effectiveTheme === 'dark' ? DARK_COLORS : LIGHT_COLORS;
    const isDark = effectiveTheme === 'dark';
    
    set({ mode, colors, isDark });
    
    // Listen for system theme changes (only if mode is 'auto')
    Appearance.addChangeListener(({ colorScheme }) => {
      const { mode } = get();
      if (mode === 'auto') {
        const effectiveTheme = colorScheme === 'dark' ? 'dark' : 'light';
        const colors = effectiveTheme === 'dark' ? DARK_COLORS : LIGHT_COLORS;
        const isDark = effectiveTheme === 'dark';
        set({ colors, isDark });
      }
    });
  },
}));

/**
 * Get time-based auto theme
 * Automatically switches to dark mode after sunset
 */
export function getTimeBasedTheme(): 'light' | 'dark' {
  const hour = new Date().getHours();
  // Dark mode from 8 PM to 7 AM
  return hour >= 20 || hour < 7 ? 'dark' : 'light';
}

/**
 * Get circadian-optimized theme
 * Switches based on optimal circadian lighting
 */
export function getCircadianTheme(wakeTime: string, sleepTime: string): 'light' | 'dark' {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  
  const [sleepHour, sleepMin] = sleepTime.split(':').map(Number);
  const sleepMinutes = sleepHour * 60 + sleepMin;
  
  // Dim lights 2 hours before sleep (melatonin optimization)
  const dimTime = sleepMinutes - 120;
  
  const [wakeHour, wakeMin] = wakeTime.split(':').map(Number);
  const wakeMinutes = wakeHour * 60 + wakeMin;
  
  // Bright light until 2 hours before sleep
  if (currentMinutes >= wakeMinutes && currentMinutes < dimTime) {
    return 'light';
  }
  
  return 'dark';
}

// Premium theme presets
export const PREMIUM_GRADIENTS = {
  emerald: ['#00ff88', '#14967F', '#0a7a5a'],
  ocean: ['#00b4d8', '#0077b6', '#03045e'],
  sunset: ['#ff6b6b', '#ee5a6f', '#c44569'],
  purple: ['#9d4edd', '#7209b7', '#560bad'],
  gold: ['#ffd60a', '#ffb703', '#fb8500'],
  mint: ['#06ffa5', '#00d9ff', '#0099cc'],
};

/**
 * Generate dynamic gradient based on time of day
 */
export function getTimeBasedGradient(): string[] {
  const hour = new Date().getHours();
  
  if (hour >= 6 && hour < 10) return PREMIUM_GRADIENTS.gold; // Morning - energetic
  if (hour >= 10 && hour < 14) return PREMIUM_GRADIENTS.emerald; // Mid-day - productive
  if (hour >= 14 && hour < 18) return PREMIUM_GRADIENTS.ocean; // Afternoon - focused
  if (hour >= 18 && hour < 21) return PREMIUM_GRADIENTS.purple; // Evening - wind down
  return PREMIUM_GRADIENTS.mint; // Night - calm
}
