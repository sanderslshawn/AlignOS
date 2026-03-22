import React from 'react';
import { Modal, Pressable, Text, TouchableOpacity, View } from 'react-native';
import { AppIcon, useTheme } from '@physiology-engine/ui';

interface WhyThisModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  explanation: string;
}

export default function WhyThisModal({ visible, onClose, title, explanation }: WhyThisModalProps) {
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
              <AppIcon name="sparkles" size={16} color={colors.accentPrimary} />
              <Text style={[typography.bodyM, { color: colors.textPrimary, fontWeight: '700', marginLeft: spacing.xs }]}>Why this?</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Text style={[typography.caption, { color: colors.textMuted }]}>Close</Text>
            </TouchableOpacity>
          </View>

          <Text style={[typography.caption, { color: colors.textPrimary, marginTop: spacing.sm, fontWeight: '700' }]}>{title}</Text>
          <Text style={[typography.caption, { color: colors.textSecondary, marginTop: spacing.xs, lineHeight: 20 }]}>{explanation}</Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
