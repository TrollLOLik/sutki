import { useEffect, useRef, useState } from 'react';
import {
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  interpolate,
  interpolateColor,
  useReducedMotion,
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { AppIcon, type AppIconName } from '@/components/ui/AppIcon';
import { PressableScale } from '@/components/ui/PressableScale';
import { useSelectionProgress } from '@/components/ui/useSelectionProgress';
import { pressMotion, selectionMotion } from '@/theme/tokens';
import { useAppTheme } from '@/theme/useAppTheme';

export type IconButtonTone = 'neutral' | 'primary' | 'danger';
export type IconButtonSurface = 'material' | 'floating' | 'bare';

export interface IconButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  icon: AppIconName;
  iconSize?: number;
  size?: number;
  tone?: IconButtonTone;
  selected?: boolean;
  filled?: boolean;
  surface?: IconButtonSurface;
  style?: StyleProp<ViewStyle>;
}

export function IconButton({
  icon,
  iconSize = 22,
  size = 44,
  tone = 'neutral',
  selected = false,
  filled = false,
  surface = 'material',
  disabled,
  style,
  onPressIn,
  onPressOut,
  ...rest
}: IconButtonProps) {
  const { palette, isDark } = useAppTheme();
  const toneColor =
    tone === 'primary' ? palette.primary : tone === 'danger' ? palette.danger : palette.inkSecondary;
  const foreground = filled ? '#FFFFFF' : toneColor;
  const baseBackgroundColor = surface === 'floating'
    ? palette.surface
    : surface === 'bare'
      ? 'transparent'
    : isDark
      ? '#202329'
      : '#F0F1F3';
  const borderColor =
    surface === 'floating'
      ? palette.line
      : surface === 'bare'
        ? 'transparent'
      : isDark
        ? 'rgba(255,255,255,0.08)'
        : 'rgba(18,24,32,0.07)';
  const reduceMotion = useReducedMotion();
  const [pressed, setPressed] = useState(false);
  const selection = useSelectionProgress(selected && !filled, 'spring');
  const pressProgress = useSharedValue(0);
  const pulse = useSharedValue(1);
  const previousSelected = useRef(selected);

  useEffect(() => {
    if (selected && !previousSelected.current && !reduceMotion) {
      pulse.value = withSequence(
        withSpring(1.14, { ...selectionMotion.spring, overshootClamping: false }),
        withSpring(1, selectionMotion.spring),
      );
    } else if (reduceMotion) {
      pulse.value = 1;
    }
    previousSelected.current = selected;
  }, [pulse, reduceMotion, selected]);

  useEffect(() => {
    pressProgress.value = reduceMotion
      ? 0
      : pressed
        ? withTiming(1, { duration: 65 })
        : withSpring(0, pressMotion.spring);
  }, [pressProgress, pressed, reduceMotion]);
  const surfaceStyle = useAnimatedStyle(() => ({
    backgroundColor: filled
      ? toneColor
      : interpolateColor(
          selection.value,
          [0, 1],
          [baseBackgroundColor, palette.primaryLight],
        ),
  }));
  const shellStyle = useAnimatedStyle(() => ({
    shadowOpacity: surface === 'floating'
      ? interpolate(pressProgress.value, [0, 1], [0.1, 0.025])
      : 0,
    shadowRadius: surface === 'floating'
      ? interpolate(pressProgress.value, [0, 1], [6, 2])
      : 0,
    shadowOffset: {
      width: 0,
      height: surface === 'floating' ? interpolate(pressProgress.value, [0, 1], [2, 0.5]) : 0,
    },
    elevation: surface === 'floating' ? interpolate(pressProgress.value, [0, 1], [3, 1]) : 0,
  }));
  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(selection.value, [0, 1], [1, 1.07]) * pulse.value }],
  }));

  const handlePressIn: NonNullable<PressableProps['onPressIn']> = (event) => {
    setPressed(true);
    onPressIn?.(event);
  };
  const handlePressOut: NonNullable<PressableProps['onPressOut']> = (event) => {
    setPressed(false);
    onPressOut?.(event);
  };

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled), selected }}
      disabled={Boolean(disabled)}
      hitSlop={6}
      motionVariant="compact"
      pressedScale={0.94}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          opacity: disabled ? 0.42 : 1,
          flexShrink: 0,
          shadowColor: '#1A1A1A',
        },
        style,
      ]}
      {...rest}>
      <Animated.View
        style={[
          {
            width: '100%',
            height: '100%',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: size / 2,
            borderWidth: 1,
            borderColor,
            shadowColor: '#1A1A1A',
          },
          surfaceStyle,
          shellStyle,
        ]}>
        <Animated.View style={iconStyle}>
          <AppIcon name={icon} size={iconSize} color={foreground} />
        </Animated.View>
      </Animated.View>
    </PressableScale>
  );
}
