/**
 * Energy Forecast Component
 * Predicts energy levels throughout the day based on circadian rhythms
 */

import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { format, addHours, isBefore, isAfter, isWithinInterval } from 'date-fns';
import type { DayPlan, UserProfile } from '@physiology-engine/shared';

interface EnergyForecastProps {
  profile: UserProfile;
  plan?: DayPlan;
}

interface EnergyPoint {
  hour: number;
  energy: number; // 0-100
  label: string;
}

export default function EnergyForecast({ profile, plan }: EnergyForecastProps) {
  const forecast = generateEnergyForecast(profile, plan);
  const currentHour = new Date().getHours();
  const currentEnergy = forecast.find(p => p.hour === currentHour)?.energy || 50;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>⚡ Energy Forecast</Text>
        <View style={styles.currentEnergyBadge}>
          <Text style={styles.currentEnergyText}>Now: {currentEnergy}%</Text>
        </View>
      </View>

      {/* Energy curve visualization */}
      <View style={styles.chartContainer}>
        <View style={styles.chart}>
          {forecast.map((point, index) => {
            const isCurrent = point.hour === currentHour;
            const height = point.energy;
            const isLow = height < 40;
            const isHigh = height > 70;

            return (
              <View key={point.hour} style={styles.barContainer}>
                <View style={[styles.barWrapper, { height: 100 }]}>
                  <LinearGradient
                    colors={
                      isLow ? ['#FF6B6B', '#FF8E53'] :
                      isHigh ? ['#00ff88', '#14967F'] :
                      ['#667EEA', '#764BA2']
                    }
                    style={[
                      styles.bar,
                      {
                        height: `${height}%`,
                        opacity: isCurrent ? 1 : 0.7,
                      },
                    ]}
                  />
                  {isCurrent && (
                    <View style={styles.currentIndicator}>
                      <View style={styles.currentDot} />
                    </View>
                  )}
                </View>
                {(point.hour % 3 === 0) && (
                  <Text style={styles.hourLabel}>
                    {format(new Date().setHours(point.hour, 0, 0, 0), 'ha')}
                  </Text>
                )}
              </View>
            );
          })}
        </View>
      </View>

      {/* Key insights */}
      <View style={styles.insights}>
        {getEnergyInsights(forecast, currentHour, profile).map((insight, i) => (
          <View key={i} style={styles.insight}>
            <Text style={styles.insightIcon}>{insight.icon}</Text>
            <Text style={styles.insightText}>{insight.text}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/**
 * Generate hour-by-hour energy forecast based on circadian biology
 */
function generateEnergyForecast(profile: UserProfile, plan?: DayPlan): EnergyPoint[] {
  const points: EnergyPoint[] = [];
  const wakeTime = profile.wakeTime ? parseInt(profile.wakeTime.split(':')[0]) : 7;
  const sleepTime = profile.sleepTime ? parseInt(profile.sleepTime.split(':')[0]) : 23;
  
  for (let hour = 0; hour < 24; hour++) {
    let energy = 50; // baseline

    // Circadian rhythm curve
    if (hour >= wakeTime && hour < sleepTime) {
      // Awake hours
      const hoursAwake = hour - wakeTime;
      
      // Morning rise (cortisol awakening response)
      if (hoursAwake < 2) {
        energy = 50 + (hoursAwake * 15); // Gradual rise
      }
      // Mid-morning peak
      else if (hoursAwake >= 2 && hoursAwake < 5) {
        energy = 80 + (Math.random() * 10);
      }
      // Post-lunch dip (natural circadian trough)
      else if (hoursAwake >= 5 && hoursAwake < 7) {
        energy = 55 - ((hoursAwake - 5) * 5); // Dip to ~45%
      }
      // Afternoon recovery
      else if (hoursAwake >= 7 && hoursAwake < 10) {
        energy = 45 + ((hoursAwake - 7) * 10); // Rise to ~75%
      }
      // Evening plateau
      else if (hoursAwake >= 10 && hoursAwake < 12) {
        energy = 75 - ((hoursAwake - 10) * 5);
      }
      // Pre-sleep decline (melatonin rise)
      else {
        energy = Math.max(30, 65 - ((hoursAwake - 12) * 15));
      }
    } else {
      // Sleep hours - very low energy
      energy = 10 + (Math.random() * 10);
    }

    // Adjust based on planned activities
    if (plan?.items) {
      plan.items.forEach(item => {
        const itemHour = new Date(item.startISO).getHours();
        
        if (itemHour === hour) {
          // Workout boosts energy for next few hours
          if (item.type === 'workout') {
            for (let i = 0; i < 3; i++) {
              const futureHour = (hour + i) % 24;
              const boost = 15 - (i * 5);
              // Store boost for later
            }
          }
          
          // Walks provide mild sustained boost
          if (item.type === 'walk') {
            energy += 5;
          }
          
          // Heavy meals slightly decrease energy temporarily
          if (item.type === 'meal' && hour >= 12 && hour < 15) {
            energy -= 5;
          }
        }
      });
    }

    // Fitness goal adjustments
    const goal = profile.fitnessGoal || 'MAINTENANCE';
    if (goal === 'FAT_LOSS' || goal === 'WEIGHT_LOSS') {
      // Calorie deficit can reduce energy slightly
      energy -= 5;
    } else if (goal === 'PERFORMANCE') {
      // Well-fueled athletes have higher baseline
      energy += 5;
    }

    energy = Math.max(10, Math.min(95, energy));

    points.push({
      hour,
      energy: Math.round(energy),
      label: format(new Date().setHours(hour, 0, 0, 0), 'ha'),
    });
  }

  return points;
}

/**
 * Generate actionable insights from energy forecast
 */
function getEnergyInsights(
  forecast: EnergyPoint[],
  currentHour: number,
  profile: UserProfile
): Array<{ icon: string; text: string }> {
  const insights: Array<{ icon: string; text: string }> = [];
  
  // Peak energy time
  const peakPoint = forecast.reduce((max, p) => p.energy > max.energy ? p : max, forecast[0]);
  insights.push({
    icon: '🌟',
    text: `Peak energy at ${format(new Date().setHours(peakPoint.hour, 0, 0, 0), 'h a')} - schedule important work then`,
  });

  // Energy dip warning
  const dipPoints = forecast.filter(p => p.energy < 50 && p.hour >= 12 && p.hour < 18);
  if (dipPoints.length > 0) {
    insights.push({
      icon: '⚠️',
      text: `Natural dip 2-4pm - plan lighter tasks or take a power nap`,
    });
  }

  // Current energy status
  const currentEnergy = forecast.find(p => p.hour === currentHour)?.energy || 50;
  if (currentEnergy > 70) {
    insights.push({
      icon: '💪',
      text: `High energy now - ideal for challenging work or training`,
    });
  } else if (currentEnergy < 40) {
    insights.push({
      icon: '😴',
      text: `Low energy detected - consider movement, hydration, or brief rest`,
    });
  }

  // Sleep timing
  const wakeTime = profile.wakeTime ? parseInt(profile.wakeTime.split(':')[0]) : 7;
  if (currentHour >= 22 || currentHour < 6) {
    insights.push({
      icon: '🌙',
      text: `Wind down for sleep - avoid screens and bright lights`,
    });
  }

  return insights;
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0a0a0a',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 24,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: '#1a1a1a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  currentEnergyBadge: {
    backgroundColor: '#14967F',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  currentEnergyText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  chartContainer: {
    marginBottom: 16,
  },
  chart: {
    flexDirection: 'row',
    height: 100,
    alignItems: 'flex-end',
    gap: 2,
  },
  barContainer: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  barWrapper: {
    width: '100%',
    justifyContent: 'flex-end',
    position: 'relative',
  },
  bar: {
    width: '100%',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    minHeight: 10,
  },
  currentIndicator: {
    position: 'absolute',
    top: -10,
    left: '50%',
    marginLeft: -4,
  },
  currentDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00ff88',
    shadowColor: '#00ff88',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  hourLabel: {
    fontSize: 10,
    color: '#666',
  },
  insights: {
    gap: 12,
  },
  insight: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  insightIcon: {
    fontSize: 16,
  },
  insightText: {
    flex: 1,
    fontSize: 13,
    color: '#ccc',
    lineHeight: 20,
  },
});
