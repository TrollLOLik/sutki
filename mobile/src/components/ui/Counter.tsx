import { useState } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  FadeInDown,
  FadeInUp,
  FadeOutDown,
  FadeOutUp,
  useReducedMotion,
} from 'react-native-reanimated';

import { AppText } from '@/components/ui/AppText';
import { IconButton } from '@/components/ui/IconButton';
import { useAppTheme } from '@/theme/useAppTheme';

export interface CounterProps {
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  label?: string;
  style?: StyleProp<ViewStyle>;
}

export function Counter({ value, min = 0, max = 99, onChange, label = 'Количество', style }: CounterProps) {
  const { palette } = useAppTheme();
  const reduceMotion = useReducedMotion();
  const [direction, setDirection] = useState(1);

  return (
    <View accessibilityLabel={label} style={[{ flexDirection: 'row', alignItems: 'center', gap: 12 }, style]}>
      <IconButton
        icon="remove"
        size={36}
        iconSize={18}
        disabled={value <= min}
        onPress={() => {
          setDirection(-1);
          onChange(Math.max(min, value - 1));
        }}
      />
      <View
        accessibilityLiveRegion="polite"
        style={{ width: 32, height: 24, overflow: 'hidden' }}>
        <Animated.View
          key={value}
          entering={reduceMotion ? undefined : direction > 0 ? FadeInDown.duration(150) : FadeInUp.duration(150)}
          exiting={reduceMotion ? undefined : direction > 0 ? FadeOutUp.duration(120) : FadeOutDown.duration(120)}
          style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}>
          <AppText
            variant="bodyStrong"
            style={{ minWidth: 30, textAlign: 'center', color: palette.ink, fontWeight: '800' }}>
            {value}
          </AppText>
        </Animated.View>
      </View>
      <IconButton
        icon="add"
        size={36}
        iconSize={18}
        disabled={value >= max}
        onPress={() => {
          setDirection(1);
          onChange(Math.min(max, value + 1));
        }}
      />
    </View>
  );
}
