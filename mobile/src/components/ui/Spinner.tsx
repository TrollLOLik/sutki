import { ActivityIndicator, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { useAppTheme } from '@/theme/useAppTheme';
import { ComponentMarker } from '@/components/debug/ComponentMarker';

export function Spinner({ size = 'large', label = 'Загрузка', style }: { size?: 'small' | 'large'; label?: string; style?: StyleProp<ViewStyle> }) {
  const { palette } = useAppTheme();

  return (
    <View accessibilityRole="progressbar" accessibilityLabel={label} style={[{ alignItems: 'center', justifyContent: 'center', gap: 10 }, style]}>
      <ComponentMarker kind="state" name="Spinner" />
      <ActivityIndicator size={size} color={palette.primary} />
      {label ? <Text style={{ color: palette.inkSecondary, fontSize: 13, fontWeight: '600' }}>{label}</Text> : null}
    </View>
  );
}
