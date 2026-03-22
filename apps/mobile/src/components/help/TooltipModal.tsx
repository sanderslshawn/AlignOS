import React from 'react';
import { Modal, Pressable, Text, TouchableOpacity, View } from 'react-native';
import { AppIcon, useTheme } from '@physiology-engine/ui';

interface TooltipModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  description: string;
  example?: string;
}

export default function TooltipModal({ visible, onClose, title, description, example }: TooltipModalProps) {
  const { colors, typography, spacing, radius } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: colors.overlay,
          justifyContent: 'center',
          paddingHorizontal: spacing.lg,
        }}
      >
        <Pressable
          onPress={(event) => event.stopPropagation()}
          style={{
            borderWidth: 1,
            borderColor: colors.borderSubtle,
            backgroundColor: colors.surfaceElevated,
            borderRadius: radius.lg,
            padding: spacing.lg,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <AppIcon name="info" size={16} color={colors.accentPrimary} />
              <Text style={[typography.bodyM, { color: colors.textPrimary, fontWeight: '700', marginLeft: spacing.xs }]}>{title}</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Text style={[typography.caption, { color: colors.textMuted }]}>Close</Text>
            </TouchableOpacity>
          </View>

          <Text style={[typography.caption, { color: colors.textSecondary, marginTop: spacing.sm, lineHeight: 20 }]}>{description}</Text>
          {example ? (
            <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.sm }]}>Example: {example}</Text>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
