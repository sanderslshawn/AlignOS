import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Card, SectionTitle, useTheme } from '@physiology-engine/ui';

interface Guide {
  title: string;
  steps: string[];
}

const GUIDES: Guide[] = [
  {
    title: 'Getting Started',
    steps: ['Set wake, meal, and sleep anchors.', 'Build today once.', 'Use signals only when context changes.'],
  },
  {
    title: 'Understanding Energy Forecast',
    steps: ['Check expected peak and dip windows.', 'Place hard focus near peaks.', 'Use recovery actions before or during dips.'],
  },
  {
    title: 'Using Signals',
    steps: ['Activate only current signals.', 'Apply one recommendation first.', 'Recompute from now if drift continues.'],
  },
  {
    title: 'Stabilizing Your Energy',
    steps: ['Protect meal spacing.', 'Use short movement inserts.', 'Avoid stacking too many hard blocks.'],
  },
  {
    title: 'Planning Tomorrow',
    steps: ['Generate tomorrow preview.', 'Review predicted dip and focus windows.', 'Carry over only useful structure.'],
  },
  {
    title: 'Improving Momentum',
    steps: ['Prioritize next executable action.', 'Use micro-resets after disruptions.', 'Keep anchors steady for consistency.'],
  },
];

export default function GuidesScreen() {
  const { colors, typography, spacing } = useTheme();

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xl }}>
      <SectionTitle title="Guides" subtitle="Short playbooks for better execution" />

      {GUIDES.map((guide) => (
        <View key={guide.title} style={{ marginTop: spacing.md }}>
          <Card>
            <Text style={[typography.bodyM, { color: colors.textPrimary, fontWeight: '700' }]}>{guide.title}</Text>
            <View style={{ marginTop: spacing.xs }}>
              {guide.steps.map((step) => (
                <Text key={step} style={[typography.caption, { color: colors.textSecondary, marginBottom: 6 }]}>• {step}</Text>
              ))}
            </View>
          </Card>
        </View>
      ))}
    </ScrollView>
  );
}
