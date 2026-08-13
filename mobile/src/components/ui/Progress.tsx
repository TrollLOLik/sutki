import { View, type StyleProp, type ViewStyle } from 'react-native';

import { useAppTheme } from '@/theme/useAppTheme';
import { ComponentMarker } from '@/components/debug/ComponentMarker';

export function Progress({ value, max = 100, label = 'Прогресс', style }: { value: number; max?: number; label?: string; style?: StyleProp<ViewStyle> }) {
  const { palette } = useAppTheme();
  const percent = Math.max(0, Math.min(100, max > 0 ? (value / max) * 100 : 0));

  return (
    <View accessibilityRole="progressbar" accessibilityLabel={label} accessibilityValue={{ min: 0, max, now: value }} style={[{ width: '100%', height: 5, overflow: 'hidden', borderRadius: 3, backgroundColor: palette.surfaceMuted }, style]}>
      <ComponentMarker kind="state" name="Progress" />
      <View style={{ width: `${percent}%`, height: '100%', borderRadius: 3, backgroundColor: palette.primary }} />
    </View>
  );
}
