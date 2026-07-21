import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Pressable,
  Text,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { cn } from '@/lib/cn';
import { useAppTheme } from '@/theme/useAppTheme';

type Variant = 'primary' | 'secondary' | 'success' | 'danger' | 'ghost';
type Size = 'md' | 'lg';

interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}

const text: Record<Variant, string> = {
  primary: 'text-white',
  secondary: 'text-ink',
  success: 'text-white',
  danger: 'text-danger',
  ghost: 'text-primary',
};

const sizes: Record<Size, string> = {
  md: 'h-12',
  lg: 'h-14',
};

export function Button({
  label,
  icon,
  variant = 'primary',
  size = 'lg',
  loading = false,
  disabled,
  className,
  style,
  onPressIn,
  onPressOut,
  ...rest
}: ButtonProps & { className?: string }) {
  const { palette, isDark } = useAppTheme();
  const isDisabled = disabled || loading;
  const isVisuallyDisabled = Boolean(disabled) && !loading;
  const isPrimaryAction = variant === 'primary' || variant === 'success';
  const isSurfaceAction = variant === 'secondary' || variant === 'danger';
  const surfaceColor = isDark ? '#202329' : '#F0F1F3';
  const surfaceBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(18,24,32,0.07)';
  const activeBackgroundColor = isPrimaryAction
    ? palette.primary
    : isSurfaceAction
      ? surfaceColor
      : 'transparent';
  const backgroundColor = isVisuallyDisabled
    ? isPrimaryAction
      ? isDark
        ? '#5A3022'
        : '#F6C8B7'
      : isSurfaceAction
        ? surfaceColor
        : 'transparent'
    : activeBackgroundColor;
  const borderColor = isPrimaryAction
    ? isVisuallyDisabled
      ? isDark
        ? 'rgba(255,255,255,0.07)'
        : 'rgba(157,92,71,0.12)'
      : 'rgba(255,255,255,0.18)'
    : isSurfaceAction
      ? surfaceBorder
      : 'transparent';
  const activeForeground =
    variant === 'primary' || variant === 'success'
      ? '#FFFFFF'
      : variant === 'danger'
        ? palette.danger
        : variant === 'ghost'
          ? palette.primary
          : palette.ink;
  const foreground = isVisuallyDisabled
    ? isPrimaryAction
      ? isDark
        ? '#B69A8F'
        : '#9D5C47'
      : palette.inkMuted
    : activeForeground;
  const reduceMotion = useReducedMotion();
  const pressedScale = useSharedValue(1);
  const animatedScale = useAnimatedStyle(() => ({
    transform: [{ scale: pressedScale.value }],
  }));

  const handlePressIn: NonNullable<PressableProps['onPressIn']> = (event) => {
    pressedScale.value = reduceMotion ? 1 : withTiming(0.965, { duration: 70 });
    onPressIn?.(event);
  };

  const handlePressOut: NonNullable<PressableProps['onPressOut']> = (event) => {
    pressedScale.value = reduceMotion
      ? 1
      : withSpring(1, { damping: 17, stiffness: 280, mass: 0.55 });
    onPressOut?.(event);
  };

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      className={cn(
        'relative w-full items-center justify-center active:opacity-85',
        sizes[size],
        className,
      )}
      style={[
        {
          borderRadius: 18,
        },
        style,
      ]}
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
            borderRadius: 18,
            borderWidth: variant === 'ghost' ? 0 : 1,
            borderColor,
            backgroundColor,
            shadowColor: isPrimaryAction ? palette.primary : '#000',
            shadowOpacity: isVisuallyDisabled || variant === 'ghost' ? 0 : isPrimaryAction ? 0.2 : 0.08,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 6 },
            elevation: isVisuallyDisabled || variant === 'ghost' ? 0 : 3,
          },
          animatedScale,
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
          animatedScale,
        ]}>
        {loading ? (
          <ActivityIndicator color={foreground} />
        ) : (
          <>
            {icon ? <Ionicons name={icon} size={20} color={foreground} /> : null}
            <Text
              className={cn('text-base font-bold', !isVisuallyDisabled && text[variant])}
              style={isVisuallyDisabled ? { color: foreground } : undefined}>
              {label}
            </Text>
          </>
        )}
      </Animated.View>
    </Pressable>
  );
}
