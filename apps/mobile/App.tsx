import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import WelcomeScreen from './src/screens/WelcomeScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import TodaySetupScreen from './src/screens/TodaySetupScreen';
import TimelineScreen from './src/screens/TimelineScreen.tsx';
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
  const profile = usePlanStore((state) => state.profile);
  const initialized = usePlanStore((state) => state.initialized);
  const initializeAchievements = useAchievementStore((state) => state.initialize);
  const initializeChat = useChatStore((state) => state.initialize);
  const initializeTheme = useThemeStore((state) => state.initializeTheme);
  const loadHabits = useHabitStore((state) => state.loadFromStorage);
  const initializeAdaptive = useAdaptivePlanStore((state) => state.initialize);
  const loadSocialData = useSocialStore((state) => state.loadFromStorage);
  const loadBiometricData = useBiometricStore((state) => state.loadFromStorage);

  useEffect(() => {
    initialize();
    initializeAchievements();
    initializeChat();
    initializeTheme();
    loadHabits();
    initializeAdaptive();
    loadSocialData();
    loadBiometricData();

    startAutoRefresh();

    return () => {
      stopAutoRefresh();
    };
  }, [initialize, initializeAchievements, initializeChat, initializeTheme, loadHabits, initializeAdaptive, loadSocialData, loadBiometricData]);

  if (!initialized) {
    return (
      <SafeAreaProvider>
        <View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#22D3EE" />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
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
          <Stack.Screen name="WeeklySummary" component={WeeklySummaryScreen} options={{ title: 'Weekly Summary' }} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
