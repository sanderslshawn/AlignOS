import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Card, SectionTitle, useTheme } from '@physiology-engine/ui';

interface SectionBlock {
  title: string;
  body: string;
}

const SECTIONS: SectionBlock[] = [
  {
    title: 'What AlignOS Is',
    body: 'AlignOS is a daily decision system. It helps you know what to do next, not just what to plan in theory. It translates your day context into clear actions you can execute.',
  },
  {
    title: 'How Your Day Is Built',
    body: 'Your day starts with anchors like wake, meals, and sleep. AlignOS builds around these anchors so your schedule remains stable even when meetings and tasks move.',
  },
  {
    title: 'Your Energy Rhythm',
    body: 'Energy is not flat across the day. AlignOS predicts likely peaks and dips so you can place focus work and recovery at better times.',
  },
  {
    title: 'Your Anchors',
    body: 'Anchors are dependable timing points that protect consistency. These include wake time, meal timing, movement windows, and sleep start.',
  },
  {
    title: 'The Adaptive Timeline',
    body: 'When real life changes your day, AlignOS adapts the timeline from now. Instead of restarting everything, it preserves momentum and updates the next best steps.',
  },
  {
    title: 'Signals and Adjustments',
    body: 'Signals like low energy, stress, poor sleep, or mental fog trigger targeted adjustments. The system proposes small inserts and timing shifts to stabilize the day quickly.',
  },
  {
    title: 'Predictive Planning',
    body: 'AlignOS also helps with tomorrow. It projects likely focus windows, dip periods, and best opportunities so you start the next day with fewer decisions.',
  },
];

export default function HowAlignOSWorksScreen() {
  const { colors, typography, spacing } = useTheme();

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xl }}>
      <SectionTitle title="How AlignOS Works" subtitle="Plain-language explanation of the system" />

      {SECTIONS.map((section) => (
        <View key={section.title} style={{ marginTop: spacing.md }}>
          <Card>
            <Text style={[typography.bodyM, { color: colors.textPrimary, fontWeight: '700' }]}>{section.title}</Text>
            <Text style={[typography.caption, { color: colors.textSecondary, marginTop: spacing.xs, lineHeight: 20 }]}>{section.body}</Text>
          </Card>
        </View>
      ))}
    </ScrollView>
  );
}
