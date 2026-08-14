import { useEffect, useRef, type ReactNode } from 'react';
import {
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useAppTheme } from '@/theme/useAppTheme';

export type FieldFrameSize = 'md' | 'lg';

export interface FieldFrameProps extends Omit<ViewProps, 'style'> {
  children: ReactNode;
  focused?: boolean;
  invalid?: boolean;
  multiline?: boolean;
  minHeight?: number;
  size?: FieldFrameSize;
  contentPaddingHorizontal?: number;
  style?: StyleProp<ViewStyle>;
}

export function FieldFrame({
  children,
  focused = false,
  invalid = false,
  multiline = false,
  minHeight,
  size = 'lg',
  contentPaddingHorizontal = 16,
  style,
  ...rest
}: FieldFrameProps) {
  const { palette } = useAppTheme();
  const reduceMotion = useReducedMotion();
  const focusProgress = useSharedValue(focused ? 1 : 0);
  const invalidProgress = useSharedValue(invalid ? 1 : 0);
  const shakeX = useSharedValue(0);
  const previousInvalid = useRef(invalid);
  const height = size === 'md' ? 48 : 56;
  const radius = size === 'md' ? 16 : 18;

  useEffect(() => {
    const duration = reduceMotion ? 0 : 170;
    focusProgress.value = withTiming(focused ? 1 : 0, {
      duration,
      easing: Easing.out(Easing.cubic),
    });
  }, [focusProgress, focused, reduceMotion]);

  useEffect(() => {
    const duration = reduceMotion ? 0 : 150;
    invalidProgress.value = withTiming(invalid ? 1 : 0, {
      duration,
      easing: Easing.out(Easing.cubic),
    });

    if (invalid && !previousInvalid.current && !reduceMotion) {
      shakeX.value = withSequence(
        withTiming(-3.5, { duration: 42 }),
        withTiming(3.5, { duration: 62 }),
        withTiming(-2, { duration: 52 }),
        withTiming(0, { duration: 70 }),
      );
    }
    previousInvalid.current = invalid;
  }, [invalid, invalidProgress, reduceMotion, shakeX]);

  const animatedStyle = useAnimatedStyle(() => {
    const focusedBorder = interpolateColor(
      focusProgress.value,
      [0, 1],
      [palette.line, palette.primary],
    );
    return {
      borderColor: interpolateColor(
        invalidProgress.value,
        [0, 1],
        [focusedBorder, palette.danger],
      ),
      shadowColor: invalidProgress.value > 0.01 ? palette.danger : palette.primary,
      shadowOpacity: interpolate(
        Math.max(focusProgress.value, invalidProgress.value),
        [0, 1],
        [0, 0.16],
      ),
      shadowRadius: interpolate(
        Math.max(focusProgress.value, invalidProgress.value),
        [0, 1],
        [0, 7],
      ),
      shadowOffset: { width: 0, height: 0 },
      elevation: Math.max(focusProgress.value, invalidProgress.value) > 0.01 ? 1 : 0,
      transform: [{ translateX: shakeX.value }],
    };
  });

  return (
    <Animated.View
      style={[
        {
          width: '100%',
          height: multiline ? undefined : height,
          minHeight: multiline ? (minHeight ?? height) : height,
          flexDirection: multiline ? 'column' : 'row',
          alignItems: multiline ? 'stretch' : 'center',
          overflow: 'hidden',
          borderRadius: radius,
          borderWidth: 1,
          backgroundColor: palette.surfaceMuted,
          paddingHorizontal: contentPaddingHorizontal,
        },
        animatedStyle,
        style,
      ]}
      {...rest}>
      {children}
    </Animated.View>
  );
}
