import { Ionicons } from '@expo/vector-icons';
import {
  TouchableOpacity,
  type StyleProp,
  type TouchableOpacityProps,
  type ViewStyle,
} from 'react-native';

import { useAppTheme } from '@/theme/useAppTheme';

type IconButtonTone = 'neutral' | 'primary' | 'danger';

interface IconButtonProps extends Omit<TouchableOpacityProps, 'children' | 'style'> {
  icon: keyof typeof Ionicons.glyphMap;
  iconSize?: number;
  size?: number;
  tone?: IconButtonTone;
  selected?: boolean;
  filled?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Circular touch target with immediate press feedback and theme-aware depth. */
export function IconButton({
  icon,
  iconSize = 22,
  size = 44,
  tone = 'neutral',
  selected = false,
  filled = false,
  disabled,
  style,
  ...rest
}: IconButtonProps) {
  const { palette, isDark } = useAppTheme();
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
    <TouchableOpacity
      accessibilityRole="button"
      activeOpacity={0.76}
      disabled={disabled}
      hitSlop={6}
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor,
          borderWidth: 1,
          borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(18,24,32,0.07)',
          opacity: disabled ? 0.42 : 1,
          flexShrink: 0,
        },
        style,
      ]}
      {...rest}>
      <Ionicons name={icon} size={iconSize} color={foreground} />
    </TouchableOpacity>
  );
}
