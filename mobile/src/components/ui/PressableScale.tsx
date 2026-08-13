import { useState } from 'react';
import {
  Animated,
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { pressMotion } from '@/theme/tokens';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface PressableScaleProps
  extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>;
  pressedScale?: number;
  disabledOpacity?: number;
}

export function PressableScale({
  pressedScale = pressMotion.scale,
  disabledOpacity = 0.42,
  disabled = false,
  style,
  onPressIn,
  onPressOut,
  ...props
}: PressableScaleProps) {
  const reduceMotion = useReducedMotion();
  const [scale] = useState(() => new Animated.Value(1));

  const animateIn: NonNullable<PressableProps['onPressIn']> = (event) => {
    scale.stopAnimation();
    if (reduceMotion) {
      scale.setValue(1);
    } else {
      Animated.timing(scale, {
        toValue: pressedScale,
        duration: pressMotion.inDuration,
        useNativeDriver: true,
      }).start();
    }
    onPressIn?.(event);
  };

  const animateOut: NonNullable<PressableProps['onPressOut']> = (event) => {
    scale.stopAnimation();
    if (reduceMotion) {
      scale.setValue(1);
    } else {
      Animated.spring(scale, {
        toValue: 1,
        ...pressMotion.spring,
        useNativeDriver: true,
      }).start();
    }
    onPressOut?.(event);
  };

  return (
    <AnimatedPressable
      disabled={disabled}
      onPressIn={animateIn}
      onPressOut={animateOut}
      style={[
        style,
        {
          opacity: disabled ? disabledOpacity : 1,
          transform: [{ scale }],
        },
      ]}
      {...props}
    />
  );
}
