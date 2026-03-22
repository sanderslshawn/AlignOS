import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '@physiology-engine/ui';

interface TourStepProps {
  index: number;
  total: number;
  headline: string;
  description: string;
  onContinue: () => void;
  continueLabel?: string;
  onBack?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}

export default function TourStep({
  index,
  total,
  headline,
  description,
  onContinue,
  continueLabel = 'Continue',
  onBack,
  secondaryLabel,
  onSecondary,
}: TourStepProps) {
  const { colors, typography, spacing, radius } = useTheme();

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: colors.borderSubtle,
        backgroundColor: colors.surfaceElevated,
        borderRadius: radius.lg,
        padding: spacing.lg,
      }}
    >
      <Text style={[typography.caption, { color: colors.textMuted }]}>Step {index} of {total}</Text>
      <Text style={[typography.titleM, { color: colors.textPrimary, marginTop: spacing.xs }]}>{headline}</Text>
      <Text style={[typography.bodyM, { color: colors.textSecondary, marginTop: spacing.sm, lineHeight: 22 }]}>{description}</Text>

      <View style={{ flexDirection: 'row', marginTop: spacing.md, alignItems: 'center' }}>
        {onBack ? (
          <TouchableOpacity onPress={onBack} style={{ marginRight: spacing.md }}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>Back</Text>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity
          onPress={onContinue}
          style={{
            borderWidth: 1,
            borderColor: colors.accentPrimary,
            backgroundColor: colors.accentSoft,
            borderRadius: radius.md,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
          }}
        >
          <Text style={[typography.caption, { color: colors.accentPrimary, fontWeight: '700' }]}>{continueLabel}</Text>
        </TouchableOpacity>

        {secondaryLabel && onSecondary ? (
          <TouchableOpacity onPress={onSecondary} style={{ marginLeft: spacing.sm }}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>{secondaryLabel}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}
