import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { usePlanStore } from '../store/planStore';
import { useAchievementStore } from '../store/achievementStore';
import { haptics } from '../utils/haptics';

const { width, height } = Dimensions.get('window');

export default function WelcomeScreen({ navigation }: any) {
  const { profile, initialize } = usePlanStore();
  const { currentStreak } = useAchievementStore();
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  
  useEffect(() => {
    initialize();
    
    // Entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 20,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 20,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);
  
  const handleGetStarted = () => {
    haptics.medium();
    if (profile) {
      navigation.navigate('TodaySetup');
    } else {
      navigation.navigate('Onboarding');
    }
  };
  
  const handleProgress = () => {
    haptics.light();
    navigation.navigate('Progress');
  };
  
  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#000000', '#0a1a0a', '#000000']}
        style={styles.gradient}
      >
        <Animated.View style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [
              { translateY: slideAnim },
              { scale: scaleAnim },
            ],
          },
        ]}>
          <View style={styles.header}>
            <LinearGradient
              colors={['#00ff88', '#14967F', '#0a7a5a']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.logoGradient}
            >
              <Text style={styles.logoEmoji}>🧬</Text>
            </LinearGradient>
            <Text style={styles.title}>PHYSIOLOGY FIRST</Text>
            <Text style={styles.subtitle}>Structure Engine</Text>
            {profile && currentStreak > 0 && (
              <View style={styles.streakBadge}>
                <Text style={styles.streakText}>🔥 {currentStreak} Day Streak</Text>
              </View>
            )}
          </View>
          
          <View style={styles.description}>
            <Text style={styles.descText}>
              AI-powered daily planner that adapts to{'\n'}
              <Text style={styles.highlight}>your unique physiology</Text>
            </Text>
            <View style={styles.features}>
              <FeatureItem icon="⚡" text="Instant plan optimization" />
              <FeatureItem icon="🎯" text="Goal-based scheduling" />
              <FeatureItem icon="📊" text="Progress tracking" />
              <FeatureItem icon="🏆" text="Achievement system" />
            </View>
          </View>
          
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleGetStarted}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#00ff88', '#14967F']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.buttonGradient}
              >
                <Text style={styles.buttonText}>
                  {profile ? 'CONTINUE' : 'GET STARTED'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
            
            {profile && (
              <View style={styles.secondaryActions}>
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={handleProgress}
                >
                  <Text style={styles.secondaryButtonText}>📊 View Progress</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() => {
                    haptics.light();
                    navigation.navigate('Settings');
                  }}
                >
                  <Text style={styles.secondaryButtonText}>⚙️ Settings</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </Animated.View>
      </LinearGradient>
    </View>
  );
}

function FeatureItem({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.featureItem}>
      <Text style={styles.featureIcon}>{icon}</Text>
      <Text style={styles.featureText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  gradient: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'space-between',
    paddingTop: height * 0.15,
    paddingBottom: 60,
  },
  header: {
    alignItems: 'center',
  },
  logoGradient: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    shadowColor: '#00ff88',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 10,
  },
  logoEmoji: {
    fontSize: 50,
  },
  title: {
    fontSize: 36,
    fontWeight: '900',
    color: '#00ff88',
    letterSpacing: 2,
    textAlign: 'center',
    textShadowColor: '#00ff88',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#888',
    letterSpacing: 4,
    marginTop: 8,
    textTransform: 'uppercase',
  },
  streakBadge: {
    marginTop: 16,
    backgroundColor: 'rgba(255, 107, 107, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.4)',
  },
  streakText: {
    color: '#FF6B6B',
    fontSize: 14,
    fontWeight: '700',
  },
  description: {
    alignItems: 'center',
  },
  descText: {
    fontSize: 18,
    color: '#ccc',
    lineHeight: 28,
    textAlign: 'center',
    marginBottom: 32,
  },
  highlight: {
    color: '#00ff88',
    fontWeight: '700',
  },
  features: {
    width: '100%',
    gap: 16,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 255, 136, 0.05)',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 136, 0.2)',
  },
  featureIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  featureText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  actions: {
    gap: 16,
  },
  primaryButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#00ff88',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
  },
  buttonGradient: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#000',
    letterSpacing: 2,
  },
  secondaryActions: {
    flexDirection: 'row',
    gap: 12,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 14,
    color: '#aaa',
    fontWeight: '600',
  },
});
