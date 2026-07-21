import type { PropsWithChildren } from 'react';
import { StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';

import { useAppTheme } from '@/theme/useAppTheme';

export type MaterialLevel = 'base' | 'raised' | 'floating';

export function materialSurfaceColor(isDark: boolean, level: MaterialLevel = 'base') {
  return isDark
    ? level === 'base'
      ? '#181A1F'
      : '#202329'
    : level === 'base'
      ? '#FFFFFF'
      : '#F0F1F3';
}

interface MaterialSurfaceProps extends ViewProps {
  level?: MaterialLevel;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

/** A structural surface whose level stays consistent across both themes. */
export function MaterialSurface({
  children,
  level = 'base',
  radius = 18,
  style,
  ...rest
}: PropsWithChildren<MaterialSurfaceProps>) {
  const { isDark } = useAppTheme();
  const backgroundColor = materialSurfaceColor(isDark, level);

  return (
    <View
      style={[
        styles.surface,
        {
          backgroundColor,
          borderColor: isDark ? 'rgba(255,255,255,0.09)' : 'rgba(18,24,32,0.09)',
          borderRadius: radius,
        },
        level === 'floating' ? styles.floating : null,
        style,
      ]}
      {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  surface: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  floating: {
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
});
