import {
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { AppIcon, type AppIconName } from '@/components/ui/AppIcon';
import { PressableScale } from '@/components/ui/PressableScale';
import { useAppTheme } from '@/theme/useAppTheme';

export type IconButtonTone = 'neutral' | 'primary' | 'danger';
export type IconButtonSurface = 'material' | 'floating';

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
      : surface === 'floating'
        ? palette.surface
        : isDark
          ? '#202329'
          : '#F0F1F3';
  const borderColor =
    surface === 'floating'
      ? palette.line
      : isDark
        ? 'rgba(255,255,255,0.08)'
        : 'rgba(18,24,32,0.07)';

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled), selected }}
      disabled={Boolean(disabled)}
      hitSlop={6}
      pressedScale={0.94}
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          opacity: disabled ? 0.42 : 1,
          flexShrink: 0,
          ...(surface === 'floating'
            ? {
                shadowColor: '#1A1A1A',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 6,
                elevation: 3,
              }
            : null),
        },
        style,
      ]}
      {...rest}>
      <View
        style={{
          width: '100%',
          height: '100%',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: size / 2,
          borderWidth: 1,
          borderColor,
          backgroundColor,
        }}>
        <AppIcon name={icon} size={iconSize} color={foreground} />
      </View>
    </PressableScale>
  );
}
