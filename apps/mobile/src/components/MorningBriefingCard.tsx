import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AppIcon, Card, SectionTitle, useTheme } from '@physiology-engine/ui';
import type { MorningBriefingOutput } from '../utils/morningBriefing';

interface MorningBriefingCardProps {
  briefing: MorningBriefingOutput;
  onPrimaryAction: () => void;
}

export default function MorningBriefingCard({ briefing, onPrimaryAction }: MorningBriefingCardProps) {
  const { colors, typography, spacing } = useTheme();

  return (
    <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
      <Card>
        <View style={styles.headerRow}>
          <AppIcon name="sunrise" size={16} color={colors.textPrimary} />
          <SectionTitle title="Morning Briefing" />
        </View>

        <View style={styles.sectionsWrap}>
          {briefing.sections.map((section) => (
            <View key={section.label} style={[styles.sectionItem, { borderColor: colors.borderSubtle, backgroundColor: colors.surface }]}> 
              <View style={styles.sectionTitleRow}>
                <AppIcon name={section.icon} size={12} color={colors.textMuted} />
                <Text style={[typography.caption, { color: colors.textMuted, marginLeft: spacing.xs }]} numberOfLines={1}>
                  {section.label}
                </Text>
              </View>
              <Text style={[typography.bodyM, { color: colors.textPrimary, marginTop: 4, fontWeight: '600' }]} numberOfLines={1}>
                {section.value}
              </Text>
            </View>
          ))}
        </View>

        <View style={[styles.bestMoveRow, { marginTop: spacing.md }]}> 
          <AppIcon name="sparkles" size={14} color={colors.accentPrimary} />
          <Text style={[typography.caption, { color: colors.textSecondary, marginLeft: spacing.sm, flex: 1 }]} numberOfLines={2}>
            {briefing.bestMove}
          </Text>
        </View>

        <TouchableOpacity
          onPress={onPrimaryAction}
          style={[styles.primaryAction, { backgroundColor: colors.accentPrimary, marginTop: spacing.md }]}
          accessibilityRole="button"
        >
          <Text style={[typography.bodyM, { color: colors.background, fontWeight: '700' }]}> 
            {briefing.primaryActionLabel}
          </Text>
        </TouchableOpacity>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionsWrap: {
    gap: 8,
  },
  sectionItem: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bestMoveRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  primaryAction: {
    minHeight: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
});
