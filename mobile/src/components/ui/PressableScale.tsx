import { useState } from 'react';
import {
  Animated,
  Pressable,
  type PressableProps,
} from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import {
  pressMotion,
  type PressMotionVariant,
} from '@/theme/tokens';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface PressableScaleProps
  extends Omit<PressableProps, 'style'> {
  style?: PressableProps['style'];
  motionVariant?: PressMotionVariant;
  pressedScale?: number;
  pressedOpacity?: number;
  disabledOpacity?: number;
}

export function PressableScale({
  motionVariant,
  pressedScale,
  pressedOpacity,
  disabledOpacity = 0.42,
  disabled = false,
  style,
  onPressIn,
  onPressOut,
  ...props
}: PressableScaleProps) {
  const reduceMotion = useReducedMotion();
  const [pressProgress] = useState(() => new Animated.Value(0));
  const variant = motionVariant ? pressMotion.variants[motionVariant] : null;
  const resolvedScale = pressedScale ?? variant?.scale ?? pressMotion.scale;
  const resolvedPressedOpacity = pressedOpacity ?? variant?.opacity ?? 1;
  const inDuration = variant?.inDuration ?? pressMotion.inDuration;

  const animateIn: NonNullable<PressableProps['onPressIn']> = (event) => {
    pressProgress.stopAnimation();
    if (reduceMotion) {
      pressProgress.setValue(0);
    } else {
      Animated.timing(pressProgress, {
        toValue: 1,
        duration: inDuration,
        useNativeDriver: true,
      }).start();
    }
    onPressIn?.(event);
  };

  const animateOut: NonNullable<PressableProps['onPressOut']> = (event) => {
    pressProgress.stopAnimation();
    if (reduceMotion) {
      pressProgress.setValue(0);
    } else {
      Animated.spring(pressProgress, {
        toValue: 0,
        ...pressMotion.spring,
        useNativeDriver: true,
      }).start();
    }
    onPressOut?.(event);
  };

  const scale = pressProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, resolvedScale],
  });
  const pressedAnimatedOpacity = pressProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, resolvedPressedOpacity],
  });
  const animationStyle = {
    opacity: disabled ? disabledOpacity : pressedAnimatedOpacity,
    transform: [{ scale }],
  };

  // AnimatedPressable does not reliably resolve a style callback on Android.
  // Keep the overwhelmingly common static path as a plain style array so
  // explicit width/height constraints cannot be lost during measurement.
  const resolvedStyle: PressableProps['style'] = typeof style === 'function'
    ? (state) => [style(state), animationStyle]
    : [style, animationStyle];

  return (
    <AnimatedPressable
      disabled={disabled}
      onPressIn={animateIn}
      onPressOut={animateOut}
      style={resolvedStyle}
      {...props}
    />
  );
}
