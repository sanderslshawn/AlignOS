import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Card, SectionTitle, useTheme } from '@physiology-engine/ui';

interface FaqItem {
  question: string;
  answer: string;
}

const FAQ_ITEMS: FaqItem[] = [
  {
    question: 'Why does AlignOS recommend adjustments?',
    answer: 'Because your day state changes. Adjustments keep execution realistic and protect momentum instead of forcing an outdated plan.',
  },
  {
    question: 'Do I need to follow the schedule exactly?',
    answer: 'No. Aim for directional consistency. AlignOS is adaptive and will help you recover if timing drifts.',
  },
  {
    question: 'What happens if I ignore recommendations?',
    answer: 'Nothing breaks. You may see lower momentum or more energy wobble, and AlignOS will continue proposing next-best options.',
  },
  {
    question: 'Why does meal timing matter?',
    answer: 'Meal timing influences energy stability and afternoon dips. Better spacing usually improves focus and consistency.',
  },
  {
    question: 'Will AlignOS learn my patterns?',
    answer: 'Yes. It learns timing tendencies over days and uses them to improve forecast confidence and scheduling relevance.',
  },
  {
    question: 'Why does the Energy Forecast change?',
    answer: 'Forecasts update with new context like sleep quality, stress, timeline changes, and signal inputs.',
  },
  {
    question: 'How does AlignOS predict energy dips?',
    answer: 'It combines anchor timing, known rhythm patterns, and current context to estimate likely dip windows.',
  },
  {
    question: 'Can AlignOS adapt if my day changes?',
    answer: 'Yes. Use refresh-from-now and signals to recompute only what matters next, while preserving useful structure.',
  },
];

export default function FaqScreen() {
  const { colors, typography, spacing } = useTheme();

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xl }}>
      <SectionTitle title="FAQs" subtitle="Answers to common trust and usage questions" />

      {FAQ_ITEMS.map((item) => (
        <View key={item.question} style={{ marginTop: spacing.md }}>
          <Card>
            <Text style={[typography.bodyM, { color: colors.textPrimary, fontWeight: '700' }]}>{item.question}</Text>
            <Text style={[typography.caption, { color: colors.textSecondary, marginTop: spacing.xs, lineHeight: 20 }]}>{item.answer}</Text>
          </Card>
        </View>
      ))}
    </ScrollView>
  );
}
