import React, { useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useBiometricStore } from '../store/biometricStore';
import { haptics } from '../utils/haptics';

export default function BiometricsScreen() {
  const {
    currentHeartRate,
    sleepHistory,
    hrvHistory,
    recoveryScores,
    activityHistory,
    settings,
    lastSyncTime,
    getLatestSleep,
    getAverageHRV,
    getRecoveryTrend,
    getTodayActivity,
    startHeartRateMonitoring,
    stopHeartRateMonitoring,
    syncAllSources,
  } = useBiometricStore();
  
  useEffect(() => {
    // Auto-start heart rate monitoring if enabled
    if (settings.showRealTimeHR) {
      startHeartRateMonitoring();
    }
    
    return () => {
      stopHeartRateMonitoring();
    };
  }, [settings.showRealTimeHR]);
  
  const latestSleep = getLatestSleep();
  const avgHRV = getAverageHRV(7);
  const recoveryTrend = getRecoveryTrend(7);
  const todayActivity = getTodayActivity();
  const latestRecovery = recoveryScores[0];
  
  const handleSync = async () => {
    haptics.medium();
    await syncAllSources();
    haptics.success();
  };
  
  const handleToggleHRMonitoring = () => {
    haptics.light();
    if (currentHeartRate !== undefined) {
      stopHeartRateMonitoring();
    } else {
      startHeartRateMonitoring();
    }
  };
  
  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Health Dashboard</Text>
          <TouchableOpacity style={styles.syncButton} onPress={handleSync}>
            <Text style={styles.syncButtonText}>🔄 Sync</Text>
          </TouchableOpacity>
        </View>
        
        {lastSyncTime && (
          <Text style={styles.lastSync}>
            Last sync: {new Date(lastSyncTime).toLocaleTimeString()}
          </Text>
        )}
        
        {/* Real-time Heart Rate */}
        <TouchableOpacity
          style={styles.mainMetricCard}
          onPress={handleToggleHRMonitoring}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={currentHeartRate ? ['#ff6b6b', '#c92a2a'] : ['#222', '#111']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.mainMetricGradient}
          >
            <Text style={styles.mainMetricIcon}>🫀</Text>
            <Text style={styles.mainMetricLabel}>Heart Rate</Text>
            {currentHeartRate !== undefined ? (
              <>
                <Text style={styles.mainMetricValue}>{currentHeartRate}</Text>
                <Text style={styles.mainMetricUnit}>BPM • LIVE</Text>
              </>
            ) : (
              <Text style={styles.mainMetricPlaceholder}>Tap to monitor</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
        
        {/* Recovery Score */}
        {latestRecovery && (
          <View style={styles.recoveryCard}>
            <Text style={styles.sectionTitle}>💪 Recovery Score</Text>
            <View style={styles.recoveryContent}>
              <View style={styles.recoveryCircle}>
                <LinearGradient
                  colors={getRecoveryColors(latestRecovery.score)}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.recoveryCircleGradient}
                >
                  <Text style={styles.recoveryScore}>{latestRecovery.score}</Text>
                </LinearGradient>
              </View>
              
              <View style={styles.recoveryDetails}>
                <Text style={styles.recoveryRecommendation}>
                  {getRecommendationText(latestRecovery.recommendation)}
                </Text>
                <Text style={styles.recoveryTrend}>
                  Trend: {getTrendEmoji(recoveryTrend)} {recoveryTrend}
                </Text>
                
                <View style={styles.recoveryMetrics}>
                  <View style={styles.recoveryMetric}>
                    <Text style={styles.recoveryMetricLabel}>HRV</Text>
                    <Text style={styles.recoveryMetricValue}>{latestRecovery.hrv}ms</Text>
                  </View>
                  <View style={styles.recoveryMetric}>
                    <Text style={styles.recoveryMetricLabel}>RHR</Text>
                    <Text style={styles.recoveryMetricValue}>{latestRecovery.restingHeartRate} BPM</Text>
                  </View>
                  <View style={styles.recoveryMetric}>
                    <Text style={styles.recoveryMetricLabel}>Sleep</Text>
                    <Text style={styles.recoveryMetricValue}>{latestRecovery.sleepScore}</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        )}
        
        {/* Metrics Grid */}
        <View style={styles.metricsGrid}>
          {/* Sleep */}
          {latestSleep && (
            <MetricCard
              icon="😴"
              label="Sleep Quality"
              value={latestSleep.sleepScore.toString()}
              subtitle={`${Math.round(latestSleep.totalMinutes / 60)}h ${latestSleep.totalMinutes % 60}m`}
              color={getSleepColor(latestSleep.sleepScore)}
            />
          )}
          
          {/* HRV */}
          {avgHRV > 0 && (
            <MetricCard
              icon="💓"
              label="Avg HRV (7d)"
              value={Math.round(avgHRV).toString()}
              subtitle="ms"
              color="#22D3EE"
            />
          )}
          
          {/* Activity */}
          {todayActivity && (
            <MetricCard
              icon="👟"
              label="Steps Today"
              value={todayActivity.steps.toLocaleString()}
              subtitle={`${(todayActivity.distance / 1000).toFixed(1)}km`}
              color="#FFD700"
            />
          )}
          
          {/* Calories */}
          {todayActivity && (
            <MetricCard
              icon="🔥"
              label="Calories Burned"
              value={todayActivity.caloriesBurned.toString()}
              subtitle={`${todayActivity.activeMinutes}min active`}
              color="#FF6B6B"
            />
          )}
        </View>
        
        {/* Sleep Breakdown */}
        {latestSleep && (
          <View style={styles.sleepBreakdown}>
            <Text style={styles.sectionTitle}>😴 Sleep Breakdown</Text>
            
            <View style={styles.sleepStages}>
              <SleepStage
                label="Deep"
                minutes={latestSleep.deepMinutes}
                color="#4A90E2"
              />
              <SleepStage
                label="REM"
                minutes={latestSleep.remMinutes}
                color="#9B59B6"
              />
              <SleepStage
                label="Light"
                minutes={latestSleep.lightMinutes}
                color="#95A5A6"
              />
              <SleepStage
                label="Awake"
                minutes={latestSleep.awakeMinutes}
                color="#E74C3C"
              />
            </View>
            
            {/* Sleep Bar Chart */}
            <View style={styles.sleepBar}>
              {renderSleepBar(latestSleep)}
            </View>
          </View>
        )}
        
        {/* HRV History */}
        {hrvHistory.length > 0 && (
          <View style={styles.historyCard}>
            <Text style={styles.sectionTitle}>💓 HRV Trend (7 days)</Text>
            <View style={styles.miniChart}>
              {hrvHistory.slice(0, 7).reverse().map((hrv, index) => {
                const maxHRV = Math.max(...hrvHistory.slice(0, 7).map(h => h.value));
                const height = (hrv.value / maxHRV) * 100;
                return (
                  <View key={index} style={styles.chartBar}>
                    <View
                      style={[
                        styles.chartBarFill,
                        { height: `${height}%`, backgroundColor: '#22D3EE' },
                      ]}
                    />
                    <Text style={styles.chartBarLabel}>
                      {new Date(hrv.timestamp).getDate()}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}
        
        {/* Empty State */}
        {sleepHistory.length === 0 && hrvHistory.length === 0 && !todayActivity && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateIcon}>📊</Text>
            <Text style={styles.emptyStateText}>No biometric data yet</Text>
            <Text style={styles.emptyStateSubtext}>
              Connect a device or manually add data to see your health insights
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// Helper Components
function MetricCard({
  icon,
  label,
  value,
  subtitle,
  color,
}: {
  icon: string;
  label: string;
  value: string;
  subtitle: string;
  color: string;
}) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricIcon}>{icon}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, { color }]}>{value}</Text>
      <Text style={styles.metricSubtitle}>{subtitle}</Text>
    </View>
  );
}

function SleepStage({
  label,
  minutes,
  color,
}: {
  label: string;
  minutes: number;
  color: string;
}) {
  return (
    <View style={styles.sleepStage}>
      <View style={[styles.sleepStageColor, { backgroundColor: color }]} />
      <Text style={styles.sleepStageLabel}>{label}</Text>
      <Text style={styles.sleepStageValue}>{minutes}m</Text>
    </View>
  );
}

// Helper Functions
function getRecoveryColors(score: number): [string, string] {
  if (score >= 80) return ['#22D3EE', '#1E9BA9'];
  if (score >= 60) return ['#FFD700', '#FFA500'];
  if (score >= 40) return ['#FFA500', '#FF8C00'];
  return ['#ff6b6b', '#c92a2a'];
}

function getSleepColor(score: number): string {
  if (score >= 80) return '#22D3EE';
  if (score >= 60) return '#FFD700';
  if (score >= 40) return '#FFA500';
  return '#FF6B6B';
}

function getRecommendationText(rec: string): string {
  switch (rec) {
    case 'rest': return '🛌 Take a rest day';
    case 'light': return '🚶 Light activity only';
    case 'moderate': return '💪 Moderate training OK';
    case 'intense': return '🔥 Ready for intense training';
    default: return 'Unknown';
  }
}

function getTrendEmoji(trend: string): string {
  switch (trend) {
    case 'improving': return '📈';
    case 'declining': return '📉';
    default: return '➡️';
  }
}

function renderSleepBar(sleep: any) {
  const total = sleep.totalMinutes;
  const deep = (sleep.deepMinutes / total) * 100;
  const rem = (sleep.remMinutes / total) * 100;
  const light = (sleep.lightMinutes / total) * 100;
  const awake = (sleep.awakeMinutes / total) * 100;
  
  return (
    <>
      <View style={[styles.sleepBarSegment, { flex: deep, backgroundColor: '#4A90E2' }]} />
      <View style={[styles.sleepBarSegment, { flex: rem, backgroundColor: '#9B59B6' }]} />
      <View style={[styles.sleepBarSegment, { flex: light, backgroundColor: '#95A5A6' }]} />
      <View style={[styles.sleepBarSegment, { flex: awake, backgroundColor: '#E74C3C' }]} />
    </>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    paddingTop: 60,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#22D3EE',
  },
  syncButton: {
    backgroundColor: '#222',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#333',
  },
  syncButtonText: {
    color: '#22D3EE',
    fontSize: 14,
    fontWeight: '600',
  },
  lastSync: {
    color: '#666',
    fontSize: 13,
    paddingHorizontal: 24,
    marginTop: -12,
    marginBottom: 16,
  },
  mainMetricCard: {
    margin: 24,
    marginTop: 0,
    borderRadius: 20,
    overflow: 'hidden',
  },
  mainMetricGradient: {
    padding: 32,
    alignItems: 'center',
  },
  mainMetricIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  mainMetricLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  mainMetricValue: {
    color: '#fff',
    fontSize: 64,
    fontWeight: '700',
    lineHeight: 72,
  },
  mainMetricUnit: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  mainMetricPlaceholder: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 18,
    marginTop: 12,
  },
  recoveryCard: {
    backgroundColor: '#111',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#222',
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  recoveryContent: {
    flexDirection: 'row',
    gap: 20,
  },
  recoveryCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: 'hidden',
  },
  recoveryCircleGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recoveryScore: {
    color: '#fff',
    fontSize: 48,
    fontWeight: '700',
  },
  recoveryDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  recoveryRecommendation: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  recoveryTrend: {
    color: '#888',
    fontSize: 14,
    marginBottom: 12,
  },
  recoveryMetrics: {
    flexDirection: 'row',
    gap: 12,
  },
  recoveryMetric: {
    flex: 1,
  },
  recoveryMetricLabel: {
    color: '#666',
    fontSize: 11,
    marginBottom: 2,
  },
  recoveryMetricValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  metricCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#111',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#222',
  },
  metricIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  metricLabel: {
    color: '#888',
    fontSize: 12,
    marginBottom: 8,
    textAlign: 'center',
  },
  metricValue: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  metricSubtitle: {
    color: '#666',
    fontSize: 12,
  },
  sleepBreakdown: {
    backgroundColor: '#111',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#222',
  },
  sleepStages: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  sleepStage: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: '40%',
  },
  sleepStageColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  sleepStageLabel: {
    color: '#888',
    fontSize: 13,
    marginRight: 4,
  },
  sleepStageValue: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  sleepBar: {
    flexDirection: 'row',
    height: 24,
    borderRadius: 12,
    overflow: 'hidden',
  },
  sleepBarSegment: {
    height: '100%',
  },
  historyCard: {
    backgroundColor: '#111',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 24,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#222',
  },
  miniChart: {
    flexDirection: 'row',
    height: 100,
    gap: 8,
    alignItems: 'flex-end',
  },
  chartBar: {
    flex: 1,
    alignItems: 'center',
  },
  chartBarFill: {
    width: '100%',
    borderRadius: 4,
  },
  chartBarLabel: {
    color: '#666',
    fontSize: 10,
    marginTop: 4,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyStateIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyStateText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
  },
});
