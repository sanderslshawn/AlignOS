/**
 * Progress Dashboard Screen
 * Beautiful analytics and achievements display
 */

import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAchievementStore } from '../store/achievementStore';
import { format } from 'date-fns';

const { width } = Dimensions.get('window');

export default function ProgressScreen() {
  const {
    currentStreak,
    longestStreak,
    totalDaysActive,
    totalActivitiesCompleted,
    perfectDays,
    achievements,
    completionHistory,
    initialize,
  } = useAchievementStore();

  useEffect(() => {
    initialize();
  }, []);

  const unlockedCount = achievements.filter(a => a.unlockedAt).length;
  const recentDays = completionHistory.slice(-7);
  const avgCompletion = recentDays.length > 0
    ? recentDays.reduce((sum, d) => sum + d.completionRate, 0) / recentDays.length
    : 0;

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Your Progress</Text>
          <Text style={styles.subtitle}>Keep building momentum</Text>
        </View>

        {/* Streak Card */}
        <LinearGradient
          colors={['#FF6B6B', '#FF8E53', '#FFA06B']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.streakCard}
        >
          <View style={styles.streakContent}>
            <Text style={styles.streakEmoji}>🔥</Text>
            <View style={styles.streakInfo}>
              <Text style={styles.streakNumber}>{currentStreak}</Text>
              <Text style={styles.streakLabel}>Day Streak</Text>
            </View>
          </View>
          <Text style={styles.streakSubtext}>Best: {longestStreak} days</Text>
        </LinearGradient>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <LinearGradient
            colors={['#667EEA', '#764BA2']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.statCard}
          >
            <Text style={styles.statIcon}>📊</Text>
            <Text style={styles.statNumber}>{totalActivitiesCompleted}</Text>
            <Text style={styles.statLabel}>Activities</Text>
          </LinearGradient>

          <LinearGradient
            colors={['#11998E', '#38EF7D']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.statCard}
          >
            <Text style={styles.statIcon}>✨</Text>
            <Text style={styles.statNumber}>{perfectDays}</Text>
            <Text style={styles.statLabel}>Perfect Days</Text>
          </LinearGradient>

          <LinearGradient
            colors={['#F857A6', '#FF5858']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.statCard}
          >
            <Text style={styles.statIcon}>📅</Text>
            <Text style={styles.statNumber}>{totalDaysActive}</Text>
            <Text style={styles.statLabel}>Total Days</Text>
          </LinearGradient>

          <LinearGradient
            colors={['#FFD89B', '#19547B']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.statCard}
          >
            <Text style={styles.statIcon}>🎯</Text>
            <Text style={styles.statNumber}>{Math.round(avgCompletion)}%</Text>
            <Text style={styles.statLabel}>Avg Rate</Text>
          </LinearGradient>
        </View>

        {/* Weekly Progress */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Last 7 Days</Text>
          <View style={styles.weeklyChart}>
            {recentDays.map((day, index) => {
              const height = Math.max(day.completionRate, 10);
              const date = new Date(day.date);
              return (
                <View key={day.date} style={styles.chartBar}>
                  <View style={styles.barContainer}>
                    <LinearGradient
                      colors={height === 100 ? ['#00ff88', '#14967F'] : ['#667EEA', '#764BA2']}
                      style={[styles.bar, { height: `${height}%` }]}
                    />
                  </View>
                  <Text style={styles.chartLabel}>{format(date, 'EEE')[0]}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Achievements */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Achievements ({unlockedCount}/{achievements.length})
          </Text>
          <View style={styles.achievementsGrid}>
            {achievements.map((achievement) => (
              <View
                key={achievement.id}
                style={[
                  styles.achievementCard,
                  achievement.unlockedAt && styles.achievementUnlocked,
                ]}
              >
                <Text style={[
                  styles.achievementIcon,
                  !achievement.unlockedAt && styles.achievementLocked,
                ]}>
                  {achievement.icon}
                </Text>
                <Text style={[
                  styles.achievementTitle,
                  !achievement.unlockedAt && styles.textLocked,
                ]}>
                  {achievement.title}
                </Text>
                <Text style={[
                  styles.achievementDesc,
                  !achievement.unlockedAt && styles.textLocked,
                ]}>
                  {achievement.description}
                </Text>
                {achievement.unlockedAt && (
                  <Text style={styles.achievementDate}>
                    {format(new Date(achievement.unlockedAt), 'MMM d')}
                  </Text>
                )}
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 24,
    paddingTop: 60,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#00ff88',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#aaa',
  },
  streakCard: {
    margin: 24,
    marginTop: 12,
    padding: 24,
    borderRadius: 24,
    shadowColor: '#FF6B6B',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  streakContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  streakEmoji: {
    fontSize: 48,
    marginRight: 16,
  },
  streakInfo: {
    flex: 1,
  },
  streakNumber: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#fff',
  },
  streakLabel: {
    fontSize: 18,
    color: '#fff',
    opacity: 0.9,
  },
  streakSubtext: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.8,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 16,
  },
  statCard: {
    width: (width - 64) / 2,
    padding: 20,
    borderRadius: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  statIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  statNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
  },
  section: {
    padding: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
  },
  weeklyChart: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 120,
    paddingTop: 20,
  },
  chartBar: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  barContainer: {
    width: '80%',
    height: 100,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  bar: {
    width: '100%',
    borderRadius: 8,
  },
  chartLabel: {
    fontSize: 12,
    color: '#888',
  },
  achievementsGrid: {
    gap: 12,
  },
  achievementCard: {
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#2a2a2a',
  },
  achievementUnlocked: {
    borderColor: '#00ff88',
    backgroundColor: '#0a2a1a',
  },
  achievementIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  achievementLocked: {
    opacity: 0.3,
  },
  achievementTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  achievementDesc: {
    fontSize: 13,
    color: '#888',
  },
  textLocked: {
    opacity: 0.5,
  },
  achievementDate: {
    fontSize: 11,
    color: '#00ff88',
    marginTop: 4,
  },
});
