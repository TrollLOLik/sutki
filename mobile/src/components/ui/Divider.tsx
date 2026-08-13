import { View, type StyleProp, type ViewStyle } from 'react-native';

import { useAppTheme } from '@/theme/useAppTheme';

export interface DividerProps {
  orientation?: 'horizontal' | 'vertical';
  inset?: number | { start?: number; end?: number };
  thickness?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}

export function Divider({
  orientation = 'horizontal',
  inset = 0,
  thickness = 1,
  color,
  style,
}: DividerProps) {
  const { palette } = useAppTheme();
  const start = typeof inset === 'number' ? inset : (inset.start ?? 0);
  const end = typeof inset === 'number' ? inset : (inset.end ?? 0);

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        { flexShrink: 0, backgroundColor: color ?? palette.line },
        orientation === 'horizontal'
          ? {
              height: thickness,
              alignSelf: 'stretch',
              marginLeft: start,
              marginRight: end,
            }
          : {
              width: thickness,
              alignSelf: 'stretch',
              marginTop: start,
              marginBottom: end,
            },
        style,
      ]}
    />
  );
}
