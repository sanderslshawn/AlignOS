import React, { useEffect, useRef } from 'react';
import { View, Animated, Easing, ViewStyle } from 'react-native';

type Variant = 'full' | 'micro';

interface Props {
  size?: number;
  animated?: boolean;
  variant?: Variant;
  style?: ViewStyle;
}

const COLOR = '#E6EDF3';

export default function AlignOSLogoAnimation({ size = 48, animated = true, variant = 'full', style }: Props) {
  const scaleFactor = size / 48;
  const strokeWidth = Math.max(2, Math.round(3 * scaleFactor));

  // initial offsets (pixels) per spec, scaled for size
  const leftInitX = (variant === 'micro' ? -3 : -6) * scaleFactor;
  const leftInitY = (variant === 'micro' ? 2 : 4) * scaleFactor;
  const rightInitX = (variant === 'micro' ? 3 : 6) * scaleFactor;
  const rightInitY = (variant === 'micro' ? -2 : -4) * scaleFactor;
  const crossInitY = (variant === 'micro' ? 3 : 6) * scaleFactor;

  const animLeftX = useRef(new Animated.Value(animated ? leftInitX : 0)).current;
  const animLeftY = useRef(new Animated.Value(animated ? leftInitY : 0)).current;
  const animRightX = useRef(new Animated.Value(animated ? rightInitX : 0)).current;
  const animRightY = useRef(new Animated.Value(animated ? rightInitY : 0)).current;
  const animCrossY = useRef(new Animated.Value(animated ? crossInitY : 0)).current;
  const animScale = useRef(new Animated.Value(1)).current;
  const animOpacity = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    if (!animated) return;

    const alignDuration = variant === 'micro' ? 120 : 140;
    const pulseDuration = 120;

    const alignAnim = Animated.parallel([
      Animated.timing(animLeftX, { toValue: 0, duration: alignDuration, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(animLeftY, { toValue: 0, duration: alignDuration, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(animRightX, { toValue: 0, duration: alignDuration, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(animRightY, { toValue: 0, duration: alignDuration, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(animCrossY, { toValue: 0, duration: alignDuration, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(animOpacity, { toValue: 1, duration: alignDuration, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]);

    const pulse = Animated.sequence([
      Animated.timing(animScale, { toValue: 1.02, duration: pulseDuration / 2, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(animScale, { toValue: 1, duration: pulseDuration / 2, easing: Easing.in(Easing.quad), useNativeDriver: true }),
    ]);

    const full = variant === 'micro' ? Animated.sequence([Animated.delay(50), alignAnim]) : Animated.sequence([Animated.delay(50), alignAnim, Animated.delay(20), pulse]);

    full.start();

    return () => full.stop();
  }, [animated, variant, animLeftX, animLeftY, animRightX, animRightY, animCrossY, animScale, animOpacity]);

  // geometry
  const legHeight = size * 0.9;
  const legInset = size * 0.18;
  const crossWidth = size * 0.52;

  return (
    <Animated.View
      style={[
        { width: size, height: size, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' },
        style,
        { transform: [{ scale: animScale }], opacity: animOpacity },
      ]}
    >
      {/* left stroke */}
      <Animated.View
        style={{
          position: 'absolute',
          left: legInset,
          bottom: size * 0.05,
          width: strokeWidth,
          height: legHeight,
          backgroundColor: COLOR,
          transform: [{ translateX: animLeftX }, { translateY: animLeftY }, { rotate: '-18deg' }],
          borderRadius: strokeWidth / 2,
        }}
      />

      {/* right stroke */}
      <Animated.View
        style={{
          position: 'absolute',
          right: legInset,
          bottom: size * 0.05,
          width: strokeWidth,
          height: legHeight,
          backgroundColor: COLOR,
          transform: [{ translateX: animRightX }, { translateY: animRightY }, { rotate: '18deg' }],
          borderRadius: strokeWidth / 2,
        }}
      />

      {/* crossbar */}
      <Animated.View
        style={{
          position: 'absolute',
          width: crossWidth,
          height: strokeWidth,
          backgroundColor: COLOR,
          transform: [{ translateY: animCrossY }],
          borderRadius: strokeWidth / 2,
        }}
      />
    </Animated.View>
  );
}
