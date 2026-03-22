import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePlanStore } from '../store/planStore';
import { useAchievementStore } from '../store/achievementStore';
import { haptics } from '../utils/haptics';
import { useTheme, PrimaryButton, SecondaryButton, Chip, Card, AppIcon } from '@physiology-engine/ui';
import SystemStatusCard from '../components/SystemStatusCard';
import TodayInsightCard from '../components/TodayInsightCard';
import FeatureExplanationSheet from '../components/FeatureExplanationSheet';
import { FEATURE_EXPLANATIONS, getSystemStatus, getTodayInsight, type FeatureExplanation } from './welcomeHelpers';

export default function WelcomeScreen({ navigation }: any) {
  const { profile, initialize } = usePlanStore();
  const { currentStreak } = useAchievementStore();
  const { colors, typography, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const streakGlowAnim = useRef(new Animated.Value(0)).current;
  const previousStreakRef = useRef<number | null>(null);
  const [selectedFeature, setSelectedFeature] = useState<FeatureExplanation | null>(null);

  const systemStatusLines = useMemo(() => getSystemStatus(profile), [profile]);
  const todayInsight = useMemo(() => getTodayInsight(profile), [profile]);
  
  useEffect(() => {
    initialize();
    
    // Entrance animation - subtle
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  useEffect(() => {
    if (previousStreakRef.current !== null && currentStreak > previousStreakRef.current) {
      streakGlowAnim.setValue(0);
      Animated.sequence([
        Animated.timing(streakGlowAnim, {
          toValue: 1,
          duration: 320,
          useNativeDriver: true,
        }),
        Animated.timing(streakGlowAnim, {
          toValue: 0,
          duration: 900,
          useNativeDriver: true,
        }),
      ]).start();
    }
    previousStreakRef.current = currentStreak;
  }, [currentStreak, streakGlowAnim]);
  
  const handleGetStarted = () => {
    haptics.medium();
    if (profile) {
      navigation.navigate('MainTabs', { screen: 'Timeline' });
    } else {
      navigation.navigate('Onboarding');
    }
  };
  
  const handleProgress = () => {
    haptics.light();
    navigation.navigate('Progress');
  };

  const handleFeaturePress = (feature: FeatureExplanation) => {
    haptics.light();
    setSelectedFeature(feature);
  };
  
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: insets.bottom + 16, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      >
      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
            paddingTop: insets.top + spacing.xl,
          },
        ]}
      >
        <View style={styles.header}>
          {/* Logo - simple circle with icon */}
          <View style={[
            styles.logoContainer,
            {
              backgroundColor: colors.surfaceElevated,
              borderColor: colors.borderSubtle,
              borderRadius: radius.xl,
            }
          ]}>
            <AppIcon name="brain" size={48} color={colors.accentPrimary} />
          </View>
          
          <Text style={[
            typography.titleXL,
            styles.title,
            { color: colors.textPrimary }
          ]}>
            AlignOS
          </Text>
          
          <Text style={[
            typography.bodyM,
            { color: colors.textMuted, marginTop: spacing.xs, letterSpacing: 2 }
          ]}>
            PHYSIOLOGY ENGINE
          </Text>
          
          {profile && currentStreak > 0 && (
            <View style={{ marginTop: spacing.lg }}>
              <Animated.View
                style={{
                  alignSelf: 'center',
                  transform: [
                    {
                      scale: streakGlowAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 1.03],
                      }),
                    },
                  ],
                }}
              >
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.streakGlow,
                    {
                      backgroundColor: colors.accentSoft,
                      borderRadius: radius.pill,
                      opacity: streakGlowAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, 0.75],
                      }),
                      transform: [
                        {
                          scale: streakGlowAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.98, 1.08],
                          }),
                        },
                      ],
                    },
                  ]}
                />
                <Chip variant="accent" icon="flame">
                  {`${String(currentStreak)} Day Streak`}
                </Chip>
              </Animated.View>
            </View>
          )}

          {profile && (
            <View style={styles.premiumCardsContainer}>
              <SystemStatusCard lines={systemStatusLines} />
              <TodayInsightCard title={todayInsight.title} subtitle={todayInsight.subtitle} />
            </View>
          )}
        </View>
        
        <View style={styles.description}>
          <Text style={[
            typography.bodyL,
            {
              color: colors.textSecondary,
              textAlign: 'center',
              lineHeight: 26,
              marginBottom: spacing['2xl'],
            }
          ]}>
            A daily plan optimized for{`\n`}
            <Text style={{ color: colors.accentPrimary, fontWeight: '600' }}>
              how your body works
            </Text>
          </Text>
          
          <View style={styles.featureList}>
            {FEATURE_EXPLANATIONS.map((feature) => (
              <FeatureCard
                key={feature.id}
                icon={feature.icon}
                text={feature.label}
                onPress={() => handleFeaturePress(feature)}
              />
            ))}
          </View>
        </View>
        
        <View style={{ gap: spacing.md }}>
          <PrimaryButton onPress={handleGetStarted}>
            {profile ? 'CONTINUE' : 'GET STARTED'}
          </PrimaryButton>
          
          {profile && (
            <View style={styles.secondaryActions}>
              <SecondaryButton
                onPress={handleProgress}
                style={styles.halfButton}
              >
                Progress
              </SecondaryButton>
              <SecondaryButton
                onPress={() => {
                  haptics.light();
                  navigation.navigate('MainTabs', { screen: 'Settings' });
                }}
                style={styles.halfButton}
              >
                Settings
              </SecondaryButton>
            </View>
          )}
        </View>
      </Animated.View>
      </ScrollView>

      <FeatureExplanationSheet
        visible={Boolean(selectedFeature)}
        feature={selectedFeature}
        onClose={() => {
          haptics.light();
          setSelectedFeature(null);
        }}
      />
    </View>
  );
}

function FeatureCard({ icon, text, onPress }: { icon: 'sparkles' | 'focus' | 'chart' | 'trophy'; text: string; onPress: () => void }) {
  const { colors, typography, spacing } = useTheme();
  const pressScaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(pressScaleAnim, {
      toValue: 0.985,
      tension: 140,
      friction: 13,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(pressScaleAnim, {
      toValue: 1,
      tension: 120,
      friction: 10,
      useNativeDriver: true,
    }).start();
  };
  
  return (
    <Animated.View style={{ transform: [{ scale: pressScaleAnim }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        android_ripple={{ color: `${colors.accentPrimary}22` }}
        style={({ pressed }) => [
          styles.featurePressable,
          {
            opacity: pressed ? 0.96 : 1,
          },
        ]}
      >
        <Card style={styles.featureItem}>
          <AppIcon name={icon} size={20} color={colors.textSecondary} />
          <Text
            style={[
              typography.bodyM,
              { color: colors.textPrimary, marginLeft: spacing.md, fontWeight: '500', flex: 1 },
            ]}
          >
            {text}
          </Text>
          <AppIcon name="chevronRight" size={16} color={colors.textMuted} />
        </Card>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 24,
    justifyContent: 'space-between',
    paddingBottom: 24,
    minHeight: '100%',
  },
  header: {
    alignItems: 'center',
  },
  logoContainer: {
    width: 88,
    height: 88,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    borderWidth: 1,
  },
  title: {
    letterSpacing: 1,
    textAlign: 'center',
  },
  description: {
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 16,
  },
  premiumCardsContainer: {
    width: '100%',
    marginTop: 4,
  },
  streakGlow: {
    position: 'absolute',
    left: -8,
    right: -8,
    top: -6,
    bottom: -6,
  },
  featureList: {
    width: '100%',
    gap: 12,
  },
  featurePressable: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
  },
  secondaryActions: {
    flexDirection: 'row',
    gap: 12,
  },
  halfButton: {
    flex: 1,
  },
});
