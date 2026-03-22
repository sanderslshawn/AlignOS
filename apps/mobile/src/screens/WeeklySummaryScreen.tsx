import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Share,
} from 'react-native';
import { usePlanStore } from '../store/planStore';
import { useHabitStore } from '../store/habitStore';
import { 
  generateWeeklySummary, 
  formatWeeklySummaryForSharing,
  generateNextWeekRecommendations,
  type WeeklySummary 
} from '../utils/weeklySummary';
import * as Haptics from 'expo-haptics';
import { useTheme, Card, SectionTitle, StatRow, PrimaryButton, Chip, AppIcon, formatPercent, formatNumber } from '@physiology-engine/ui';

export default function WeeklySummaryScreen() {
  const { todayEntries } = usePlanStore();
  const { colors, typography, spacing, radius } = useTheme();
  const [summary, setSummary] = useState<WeeklySummary | null>(null);
  const [recommendations, setRecommendations] = useState<string[]>([]);
  
  useEffect(() => {
    if (todayEntries.length > 0) {
      // TODO: Track completed schedule items properly
      const completedIds: string[] = [];
      generateWeeklySummary(todayEntries, completedIds).then((s) => {
        setSummary(s);
        setRecommendations(generateNextWeekRecommendations(s));
      });
    }
  }, [todayEntries]);
  
  const handleShare = async () => {
    if (!summary) return;
    
    const shareText = formatWeeklySummaryForSharing(summary);
    
    try {
      await Share.share({
        message: shareText,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Share error:', error);
    }
  };
  
  if (!summary) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <AppIcon name="chart" size={48} color={colors.textMuted} />
          <Text style={[typography.bodyL, { color: colors.textSecondary, marginTop: spacing.lg }]}>
            Analyzing your week...
          </Text>
        </View>
      </View>
    );
  }
  
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surfaceElevated, paddingHorizontal: spacing.lg }]}>
        <SectionTitle 
          title="Weekly Summary" 
          subtitle={`${summary.weekStart} to ${summary.weekEnd}`} 
        />
        
        <View style={styles.ratingContainer}>
          <View style={[
            styles.ratingCircle,
            {
              backgroundColor: colors.surface,
              borderColor: colors.accentPrimary,
            }
          ]}>
            <Text style={[typography.titleXL, { color: colors.textPrimary, fontSize: 42 }]}>
              {formatNumber(summary.weekRating)}
            </Text>
            <Text style={[typography.caption, { color: colors.textMuted }]}>
              / 100
            </Text>
          </View>
          
          <Text style={[typography.bodyM, { color: colors.textSecondary, marginTop: spacing.md }]}>
            {formatPercent(summary.completionRate)} Activity Completion
          </Text>
        </View>
      </View>
      
      <ScrollView style={styles.scrollView} contentContainerStyle={{ padding: spacing.lg }}>
        {/* Achievements */}
        {summary.achievements.length > 0 && (
          <View style={{ marginBottom: spacing.xl }}>
            <SectionTitle title="Achievements" />
            {summary.achievements.map((achievement, index) => (
              <Card key={index} style={{ marginBottom: spacing.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                  <AppIcon name="trophy" size={20} color={colors.accentPrimary} />
                  <Text style={[
                    typography.bodyM,
                    {
                      color: colors.textPrimary,
                      marginLeft: spacing.md,
                      flex: 1,
                      lineHeight: 22,
                    }
                  ]}>
                    {achievement}
                  </Text>
                </View>
              </Card>
            ))}
          </View>
        )}
        
        {/* Stats Grid */}
        <View style={{ marginBottom: spacing.xl }}>
          <SectionTitle title="Statistics" />
          
          {/* Meals */}
          <Card style={{ marginBottom: spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
              <AppIcon name="meal" size={20} color={colors.textSecondary} />
              <Text style={[typography.bodyL, { color: colors.textPrimary, marginLeft: spacing.sm, fontWeight: '600' }]}>
                Meal Timing
              </Text>
            </View>
            <StatRow label="On Time" value={`${summary.mealStats.onTime}/${summary.mealStats.total}`} />
            <StatRow label="Avg Delay" value={`${formatNumber(summary.mealStats.averageDelay)} min`} />
            <StatRow 
              label="Skipped" 
              value={formatNumber(summary.mealStats.skipped)}
            />
          </Card>
          
          {/* Workouts */}
          <Card style={{ marginBottom: spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
              <AppIcon name="workout" size={20} color={colors.textSecondary} />
              <Text style={[typography.bodyL, { color: colors.textPrimary, marginLeft: spacing.sm, fontWeight: '600' }]}>
                Workouts
              </Text>
            </View>
            <StatRow label="Completed" value={`${summary.workoutStats.completed}/${summary.workoutStats.total}`} />
            <StatRow label="Total Time" value={`${formatNumber(summary.workoutStats.totalMinutes)} min`} />
            <StatRow label="Avg Intensity" value={summary.workoutStats.averageIntensity} />
          </Card>
          
          {/* Walks */}
          <Card style={{ marginBottom: spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
              <AppIcon name="walk" size={20} color={colors.textSecondary} />
              <Text style={[typography.bodyL, { color: colors.textPrimary, marginLeft: spacing.sm, fontWeight: '600' }]}>
                Walks
              </Text>
            </View>
            <StatRow label="Completed" value={`${summary.walkStats.completed}/${summary.walkStats.total}`} />
            <StatRow label="Post-Meal" value={formatNumber(summary.walkStats.postMealWalks)} />
            <StatRow label="Total Time" value={`${formatNumber(summary.walkStats.totalMinutes)} min`} />
          </Card>
          
          {/* Sleep */}
          <Card style={{ marginBottom: spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
              <AppIcon name="sleep" size={20} color={colors.textSecondary} />
              <Text style={[typography.bodyL, { color: colors.textPrimary, marginLeft: spacing.sm, fontWeight: '600' }]}>
                Sleep
              </Text>
            </View>
            <StatRow label="Avg Hours" value={`${summary.sleepStats.averageHours.toFixed(1)}h`} />
            <StatRow label="Bedtime" value={summary.sleepStats.averageBedtime} />
            <StatRow label="Consistency" value={formatPercent(summary.sleepStats.consistency)} />
          </Card>
          
          {/* Habits */}
          {summary.habitStats.totalHabits > 0 && (
            <Card style={{ marginBottom: spacing.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
                <AppIcon name="check" size={20} color={colors.textSecondary} />
                <Text style={[typography.bodyL, { color: colors.textPrimary, marginLeft: spacing.sm, fontWeight: '600' }]}>
                  Habits
                </Text>
              </View>
              <StatRow label="Total Tracked" value={formatNumber(summary.habitStats.totalHabits)} />
              <StatRow label="Completion" value={formatPercent(summary.habitStats.averageCompletionRate)} />
              <StatRow label="Top Habit" value={summary.habitStats.topHabit} />
            </Card>
          )}
        </View>
        
        {/* Energy Insights */}
        <View style={{ marginBottom: spacing.xl }}>
          <SectionTitle title="Energy Insights" />
          <Card>
            <EnergyBar
              label="Morning"
              value={summary.energyInsights.averageMorningEnergy}
              icon="sun"
            />
            <EnergyBar
              label="Afternoon"
              value={summary.energyInsights.averageAfternoonEnergy}
              icon="sun"
            />
            <EnergyBar
              label="Evening"
              value={summary.energyInsights.averageEveningEnergy}
              icon="moon"
            />
            <View style={[
              styles.peakWindow,
              {
                backgroundColor: colors.accentSoft,
                borderRadius: radius.md,
                padding: spacing.md,
                marginTop: spacing.lg,
              }
            ]}>
              <AppIcon name="flame" size={16} color={colors.accentPrimary} />
              <Text style={[typography.bodyM, { color: colors.accentPrimary, marginLeft: spacing.sm, fontWeight: '600' }]}>
                Peak: {summary.energyInsights.peakPerformanceWindow}
              </Text>
            </View>
          </Card>
        </View>
        
        {/* Areas for Improvement */}
        {summary.areasForImprovement.length > 0 && (
          <View style={{ marginBottom: spacing.xl }}>
            <SectionTitle title="Areas for Improvement" />
            {summary.areasForImprovement.map((area, index) => (
              <Card key={index} style={{ marginBottom: spacing.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                  <AppIcon name="alert" size={20} color={colors.warning} />
                  <Text style={[
                    typography.bodyM,
                    {
                      color: colors.textPrimary,
                      marginLeft: spacing.md,
                      flex: 1,
                      lineHeight: 22,
                    }
                  ]}>
                    {area}
                  </Text>
                </View>
              </Card>
            ))}
          </View>
        )}
        
        {/* Next Week Recommendations */}
        {recommendations.length > 0 && (
          <View style={{ marginBottom: spacing.xl }}>
            <SectionTitle title="Next Week Recommendations" />
            {recommendations.map((rec, index) => (
              <Card key={index} style={{ marginBottom: spacing.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                  <AppIcon name="sparkles" size={20} color={colors.accentPrimary} />
                  <Text style={[
                    typography.bodyM,
                    {
                      color: colors.textPrimary,
                      marginLeft: spacing.md,
                      flex: 1,
                      lineHeight: 22,
                    }
                  ]}>
                    {rec}
                  </Text>
                </View>
              </Card>
            ))}
          </View>
        )}
        
        {/* Share Button */}
        <PrimaryButton onPress={handleShare}>
          Share Your Week
        </PrimaryButton>
        
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

function EnergyBar({ label, value, icon }: { label: string; value: number; icon: any }) {
  const { colors, typography, spacing, radius } = useTheme();
  
  return (
    <View style={{ marginBottom: spacing.md }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <AppIcon name={icon} size={14} color={colors.textSecondary} />
          <Text style={[typography.bodyS, { color: colors.textSecondary, marginLeft: spacing.xs }]}>
            {label}
          </Text>
        </View>
        <Text style={[typography.bodyS, { color: colors.textPrimary, fontWeight: '600' }]}>
          {formatPercent(value)}
        </Text>
      </View>
      <View style={[
        styles.energyBarTrack,
        {
          backgroundColor: colors.surface,
          borderRadius: radius.sm,
        }
      ]}>
        <View
          style={[
            styles.energyBarFill,
            {
              width: `${value}%`,
              backgroundColor: colors.accentPrimary,
              borderRadius: radius.sm,
            }
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingTop: 60,
    paddingBottom: 24,
  },
  ratingContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  ratingCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  energyBarTrack: {
    height: 8,
    overflow: 'hidden',
  },
  energyBarFill: {
    height: '100%',
  },
  peakWindow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
