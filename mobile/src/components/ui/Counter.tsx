import { Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { IconButton } from '@/components/ui/IconButton';
import { ComponentMarker } from '@/components/debug/ComponentMarker';
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

  return (
    <View accessibilityLabel={label} style={[{ flexDirection: 'row', alignItems: 'center', gap: 12 }, style]}>
      <ComponentMarker kind="field" name="Counter" />
      <IconButton icon="remove" size={36} iconSize={18} disabled={value <= min} onPress={() => onChange(Math.max(min, value - 1))} />
      <Text accessibilityLiveRegion="polite" style={{ minWidth: 30, textAlign: 'center', color: palette.ink, fontSize: 16, fontWeight: '800' }}>
        {value}
      </Text>
      <IconButton icon="add" size={36} iconSize={18} disabled={value >= max} onPress={() => onChange(Math.min(max, value + 1))} />
    </View>
  );
}
