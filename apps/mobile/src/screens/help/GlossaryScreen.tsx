import React, { useMemo, useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { Card, SectionTitle, useTheme } from '@physiology-engine/ui';
import { GLOSSARY_TERMS } from '../../data/glossaryTerms';

interface GlossaryScreenProps {
  initialTerm?: string;
}

export default function GlossaryScreen({ initialTerm }: GlossaryScreenProps) {
  const { colors, typography, spacing, radius } = useTheme();
  const [query, setQuery] = useState(initialTerm || '');

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return GLOSSARY_TERMS;

    return GLOSSARY_TERMS.filter((entry) =>
      entry.term.toLowerCase().includes(normalized) ||
      entry.explanation.toLowerCase().includes(normalized) ||
      entry.example?.toLowerCase().includes(normalized)
    );
  }, [query]);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xl }}>
      <SectionTitle title="Glossary" subtitle="Search key terms and plain-language definitions" />

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search terms"
        placeholderTextColor={colors.textMuted}
        style={{
          borderWidth: 1,
          borderColor: colors.borderSubtle,
          backgroundColor: colors.surface,
          borderRadius: radius.md,
          color: colors.textPrimary,
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.sm,
          marginTop: spacing.sm,
          marginBottom: spacing.md,
        }}
      />

      {filtered.map((entry) => (
        <View key={entry.term} style={{ marginBottom: spacing.sm }}>
          <Card>
            <Text style={[typography.bodyM, { color: colors.textPrimary, fontWeight: '700' }]}>{entry.term}</Text>
            <Text style={[typography.caption, { color: colors.textSecondary, marginTop: spacing.xs, lineHeight: 20 }]}>{entry.explanation}</Text>
            {entry.example ? (
              <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs }]}>Example: {entry.example}</Text>
            ) : null}
          </Card>
        </View>
      ))}

      {filtered.length === 0 ? (
        <Card>
          <Text style={[typography.caption, { color: colors.textMuted }]}>No matches found. Try a broader search term.</Text>
        </Card>
      ) : null}
    </ScrollView>
  );
}
