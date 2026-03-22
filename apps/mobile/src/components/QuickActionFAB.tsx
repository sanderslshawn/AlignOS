/**
 * Floating Action Button
 * Quick access to AI chat from any screen
 */

import React, { useRef } from 'react';
import { TouchableOpacity, StyleSheet, Animated, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { hapticMedium } from '../ui/utils/haptics';
import { AppIcon } from '../ui/components/AppIcon';
import { Colors } from '../ui/theme/colors';
import { Shadows } from '../ui/theme/shadows';

interface QuickActionFABProps {
  onPress: () => void;
}

export default function QuickActionFAB({ onPress }: QuickActionFABProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const insets = useSafeAreaInsets();

  const handlePress = () => {
    hapticMedium();

    // Scale animation
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.9,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 3,
        useNativeDriver: true,
      }),
    ]).start();

    onPress();
  };

  return (
    <Animated.View style={[
      styles.container,
      { bottom: insets.bottom + 16 },
      {
        transform: [{ scale: scaleAnim }],
      },
    ]}>
      <TouchableOpacity
        style={styles.button}
        onPress={handlePress}
        activeOpacity={0.8}
      >
        <AppIcon name="brain" size={24} color={Colors.Background} />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 24,
    zIndex: 1000,
  },
  button: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.AccentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.lg,
  },
});
