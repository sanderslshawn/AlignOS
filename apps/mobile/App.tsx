import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, Text, Button } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ErrorBoundary from './src/components/ErrorBoundary';

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
import InsightsScreen from './src/screens/InsightsScreen';
import SignalsScreen from './src/screens/SignalsScreen';
import TomorrowScreen from './src/screens/TomorrowScreen';
import HelpCenterScreen from './src/screens/help/HelpCenterScreen';
import HowAlignOSWorksScreen from './src/screens/help/HowAlignOSWorksScreen';
import GlossaryScreen from './src/screens/help/GlossaryScreen';
import FaqScreen from './src/screens/help/FaqScreen';
import GuidesScreen from './src/screens/help/GuidesScreen';
import LearnAlignOSTour from './src/screens/onboarding/LearnAlignOSTour';
import DebugErrorReport from './src/screens/DebugErrorReport';

import { usePlanStore, startAutoRefresh, stopAutoRefresh } from './src/store/planStore';
import { useAchievementStore } from './src/store/achievementStore';
import { useChatStore } from './src/store/chatStore';
import { useThemeStore } from './src/store/themeStore';
import { useHabitStore } from './src/store/habitStore';
import { useAdaptivePlanStore } from './src/store/adaptivePlanStore';
import { useSocialStore } from './src/store/socialStore';
import { useBiometricStore } from './src/store/biometricStore';
import { AppIcon } from '@physiology-engine/ui';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#0B0E14',
          borderTopColor: '#1E242F',
          height: 62,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarActiveTintColor: '#22D3EE',
        tabBarInactiveTintColor: '#6B7280',
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
        tabBarIcon: ({ color, size }) => {
          const iconByRoute: Record<string, any> = {
            Timeline: 'calendar',
            Insights: 'chart',
            Tomorrow: 'sunrise',
            Signals: 'flash',
            Settings: 'settings',
          };
          return <AppIcon name={iconByRoute[route.name] || 'calendar'} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Timeline" component={TimelineScreen} />
      <Tab.Screen name="Insights" component={InsightsScreen} />
      <Tab.Screen name="Tomorrow" component={TomorrowScreen} />
      <Tab.Screen name="Signals" component={SignalsScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  const initialize = usePlanStore((state) => state.initialize);
  const runDeferredInitializations = usePlanStore((s) => s.runDeferredInitializations);
  const profile = usePlanStore((state) => state.profile);
  const initializeAchievements = useAchievementStore((state) => state.initialize);
  const initializeChat = useChatStore((state) => state.initialize);
  const initializeTheme = useThemeStore((state) => state.initializeTheme);
  const loadHabits = useHabitStore((state) => state.loadFromStorage);
  const initializeAdaptive = useAdaptivePlanStore((state) => state.initialize);
  const loadSocialData = useSocialStore((state) => state.loadFromStorage);
  const loadBiometricData = useBiometricStore((state) => state.loadFromStorage);
  const calendarSyncEnabled = usePlanStore((s) => s.calendarSyncEnabled);
  const calendarPermissionStatus = usePlanStore((s) => s.calendarPermissionStatus);
  const syncCalendarEvents = usePlanStore((s) => s.syncCalendarEvents);

  const [bootPhase, setBootPhase] = useState<'booting' | 'ready' | 'error'>('booting');
  const [bootStep, setBootStep] = useState<string>('starting');
  const [bootError, setBootError] = useState<string | null>(null);

  // Core blocking initialization: only what is strictly necessary to render app shell
  const initializeCoreApp = async () => {
    try {
      setBootPhase('booting');
      setBootStep('Initializing plan store');
      await initialize(); // must remain blocking per requirement

      setBootStep('Applying theme');
      // theme init required for consistent render
      try {
        await initializeTheme();
      } catch (err) {
        console.warn('[Boot] initializeTheme failed', err);
      }

      setBootStep('Core ready');
      setBootPhase('ready');
      setBootStep('idle');
    } catch (err: any) {
      console.error('CORE BOOT ERROR:', err);
      setBootError(err?.message || String(err));
      setBootPhase('error');
    }
  };

  // Deferred initialization: run after first render, non-blocking
  const runDeferredTask = async (label: string, fn: () => Promise<any> | any) => {
    setBootStep(`Deferred: ${label}`);
    try {
      await Promise.resolve(fn());
      // eslint-disable-next-line no-console
      console.log(`[Deferred] ${label} completed`);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(`[Deferred] ${label} failed`, e);
    } finally {
      setBootStep('idle');
    }
  };

  const initializeDeferredAppFeatures = async () => {
    // run plan deferred init first (if needed)
    if (runDeferredInitializations) {
      await runDeferredTask('plan deferred init', runDeferredInitializations);
    }

    // non-blocking secondary initializers
    await runDeferredTask('achievements', initializeAchievements);
    await runDeferredTask('chat', initializeChat);
    await runDeferredTask('habits', loadHabits);
    await runDeferredTask('adaptive plan', initializeAdaptive);
    await runDeferredTask('social data', loadSocialData);
    await runDeferredTask('biometrics', loadBiometricData);

    // start auto-refresh in background
    await runDeferredTask('start auto refresh', () => startAutoRefresh());

    // NOTE: calendar auto-sync on startup is disabled to avoid any calendar API
    // calls during app boot. Calendar sync must be triggered explicitly by the
    // user (via Settings) or by a guarded action later in the session.
  };

  useEffect(() => {
    void initializeCoreApp();
    return () => {
      stopAutoRefresh();
    };
  }, []);

  // kick off deferred work after core ready
  useEffect(() => {
    if (bootPhase === 'ready') {
      void initializeDeferredAppFeatures();
    }
  }, [bootPhase]);

  // Loading / boot UI
  if (bootPhase === 'booting') {
    return (
      <SafeAreaProvider>
        <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <Text style={{ color: 'white', fontSize: 20, fontWeight: '700', marginBottom: 12 }}>AlignOS</Text>
          <ActivityIndicator color="#22D3EE" />
          <Text style={{ color: '#9CA3AF', marginTop: 12 }}>{bootStep}</Text>
        </View>
      </SafeAreaProvider>
    );
  }

  if (bootPhase === 'error') {
    return (
      <SafeAreaProvider>
        <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <Text style={{ color: 'white', fontSize: 18, fontWeight: '700', marginBottom: 12 }}>AlignOS failed to finish startup</Text>
          <Text style={{ color: '#fff', marginBottom: 12 }}>{bootError}</Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Button title="Continue anyway" onPress={() => { setBootPhase('ready'); usePlanStore.setState({ initialized: true }); void initializeDeferredAppFeatures(); }} />
            <View style={{ width: 12 }} />
            <Button title="Retry startup" onPress={() => { setBootError(null); setBootPhase('booting'); void initializeCoreApp(); }} />
          </View>
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <NavigationContainer>
        <StatusBar style="light" />
        <Stack.Navigator
          initialRouteName={profile ? 'MainTabs' : 'Welcome'}
          screenOptions={{
            headerStyle: {
              backgroundColor: '#000',
            },
            headerTintColor: '#22D3EE',
            headerTitleStyle: {
              fontWeight: '700',
            },
            contentStyle: {
              backgroundColor: '#000',
            },
          }}
        >
          <Stack.Screen name="Welcome" component={WelcomeScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ title: 'Setup Profile' }} />
          <Stack.Screen name="TodaySetup" component={TodaySetupScreen} options={{ title: 'Today Setup' }} />
          <Stack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />

          <Stack.Screen name="Chat" component={ChatScreen} options={{ title: 'AI Advisor' }} />
          <Stack.Screen name="Progress" component={ProgressScreen} options={{ title: 'Progress & Achievements' }} />
          <Stack.Screen name="Social" component={SocialScreen} options={{ title: 'Social & Challenges' }} />
          <Stack.Screen name="Biometrics" component={BiometricsScreen} options={{ title: 'Health Dashboard' }} />
          <Stack.Screen name="History" component={HistoryScreen} options={{ title: 'History' }} />
          <Stack.Screen name="Habits" component={HabitsScreen} options={{ title: 'Habits' }} />
          <Stack.Screen name="Help" component={HelpCenterScreen} options={{ title: 'Help Center' }} />
          <Stack.Screen name="HelpCenter" component={HelpCenterScreen} options={{ title: 'Help Center' }} />
          <Stack.Screen name="HowAlignOSWorks" component={HowAlignOSWorksScreen} options={{ title: 'How AlignOS Works' }} />
          <Stack.Screen name="Glossary" component={GlossaryScreen} options={{ title: 'Glossary' }} />
          <Stack.Screen name="FAQ" component={FaqScreen} options={{ title: 'FAQ' }} />
          <Stack.Screen name="Guides" component={GuidesScreen} options={{ title: 'Guides' }} />
          <Stack.Screen name="LearnAlignOSTour" component={LearnAlignOSTour} options={{ title: 'Learn AlignOS' }} />
          <Stack.Screen name="DebugReport" component={DebugErrorReport} options={{ title: 'Debug Report' }} />
          <Stack.Screen name="WeeklySummary" component={WeeklySummaryScreen} options={{ title: 'Weekly Summary' }} />
        </Stack.Navigator>
        </NavigationContainer>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

// Global JS error handler: persist last error to AsyncStorage so TestFlight users report failures
try {
  // preserve existing handler
  const previousHandler = (global as any).ErrorUtils && (global as any).ErrorUtils.getGlobalHandler && (global as any).ErrorUtils.getGlobalHandler();
  if ((global as any).ErrorUtils && (global as any).ErrorUtils.setGlobalHandler) {
    (global as any).ErrorUtils.setGlobalHandler((error: any, isFatal?: boolean) => {
      const payload = {
        error: String(error),
        stack: error?.stack,
        isFatal: !!isFatal,
        ts: new Date().toISOString(),
      };
      AsyncStorage.setItem('last_error_report', JSON.stringify(payload)).catch(() => {});
      if (previousHandler) {
        previousHandler(error, isFatal);
      }
    });
  }
} catch (e) {
  // ignore
}
