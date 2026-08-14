import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
} from 'react-native-reanimated';

import { AppText } from '@/components/ui/AppText';
import { PressableScale, type PressableScaleProps } from '@/components/ui/PressableScale';
import { useSelectionProgress } from '@/components/ui/useSelectionProgress';
import { useAppTheme } from '@/theme/useAppTheme';

interface ChipProps extends Omit<PressableScaleProps, 'children' | 'style'> {
  label: string;
  selected?: boolean;
  selectedVariant?: 'soft' | 'solid';
  style?: StyleProp<ViewStyle>;
}

export function Chip({
  label,
  selected = false,
  selectedVariant = 'soft',
  style,
  ...pressableProps
}: ChipProps) {
  const { palette } = useAppTheme();
  const selection = useSelectionProgress(selected);
  const selectedBackground = selectedVariant === 'solid' ? palette.primary : palette.primaryLight;
  const surfaceStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      selection.value,
      [0, 1],
      [palette.surfaceMuted, selectedBackground],
    ),
    borderColor: interpolateColor(
      selection.value,
      [0, 1],
      [palette.line, palette.primary],
    ),
  }));

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ selected }}
      motionVariant="control"
      {...pressableProps}
      style={[
        {
          minHeight: 38,
          borderRadius: 999,
        },
        style,
      ]}>
      <Animated.View
        style={[
          {
            minHeight: 38,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 999,
            borderWidth: 1,
            paddingHorizontal: 16,
          },
          surfaceStyle,
        ]}>
        <AppText
          variant="label"
          numberOfLines={1}
          ellipsizeMode="tail"
          style={{
            flexShrink: 1,
            fontSize: 14,
            fontWeight: selected ? '600' : '400',
            color: selected
              ? selectedVariant === 'solid' ? 'white' : palette.primary
              : palette.inkSecondary,
          }}>
          {label}
        </AppText>
      </Animated.View>
    </PressableScale>
  );
}

