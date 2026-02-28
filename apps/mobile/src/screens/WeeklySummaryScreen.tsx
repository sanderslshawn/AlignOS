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
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

export default function WeeklySummaryScreen() {
  const { todayEntries } = usePlanStore();
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
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Analyzing your week...</Text>
        </View>
      </View>
    );
  }
  
  const getRatingColor = (rating: number): [string, string, string] => {
    if (rating >= 90) return ['#00ff88', '#14967F', '#0a7a5a'];
    if (rating >= 75) return ['#00b4d8', '#0077b6', '#03045e'];
    if (rating >= 60) return ['#ffd60a', '#ffb703', '#fb8500'];
    return ['#ff6b6b', '#ee5a6f', '#c44569'];
  };
  
  const ratingGradient = getRatingColor(summary.weekRating);
  
  return (
    <View style={styles.container}>
      {/* Header with Overall Rating */}
      <LinearGradient
        colors={ratingGradient}
        style={styles.headerGradient}
      >
        <Text style={styles.headerTitle}>📊 Weekly Summary</Text>
        <Text style={styles.weekRange}>
          {summary.weekStart} to {summary.weekEnd}
        </Text>
        
        <View style={styles.ratingCircle}>
          <Text style={styles.ratingNumber}>{summary.weekRating}</Text>
          <Text style={styles.ratingLabel}>/ 100</Text>
        </View>
        
        <Text style={styles.completionText}>
          {summary.completionRate}% Activity Completion
        </Text>
      </LinearGradient>
      
      <ScrollView style={styles.scrollView}>
        {/* Achievements */}
        {summary.achievements.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🏆 Achievements</Text>
            {summary.achievements.map((achievement, index) => (
              <View key={index} style={styles.achievementCard}>
                <Text style={styles.achievementText}>{achievement}</Text>
              </View>
            ))}
          </View>
        )}
        
        {/* Stats Grid */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📈 Statistics</Text>
          
          {/* Meals */}
          <View style={styles.statCard}>
            <Text style={styles.statCardTitle}>🍽️ Meal Timing</Text>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>On Time</Text>
              <Text style={styles.statValue}>
                {summary.mealStats.onTime}/{summary.mealStats.total}
              </Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Avg Delay</Text>
              <Text style={styles.statValue}>{summary.mealStats.averageDelay} min</Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Skipped</Text>
              <Text style={[styles.statValue, summary.mealStats.skipped > 2 && styles.statWarning]}>
                {summary.mealStats.skipped}
              </Text>
            </View>
          </View>
          
          {/* Workouts */}
          <View style={styles.statCard}>
            <Text style={styles.statCardTitle}>💪 Workouts</Text>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Completed</Text>
              <Text style={styles.statValue}>
                {summary.workoutStats.completed}/{summary.workoutStats.total}
              </Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Total Time</Text>
              <Text style={styles.statValue}>{summary.workoutStats.totalMinutes} min</Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Avg Intensity</Text>
              <Text style={styles.statValue}>{summary.workoutStats.averageIntensity}</Text>
            </View>
          </View>
          
          {/* Walks */}
          <View style={styles.statCard}>
            <Text style={styles.statCardTitle}>🚶 Walks</Text>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Completed</Text>
              <Text style={styles.statValue}>
                {summary.walkStats.completed}/{summary.walkStats.total}
              </Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Post-Meal</Text>
              <Text style={styles.statValue}>{summary.walkStats.postMealWalks}</Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Total Time</Text>
              <Text style={styles.statValue}>{summary.walkStats.totalMinutes} min</Text>
            </View>
          </View>
          
          {/* Sleep */}
          <View style={styles.statCard}>
            <Text style={styles.statCardTitle}>😴 Sleep</Text>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Avg Hours</Text>
              <Text style={styles.statValue}>{summary.sleepStats.averageHours.toFixed(1)}h</Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Bedtime</Text>
              <Text style={styles.statValue}>{summary.sleepStats.averageBedtime}</Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Consistency</Text>
              <Text style={styles.statValue}>{summary.sleepStats.consistency}%</Text>
            </View>
          </View>
          
          {/* Habits */}
          {summary.habitStats.totalHabits > 0 && (
            <View style={styles.statCard}>
              <Text style={styles.statCardTitle}>📋 Habits</Text>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Total Tracked</Text>
                <Text style={styles.statValue}>{summary.habitStats.totalHabits}</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Completion</Text>
                <Text style={styles.statValue}>{summary.habitStats.averageCompletionRate}%</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Top Habit</Text>
                <Text style={[styles.statValue, { fontSize: 13 }]}>
                  {summary.habitStats.topHabit}
                </Text>
              </View>
            </View>
          )}
        </View>
        
        {/* Energy Insights */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⚡ Energy Insights</Text>
          <View style={styles.energyCard}>
            <View style={styles.energyRow}>
              <Text style={styles.energyLabel}>🌅 Morning</Text>
              <View style={styles.energyBar}>
                <View
                  style={[
                    styles.energyFill,
                    { width: `${summary.energyInsights.averageMorningEnergy}%` },
                    { backgroundColor: '#00ff88' },
                  ]}
                />
              </View>
              <Text style={styles.energyValue}>{summary.energyInsights.averageMorningEnergy}%</Text>
            </View>
            <View style={styles.energyRow}>
              <Text style={styles.energyLabel}>☀️ Afternoon</Text>
              <View style={styles.energyBar}>
                <View
                  style={[
                    styles.energyFill,
                    { width: `${summary.energyInsights.averageAfternoonEnergy}%` },
                    { backgroundColor: '#ffd60a' },
                  ]}
                />
              </View>
              <Text style={styles.energyValue}>
                {summary.energyInsights.averageAfternoonEnergy}%
              </Text>
            </View>
            <View style={styles.energyRow}>
              <Text style={styles.energyLabel}>🌙 Evening</Text>
              <View style={styles.energyBar}>
                <View
                  style={[
                    styles.energyFill,
                    { width: `${summary.energyInsights.averageEveningEnergy}%` },
                    { backgroundColor: '#9d4edd' },
                  ]}
                />
              </View>
              <Text style={styles.energyValue}>{summary.energyInsights.averageEveningEnergy}%</Text>
            </View>
            <Text style={styles.peakWindow}>
              🎯 Peak Performance: {summary.energyInsights.peakPerformanceWindow}
            </Text>
          </View>
        </View>
        
        {/* Areas for Improvement */}
        {summary.areasForImprovement.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📈 Areas for Improvement</Text>
            {summary.areasForImprovement.map((area, index) => (
              <View key={index} style={styles.improvementCard}>
                <Text style={styles.improvementText}>{area}</Text>
              </View>
            ))}
          </View>
        )}
        
        {/* Next Week Recommendations */}
        {recommendations.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>💡 Next Week Recommendations</Text>
            {recommendations.map((rec, index) => (
              <View key={index} style={styles.recommendationCard}>
                <Text style={styles.recommendationText}>{rec}</Text>
              </View>
            ))}
          </View>
        )}
        
        {/* Share Button */}
        <TouchableOpacity
          style={styles.shareButton}
          onPress={handleShare}
        >
          <LinearGradient
            colors={['#00ff88', '#14967F', '#0a7a5a']}
            style={styles.shareGradient}
          >
            <Text style={styles.shareButtonText}>🚀 Share Your Week</Text>
          </LinearGradient>
        </TouchableOpacity>
        
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#888',
    fontSize: 16,
  },
  headerGradient: {
    padding: 24,
    paddingTop: 60,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 4,
  },
  weekRange: {
    fontSize: 14,
    color: '#0a7a5a',
    marginBottom: 20,
  },
  ratingCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 16,
  },
  ratingNumber: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#000',
  },
  ratingLabel: {
    fontSize: 16,
    color: '#0a7a5a',
  },
  completionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginTop: 8,
  },
  scrollView: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  achievementCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#00ff88',
  },
  achievementText: {
    color: '#fff',
    fontSize: 15,
    lineHeight: 22,
  },
  statCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  statCardTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 15,
    color: '#888',
  },
  statValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#00ff88',
  },
  statWarning: {
    color: '#ff6b6b',
  },
  energyCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  energyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  energyLabel: {
    fontSize: 14,
    color: '#fff',
    width: 100,
  },
  energyBar: {
    flex: 1,
    height: 20,
    backgroundColor: '#333',
    borderRadius: 10,
    overflow: 'hidden',
    marginHorizontal: 12,
  },
  energyFill: {
    height: '100%',
    borderRadius: 10,
  },
  energyValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
    width: 40,
    textAlign: 'right',
  },
  peakWindow: {
    fontSize: 14,
    color: '#00ff88',
    fontWeight: '600',
    marginTop: 12,
    textAlign: 'center',
  },
  improvementCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#ffd60a',
  },
  improvementText: {
    color: '#fff',
    fontSize: 15,
    lineHeight: 22,
  },
  recommendationCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#00b4d8',
  },
  recommendationText: {
    color: '#fff',
    fontSize: 15,
    lineHeight: 22,
  },
  shareButton: {
    marginTop: 12,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#00ff88',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
  },
  shareGradient: {
    padding: 18,
    alignItems: 'center',
  },
  shareButtonText: {
    color: '#000',
    fontSize: 17,
    fontWeight: 'bold',
  },
});
