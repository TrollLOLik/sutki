import { ActivityIndicator, View, type StyleProp, type ViewStyle } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { useAppTheme } from '@/theme/useAppTheme';

export function Spinner({ size = 'large', label = 'Загрузка', style }: { size?: 'small' | 'large'; label?: string; style?: StyleProp<ViewStyle> }) {
  const { palette } = useAppTheme();

  return (
    <View accessibilityRole="progressbar" accessibilityLabel={label} style={[{ alignItems: 'center', justifyContent: 'center', gap: 10 }, style]}>
      <ActivityIndicator size={size} color={palette.primary} />
      {label ? <AppText variant="caption" tone="secondary" style={{ fontSize: 13, fontWeight: '600' }}>{label}</AppText> : null}
    </View>
  );
}
