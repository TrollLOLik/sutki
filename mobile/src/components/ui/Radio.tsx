import type { ReactNode } from 'react';
import { View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
} from 'react-native-reanimated';

import { AppText } from '@/components/ui/AppText';
import { PressableScale } from '@/components/ui/PressableScale';
import { useHapticValueChange } from '@/components/ui/useHapticValueChange';
import { useSelectionProgress } from '@/components/ui/useSelectionProgress';
import { useAppTheme } from '@/theme/useAppTheme';

export interface RadioProps extends Omit<PressableProps, 'children' | 'style' | 'onPress'> {
  selected: boolean;
  onSelect: () => void;
  label?: ReactNode;
  description?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function Radio({ selected, onSelect, label, description, disabled, style, ...rest }: RadioProps) {
  const { palette } = useAppTheme();
  const selection = useSelectionProgress(selected, 'spring');
  const expectSelectionChange = useHapticValueChange(selected);
  const ringStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(
      selection.value,
      [0, 1],
      [palette.line, palette.primary],
    ),
  }));
  const dotStyle = useAnimatedStyle(() => ({
    opacity: interpolate(selection.value, [0, 1], [0, 1], Extrapolation.CLAMP),
    transform: [
      {
        scale: interpolate(
          selection.value,
          [0, 1],
          [0.35, 1],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));
  const handlePress = () => {
    if (selected) return;
    expectSelectionChange(true);
    onSelect();
  };

  return (
    <PressableScale
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled: Boolean(disabled) }}
      disabled={Boolean(disabled)}
      hitSlop={label ? undefined : 8}
      onPress={handlePress}
      motionVariant="surface"
      style={[
        {
          minWidth: 24,
          minHeight: 24,
          flexDirection: 'row',
          alignItems: description ? 'flex-start' : 'center',
          gap: 10,
          opacity: disabled ? 0.42 : 1,
        },
        style,
      ]}
      {...rest}>
      <Animated.View
        pointerEvents="none"
        style={[
          {
            width: 24,
            height: 24,
            marginTop: description ? 1 : 0,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 12,
            borderWidth: 1.5,
            backgroundColor: palette.surfaceMuted,
          },
          ringStyle,
        ]}>
        <Animated.View
          style={[
            {
              width: 12,
              height: 12,
              borderRadius: 6,
              backgroundColor: palette.primary,
            },
            dotStyle,
          ]}
        />
      </Animated.View>
      {label || description ? (
        <View pointerEvents="none" style={{ minWidth: 0, flex: 1, gap: 2 }}>
          {typeof label === 'string' ? <AppText variant="label" style={{ color: palette.ink, lineHeight: 20 }}>{label}</AppText> : label}
          {typeof description === 'string' ? <AppText variant="caption" style={{ color: palette.inkSecondary, lineHeight: 17, fontWeight: '400' }}>{description}</AppText> : description}
        </View>
      ) : null}
    </PressableScale>
  );
}
