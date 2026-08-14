import type { StyleProp, ViewStyle } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { PressableScale, type PressableScaleProps } from '@/components/ui/PressableScale';
import { useAppTheme } from '@/theme/useAppTheme';

interface ChipProps extends Omit<PressableScaleProps, 'children' | 'style'> {
  label: string;
  selected?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Chip({ label, selected = false, style, ...pressableProps }: ChipProps) {
  const { palette } = useAppTheme();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ selected }}
      {...pressableProps}
      style={[
        {
          minHeight: 38,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 999,
          borderWidth: 1,
          paddingHorizontal: 16,
          backgroundColor: selected ? palette.primaryLight : palette.surfaceMuted,
          borderColor: selected ? palette.primary : palette.line,
        },
        style,
      ]}>
      <AppText
        variant="label"
        numberOfLines={1}
        ellipsizeMode="tail"
        style={{
          flexShrink: 1,
          fontSize: 14,
          fontWeight: selected ? '600' : '400',
          color: selected ? palette.primary : palette.inkSecondary,
        }}>
        {label}
      </AppText>
    </PressableScale>
  );
}

