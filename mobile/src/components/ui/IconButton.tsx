import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  Animated,
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useAppTheme } from '@/theme/useAppTheme';
import { ComponentMarker } from '@/components/debug/ComponentMarker';

type IconButtonTone = 'neutral' | 'primary' | 'danger';

export interface IconButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  icon: keyof typeof Ionicons.glyphMap;
  iconSize?: number;
  size?: number;
  tone?: IconButtonTone;
  selected?: boolean;
  filled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function IconButton({
  icon,
  iconSize = 22,
  size = 44,
  tone = 'neutral',
  selected = false,
  filled = false,
  disabled,
  style,
  onPressIn,
  onPressOut,
  ...rest
}: IconButtonProps) {
  const { palette, isDark } = useAppTheme();
  const [scale] = useState(() => new Animated.Value(1));
  const toneColor =
    tone === 'primary' ? palette.primary : tone === 'danger' ? palette.danger : palette.inkSecondary;
  const foreground = filled ? '#FFFFFF' : toneColor;
  const backgroundColor = filled
    ? toneColor
    : selected
      ? palette.primaryLight
      : isDark
        ? '#202329'
        : '#F0F1F3';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled), selected }}
      disabled={Boolean(disabled)}
      hitSlop={6}
      onPressIn={(event) => {
        Animated.timing(scale, {
          toValue: 0.94,
          duration: 70,
          useNativeDriver: true,
        }).start();
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        Animated.spring(scale, {
          toValue: 1,
          damping: 17,
          stiffness: 300,
          mass: 0.5,
          useNativeDriver: true,
        }).start();
        onPressOut?.(event);
      }}
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          opacity: disabled ? 0.42 : 1,
          flexShrink: 0,
        },
        style,
      ]}
      {...rest}>
      <ComponentMarker kind="icon" name="IconButton" />
      <Animated.View
        style={[
          {
            width: '100%',
            height: '100%',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: size / 2,
            borderWidth: 1,
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(18,24,32,0.07)',
            backgroundColor,
          },
          { transform: [{ scale }] },
        ]}>
        <Ionicons name={icon} size={iconSize} color={foreground} />
      </Animated.View>
    </Pressable>
  );
}
