import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

export interface HighlightRect {
  x: number;
  y: number;
  width: number;
  height: number;
  borderRadius?: number;
}

export const highlightEnergyForecast = (): HighlightRect => ({ x: 24, y: 24, width: 280, height: 96, borderRadius: 16 });
export const highlightAnchors = (): HighlightRect => ({ x: 24, y: 136, width: 280, height: 88, borderRadius: 16 });
export const highlightSignalsPanel = (): HighlightRect => ({ x: 24, y: 236, width: 280, height: 88, borderRadius: 16 });
export const highlightTimelineNow = (): HighlightRect => ({ x: 24, y: 336, width: 280, height: 98, borderRadius: 16 });
export const highlightMomentumInsights = (): HighlightRect => ({ x: 24, y: 448, width: 280, height: 84, borderRadius: 16 });

interface HighlightOverlayProps {
  visible: boolean;
  target: HighlightRect;
}

export default function HighlightOverlay({ visible, target }: HighlightOverlayProps) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 950, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 950, useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [pulse, visible]);

  if (!visible) return null;

  const { x, y, width, height, borderRadius = 14 } = target;
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });
  const glow = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.8] });

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[styles.mask, { left: 0, right: 0, top: 0, height: y }]} />
      <View style={[styles.mask, { left: 0, top: y, width: x, height }]} />
      <View style={[styles.mask, { left: x + width, top: y, right: 0, height }]} />
      <View style={[styles.mask, { left: 0, right: 0, top: y + height, bottom: 0 }]} />

      <Animated.View
        style={[
          styles.ring,
          {
            left: x,
            top: y,
            width,
            height,
            borderRadius,
            transform: [{ scale }],
            opacity: glow,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  mask: {
    position: 'absolute',
    backgroundColor: 'rgba(0, 0, 0, 0.56)',
  },
  ring: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#22D3EE',
    shadowColor: '#22D3EE',
    shadowOpacity: 0.5,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
});
