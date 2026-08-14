import {
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { AppIcon, type AppIconName } from '@/components/ui/AppIcon';
import { PressableScale } from '@/components/ui/PressableScale';
import { useAppTheme } from '@/theme/useAppTheme';

type IconButtonTone = 'neutral' | 'primary' | 'danger';

export interface IconButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  icon: AppIconName;
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
          borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(18,24,32,0.07)',
          backgroundColor,
        }}>
        <AppIcon name={icon} size={iconSize} color={foreground} />
      </View>
    </PressableScale>
  );
}
