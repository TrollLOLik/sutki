import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { AppIcon, type AppIconName } from '@/components/ui/AppIcon';
import { AppText } from '@/components/ui/AppText';
import { PressableScale } from '@/components/ui/PressableScale';
import { cn } from '@/lib/cn';
import { pressMotion } from '@/theme/tokens';
import { useAppTheme } from '@/theme/useAppTheme';

export type ButtonVariant = 'primary' | 'secondary' | 'success' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';
export type ButtonMode = 'solid' | 'outline' | 'soft' | 'ghost';
export type ButtonTone = 'primary' | 'neutral' | 'danger' | 'success' | 'warning';

export interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  label: string;
  icon?: AppIconName;
  startIcon?: AppIconName;
  endIcon?: AppIconName;
  variant?: ButtonVariant;
  mode?: ButtonMode;
  tone?: ButtonTone;
  size?: ButtonSize;
  stretched?: boolean;
  loading?: boolean;
  success?: boolean;
  successLabel?: string;
  style?: StyleProp<ViewStyle>;
  className?: string;
}

const sizes: Record<ButtonSize, { height: number; radius: number; fontSize: number; iconSize: number }> = {
  sm: { height: 42, radius: 14, fontSize: 14, iconSize: 18 },
  md: { height: 48, radius: 16, fontSize: 15, iconSize: 19 },
  lg: { height: 56, radius: 18, fontSize: 16, iconSize: 20 },
};

function legacyAppearance(variant: ButtonVariant): { mode: ButtonMode; tone: ButtonTone } {
  switch (variant) {
    case 'secondary':
      return { mode: 'soft', tone: 'neutral' };
    case 'success':
      return { mode: 'solid', tone: 'primary' };
    case 'danger':
      return { mode: 'soft', tone: 'danger' };
    case 'ghost':
      return { mode: 'ghost', tone: 'primary' };
    default:
      return { mode: 'solid', tone: 'primary' };
  }
}

export function Button({
  label,
  icon,
  startIcon,
  endIcon,
  variant = 'primary',
  mode,
  tone,
  size = 'lg',
  stretched = true,
  loading = false,
  success = false,
  successLabel,
  disabled,
  className,
  style,
  onPressIn,
  onPressOut,
  ...rest
}: ButtonProps) {
  const { palette, isDark } = useAppTheme();
  const fallback = legacyAppearance(variant);
  const resolvedMode = mode ?? fallback.mode;
  const resolvedTone = tone ?? fallback.tone;
  const metrics = sizes[size];
  const leadingIcon = startIcon ?? icon;
  const isDisabled = Boolean(disabled || loading || success);
  const reduceMotion = useReducedMotion();
  const [pressed, setPressed] = useState(false);
  const pressProgress = useSharedValue(0);
  const stateProgress = useSharedValue(success ? 2 : loading ? 1 : 0);

  useEffect(() => {
    const target = success ? 2 : loading ? 1 : 0;
    stateProgress.value = reduceMotion
      ? target
      : withTiming(target, {
          duration: 180,
          easing: Easing.out(Easing.cubic),
        });
  }, [loading, reduceMotion, stateProgress, success]);

  useEffect(() => {
    pressProgress.value = reduceMotion
      ? 0
      : pressed
        ? withTiming(1, { duration: 75 })
        : withSpring(0, pressMotion.spring);
  }, [pressProgress, pressed, reduceMotion]);

  const toneColor =
    resolvedTone === 'danger'
      ? palette.danger
      : resolvedTone === 'success'
        ? palette.success
        : resolvedTone === 'warning'
          ? palette.star
          : resolvedTone === 'neutral'
            ? palette.ink
            : palette.primary;
  const toneLight =
    resolvedTone === 'danger'
      ? palette.dangerLight
      : resolvedTone === 'success'
        ? palette.successLight
        : resolvedTone === 'warning'
          ? isDark
            ? '#332B16'
            : '#FFF7DE'
          : resolvedTone === 'neutral'
            ? palette.surfaceMuted
            : palette.primaryLight;

  const solidNeutral = resolvedMode === 'solid' && resolvedTone === 'neutral';
  const backgroundColor =
    resolvedMode === 'solid'
      ? solidNeutral
        ? palette.ink
        : toneColor
      : resolvedMode === 'soft'
        ? toneLight
        : resolvedMode === 'outline'
          ? palette.surface
          : 'transparent';
  const foreground =
    resolvedMode === 'solid'
      ? solidNeutral
        ? palette.surface
        : '#FFFFFF'
      : toneColor;
  const borderColor =
    resolvedMode === 'outline'
      ? toneColor
      : resolvedMode === 'soft'
        ? resolvedTone === 'neutral'
          ? palette.line
          : toneLight
        : resolvedMode === 'solid'
          ? 'rgba(255,255,255,0.18)'
          : 'transparent';
  const elevated = resolvedMode === 'solid' && resolvedTone !== 'neutral' && !isDisabled;
  const shellStyle = useAnimatedStyle(() => ({
    shadowOpacity: elevated ? interpolate(pressProgress.value, [0, 1], [0.2, 0.06]) : 0,
    shadowRadius: elevated ? interpolate(pressProgress.value, [0, 1], [12, 3]) : 0,
    shadowOffset: {
      width: 0,
      height: elevated ? interpolate(pressProgress.value, [0, 1], [6, 1]) : 0,
    },
    elevation: elevated ? interpolate(pressProgress.value, [0, 1], [3, 1]) : 0,
  }));
  const idleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(stateProgress.value, [0, 0.7], [1, 0], Extrapolation.CLAMP),
    transform: [
      { translateY: interpolate(stateProgress.value, [0, 1], [0, -4], Extrapolation.CLAMP) },
      { scale: interpolate(stateProgress.value, [0, 1], [1, 0.96], Extrapolation.CLAMP) },
    ],
  }));
  const loadingStyle = useAnimatedStyle(() => ({
    opacity: interpolate(stateProgress.value, [0, 0.7, 1, 1.35, 2], [0, 0, 1, 0, 0], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(stateProgress.value, [0, 1, 2], [0.9, 1, 0.9], Extrapolation.CLAMP) }],
  }));
  const successStyle = useAnimatedStyle(() => ({
    opacity: interpolate(stateProgress.value, [1.3, 2], [0, 1], Extrapolation.CLAMP),
    transform: [
      { translateY: interpolate(stateProgress.value, [1, 2], [4, 0], Extrapolation.CLAMP) },
      { scale: interpolate(stateProgress.value, [1, 2], [0.94, 1], Extrapolation.CLAMP) },
    ],
  }));

  const handlePressIn: NonNullable<PressableProps['onPressIn']> = (event) => {
    setPressed(true);
    onPressIn?.(event);
  };
  const handlePressOut: NonNullable<PressableProps['onPressOut']> = (event) => {
    setPressed(false);
    onPressOut?.(event);
  };

  const stateLayer = {
    position: 'absolute' as const,
    left: 14,
    right: 14,
    top: 0,
    bottom: 0,
    minWidth: 0,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
  };

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading || undefined }}
      disabled={isDisabled}
      disabledOpacity={1}
      motionVariant="control"
      pressedScale={0.965}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      className={cn(
        'relative min-w-0 items-center justify-center',
        stretched && 'w-full',
        className,
      )}
      style={[{ height: metrics.height, borderRadius: metrics.radius }, style]}
      {...rest}>
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            borderRadius: metrics.radius,
            borderWidth: resolvedMode === 'ghost' ? 0 : 1,
            borderColor,
            backgroundColor,
            opacity: isDisabled ? 0.48 : 1,
            shadowColor: elevated ? toneColor : '#000000',
          },
          shellStyle,
        ]}
      />
      <Animated.View pointerEvents="none" style={[stateLayer, idleStyle, { opacity: isDisabled && !loading && !success ? 0.64 : undefined }]}>
        {leadingIcon ? <AppIcon name={leadingIcon} size={metrics.iconSize} color={foreground} /> : null}
        <AppText
          variant="button"
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.82}
          style={{ minWidth: 0, flexShrink: 1, color: foreground, fontSize: metrics.fontSize, fontWeight: '800' }}>
          {label}
        </AppText>
        {endIcon ? <AppIcon name={endIcon} size={metrics.iconSize} color={foreground} /> : null}
      </Animated.View>
      <Animated.View pointerEvents="none" style={[stateLayer, loadingStyle]}>
        <ActivityIndicator color={foreground} />
      </Animated.View>
      <Animated.View pointerEvents="none" style={[stateLayer, successStyle]}>
        <AppIcon name="checkmark" size={metrics.iconSize} color={foreground} />
        <AppText
          variant="button"
          numberOfLines={1}
          style={{ minWidth: 0, flexShrink: 1, color: foreground, fontSize: metrics.fontSize, fontWeight: '800' }}>
          {successLabel ?? label}
        </AppText>
      </Animated.View>
    </PressableScale>
  );
}
