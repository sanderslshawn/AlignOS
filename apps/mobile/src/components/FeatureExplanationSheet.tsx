import React, { useEffect, useRef } from 'react';
import { Animated, Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon, useTheme } from '@physiology-engine/ui';
import type { FeatureExplanation } from '../screens/welcomeHelpers';

interface FeatureExplanationSheetProps {
  visible: boolean;
  feature: FeatureExplanation | null;
  onClose: () => void;
}

export default function FeatureExplanationSheet({ visible, feature, onClose }: FeatureExplanationSheetProps) {
  const { colors, typography, spacing, radius, shadows } = useTheme();
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(24)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;

    slideAnim.setValue(24);
    opacityAnim.setValue(0);
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 260,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 240,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible, opacityAnim, slideAnim]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />

        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surfaceElevated,
              borderColor: colors.borderSubtle,
              borderRadius: radius.lg,
              paddingBottom: insets.bottom + spacing.lg,
              transform: [{ translateY: slideAnim }],
              opacity: opacityAnim,
            },
            shadows.md,
          ]}
        >
          <View style={styles.dragHandleWrap}>
            <View style={[styles.dragHandle, { backgroundColor: colors.border }]} />
          </View>

          <View style={[styles.headerRow, { paddingHorizontal: spacing.lg, marginBottom: spacing.md }]}> 
            <View style={styles.headerLeft}>
              <AppIcon name={feature?.icon || 'sparkles'} size={18} color={colors.textSecondary} />
              <Text style={[typography.titleM, { color: colors.textPrimary, marginLeft: spacing.sm }]}> 
                {feature?.title || 'Feature'}
              </Text>
            </View>

            <TouchableOpacity onPress={onClose} accessibilityRole="button" style={styles.closeButton}>
              <AppIcon name="close" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={{ maxHeight: 340 }}
            contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}
            showsVerticalScrollIndicator={false}
          >
            <Text style={[typography.bodyM, { color: colors.textSecondary }]}>
              {feature?.description}
            </Text>

            <View style={{ marginTop: spacing.md }}>
              {(feature?.bullets || []).map((bullet) => (
                <View key={bullet} style={[styles.bulletRow, { marginBottom: spacing.sm }]}> 
                  <AppIcon name="sparkles" size={12} color={colors.textMuted} />
                  <Text style={[typography.bodyM, { color: colors.textSecondary, marginLeft: spacing.sm, flex: 1 }]}> 
                    {bullet}
                  </Text>
                </View>
              ))}
            </View>

            <Text style={[typography.bodyM, { color: colors.textPrimary, marginTop: spacing.xs }]}> 
              {feature?.closing}
            </Text>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  sheet: {
    borderWidth: 1,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    overflow: 'hidden',
  },
  dragHandleWrap: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 4,
  },
  dragHandle: {
    width: 42,
    height: 4,
    borderRadius: 999,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
