import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '@/theme/useAppTheme';

export function StickyActionBar({ children, style, includeSafeArea = true }: { children: ReactNode; style?: StyleProp<ViewStyle>; includeSafeArea?: boolean }) {
  const { palette } = useAppTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        {
          width: '100%',
          gap: 9,
          borderTopWidth: 1,
          borderTopColor: palette.line,
          backgroundColor: palette.surface,
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: includeSafeArea ? Math.max(insets.bottom, 12) : 12,
        },
        style,
      ]}>
      {children}
    </View>
  );
}
