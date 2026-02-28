import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import WelcomeScreen from './src/screens/WelcomeScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import TodaySetupScreen from './src/screens/TodaySetupScreen';
import TimelineScreen from './src/screens/TimelineScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import ProgressScreen from './src/screens/ProgressScreen';
import ChatScreen from './src/screens/ChatScreen';
import HabitsScreen from './src/screens/HabitsScreen';
import WeeklySummaryScreen from './src/screens/WeeklySummaryScreen';
import SocialScreen from './src/screens/SocialScreen';
import BiometricsScreen from './src/screens/BiometricsScreen';

// Import plan store for auto-refresh and initialization
import { usePlanStore, startAutoRefresh, stopAutoRefresh } from './src/store/planStore';
import { useAchievementStore } from './src/store/achievementStore';
import { useChatStore } from './src/store/chatStore';
import { useThemeStore } from './src/store/themeStore';
import { useHabitStore } from './src/store/habitStore';
import { useAdaptivePlanStore } from './src/store/adaptivePlanStore';
import { useSocialStore } from './src/store/socialStore';
import { useBiometricStore } from './src/store/biometricStore';

const Stack = createNativeStackNavigator();

export default function App() {
  const initialize = usePlanStore((state) => state.initialize);
  const initializeAchievements = useAchievementStore((state) => state.initialize);
  const initializeChat = useChatStore((state) => state.initialize);
  const initializeTheme = useThemeStore((state) => state.initializeTheme);
  const loadHabits = useHabitStore((state) => state.loadFromStorage);
  const initializeAdaptive = useAdaptivePlanStore((state) => state.initialize);
  const loadSocialData = useSocialStore((state) => state.loadFromStorage);
  const loadBiometricData = useBiometricStore((state) => state.loadFromStorage);
  
  useEffect(() => {
    // Initialize stores on app launch
    initialize();
    initializeAchievements();
    initializeChat();
    initializeTheme();
    loadHabits();
    initializeAdaptive();
    loadSocialData();
    loadBiometricData();
    
    // Start auto-refresh timer for staleness detection
    startAutoRefresh();
    
    return () => {
      // Cleanup on unmount
      stopAutoRefresh();
    };
  }, [initialize, initializeAchievements, initializeChat, initializeTheme, loadHabits, initializeAdaptive, loadSocialData, loadBiometricData]);
  
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar style="light" />
        <Stack.Navigator
          screenOptions={{
            headerStyle: {
              backgroundColor: '#000',
            },
            headerTintColor: '#00ff88',
            headerTitleStyle: {
              fontWeight: '700',
            },
            contentStyle: {
              backgroundColor: '#000',
            },
          }}
        >
          <Stack.Screen
            name="Welcome"
            component={WelcomeScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Onboarding"
            component={OnboardingScreen}
            options={{ title: 'Setup Profile' }}
          />
          <Stack.Screen
            name="TodaySetup"
            component={TodaySetupScreen}
            options={{ title: 'Today Setup' }}
          />
          <Stack.Screen
            name="Timeline"
            component={TimelineScreen}
            options={{ title: 'Timeline' }}
          />
          <Stack.Screen
            name="Chat"
            component={ChatScreen}
            options={{ 
              title: 'AI Advisor',
              headerRight: () => null,
            }}
          />
          <Stack.Screen
            name="Progress"
            component={ProgressScreen}
            options={{ title: 'Progress & Achievements' }}
          />
          <Stack.Screen
            name="Social"
            component={SocialScreen}
            options={{ title: 'Social & Challenges' }}
          />
          <Stack.Screen
            name="Biometrics"
            component={BiometricsScreen}
            options={{ title: 'Health Dashboard' }}
          />
          <Stack.Screen
            name="History"
            component={HistoryScreen}
            options={{ title: 'History' }}
          />
          <Stack.Screen
            name="Settings"
            component={SettingsScreen}
            options={{ title: 'Settings' }}
          />
          <Stack.Screen
            name="Habits"
            component={HabitsScreen}
            options={{ title: 'Habits' }}
          />
          <Stack.Screen
            name="WeeklySummary"
            component={WeeklySummaryScreen}
            options={{ title: 'Weekly Summary' }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
