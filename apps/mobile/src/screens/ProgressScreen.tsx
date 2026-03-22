/**
 * AlignOS System Health Screen
 * Clean analytics without gamification
 */

import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, useWindowDimensions } from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useAchievementStore } from '../store/achievementStore';
import { format } from 'date-fns';
import { 
  useTheme, 
  Card, 
  SectionTitle, 
  StatRow, 
  Divider,
  AppIcon,
} from '@physiology-engine/ui';


export default function ProgressScreen() {
  const { colors, typography, spacing, radius } = useTheme();
  const { width } = useWindowDimensions();
  const isCompactScore = width < 360;
  
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

  const recentDays = completionHistory.slice(-7);
  const avgCompletion = recentDays.length > 0
    ? recentDays.reduce((sum, d) => sum + d.completionRate, 0) / recentDays.length
    : 0;

  // Calculate stability score (0-100) based on consistency
  const stabilityScore = Math.round(
    (currentStreak / Math.max(longestStreak, 1)) * 40 +
    (avgCompletion / 100) * 40 +
    (perfectDays / Math.max(totalDaysActive, 1)) * 20
  );

  // Calculate timing consistency (variance in completion times)
  const timingVariance = recentDays.length > 1
    ? Math.round(recentDays.reduce((sum, d, i, arr) => {
        if (i === 0) return 0;
        return sum + Math.abs(d.completionRate - arr[i - 1].completionRate);
      }, 0) / (recentDays.length - 1))
    : 0;
  
  const consistencyRating = timingVariance < 10 ? 'Excellent' :
                           timingVariance < 20 ? 'Good' :
                           timingVariance < 30 ? 'Fair' : 'Variable';

  // Calculate momentum (7-day trend)
  const momentum = recentDays.length >= 2
    ? recentDays[recentDays.length - 1].completionRate - recentDays[0].completionRate
    : 0;
  
  const momentumLabel = momentum > 10 ? 'Rising' :
                       momentum < -10 ? 'Declining' : 'Stable';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.scrollView}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: 60 }]}>
          <Text style={[typography.titleXL, { color: colors.textPrimary }]}>System Health</Text>
          <Text style={[typography.bodyM, { color: colors.textSecondary }]}>
            Execution metrics & consistency tracking
          </Text>
        </View>

        {/* Stability Score Card */}
        <View style={{ paddingHorizontal: spacing.lg }}>
          <Card>
            <View style={styles.scoreHeader}>
              <View style={styles.scoreContent}>
                <Text style={[typography.bodyM, { color: colors.textMuted, fontSize: 12, marginBottom: 4, letterSpacing: 0.5 }]}>
                  STABILITY SCORE
                </Text>
                <Text
                  style={[
                    typography.titleXL,
                    styles.scoreValue,
                    {
                      color: colors.accentPrimary,
                      fontSize: isCompactScore ? 42 : 48,
                      lineHeight: isCompactScore ? 48 : 56,
                      fontWeight: '700',
                    },
                  ]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.9}
                >
                  {stabilityScore}
                </Text>
              </View>
              <View style={[styles.scoreBadge, { backgroundColor: colors.accentSoft, borderColor: colors.accentPrimary }]}>
                <Feather name="trending-up" size={24} color={colors.accentPrimary} />
              </View>
            </View>
            
            <Divider spacing="md" />
            
            <View style={styles.scoreMetrics}>
              <View style={{ flex: 1 }}>
                <Text style={[typography.bodyM, { color: colors.textMuted, fontSize: 11, marginBottom: 4, letterSpacing: 0.4 }]}>
                  VARIANCE
                </Text>
                <Text style={[typography.bodyM, { color: colors.textPrimary, fontWeight: '600' }]}>
                  {consistencyRating}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[typography.bodyM, { color: colors.textMuted, fontSize: 11, marginBottom: 4, letterSpacing: 0.4 }]}>
                  TREND
                </Text>
                <Text style={[typography.bodyM, { color: colors.textPrimary, fontWeight: '600' }]}>
                  {momentumLabel}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[typography.bodyM, { color: colors.textMuted, fontSize: 11, marginBottom: 4, letterSpacing: 0.4 }]}>
                  STREAK
                </Text>
                <Text style={[typography.bodyM, { color: colors.textPrimary, fontWeight: '600' }]}>
                  {currentStreak}d
                </Text>
              </View>
            </View>
          </Card>
        </View>

        {/* Core Metrics */}
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
          <View style={styles.sectionHeader}>
            <AppIcon name="chart" size={18} color={colors.textPrimary} />
            <SectionTitle title="Core Metrics" />
          </View>
          
          <Card style={{ marginTop: spacing.md }}>
            <StatRow 
              label="Total Days Active" 
              value={totalDaysActive.toString()} 
            />
            <Divider spacing="sm" />
            <StatRow 
              label="Activities Completed" 
              value={totalActivitiesCompleted.toString()} 
            />
            <Divider spacing="sm" />
            <StatRow 
              label="Perfect Days" 
              value={perfectDays.toString()} 
            />
            <Divider spacing="sm" />
            <StatRow 
              label="Current Streak" 
              value={`${currentStreak} days`} 
            />
            <Divider spacing="sm" />
            <StatRow 
              label="Longest Streak" 
              value={`${longestStreak} days`} 
            />
            <Divider spacing="sm" />
            <StatRow 
              label="7-Day Avg Completion" 
              value={`${Math.round(avgCompletion)}%`} 
            />
          </Card>
        </View>

        {/* 7-Day Trend */}
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
          <View style={styles.sectionHeader}>
            <AppIcon name="history" size={18} color={colors.textPrimary} />
            <SectionTitle title="Last 7 Days" />
          </View>
          
          <Card style={{ marginTop: spacing.md }}>
            <View style={styles.chartContainer}>
              {recentDays.map((day, index) => {
                const height = Math.max(day.completionRate / 100, 0.1);
                const date = new Date(day.date);
                const isToday = index === recentDays.length - 1;
                
                return (
                  <View key={day.date} style={styles.barWrapper}>
                    <View style={styles.barColumn}>
                      <View style={styles.barTrack}>
                        <View 
                          style={[
                            styles.bar,
                            { 
                              height: `${height * 100}%`,
                              backgroundColor: day.completionRate === 100 
                                ? colors.success 
                                : isToday
                                ? colors.accentPrimary
                                : colors.chartPrimary,
                            }
                          ]} 
                        />
                      </View>
                      <Text style={[typography.bodyM, { color: colors.textMuted, fontSize: 10, marginTop: 8 }]}>
                        {format(date, 'EEE')[0]}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </Card>
        </View>

        {/* System Benchmarks */}
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xl }}>
          <View style={styles.sectionHeader}>
            <Ionicons name="trophy" size={18} color={colors.textPrimary} />
            <SectionTitle title="System Benchmarks" />
          </View>
          
          <View style={{ marginTop: spacing.md }}>
            {achievements.map((achievement) => {
              const isUnlocked = !!achievement.unlockedAt;
              return (
                <Card 
                  key={achievement.id} 
                  style={{ 
                    marginBottom: spacing.sm,
                    opacity: isUnlocked ? 1 : 0.4,
                  }}
                >
                  <View style={styles.achievementRow}>
                    <View style={[
                      styles.achievementIcon,
                      { 
                        backgroundColor: isUnlocked ? colors.accentSoft : colors.surface,
                        borderColor: isUnlocked ? colors.accentPrimary : colors.border,
                      }
                    ]}>
                      <AppIcon 
                        name="check" 
                        size={20} 
                        color={isUnlocked ? colors.accentPrimary : colors.textMuted} 
                      />
                    </View>
                    <View style={{ flex: 1, marginLeft: spacing.md }}>
                      <Text style={[typography.bodyM, { color: colors.textPrimary, fontWeight: '600', marginBottom: 2 }]}>
                        {achievement.title}
                      </Text>
                      <Text style={[typography.bodyM, { color: colors.textSecondary, fontSize: 12 }]}>
                        {achievement.description}
                      </Text>
                      {isUnlocked && achievement.unlockedAt && (
                        <Text style={[typography.bodyM, { color: colors.textMuted, fontSize: 11, marginTop: 4, letterSpacing: 0.3 }]}>
                          Achieved {format(new Date(achievement.unlockedAt), 'MMM d, yyyy')}
                        </Text>
                      )}
                    </View>
                    {isUnlocked && (
                      <AppIcon name="check" size={18} color={colors.success} />
                    )}
                  </View>
                </Card>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  scoreHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  scoreContent: {
    flex: 1,
    minWidth: 0,
    marginRight: 12,
  },
  scoreValue: {
    lineHeight: 56,
    includeFontPadding: false,
  },
  scoreBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreMetrics: {
    flexDirection: 'row',
    gap: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chartContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 120,
    gap: 4,
  },
  barWrapper: {
    flex: 1,
  },
  barColumn: {
    alignItems: 'center',
  },
  barTrack: {
    width: '100%',
    height: 100,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 6,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  bar: {
    width: '100%',
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
  },
  achievementRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  achievementIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
