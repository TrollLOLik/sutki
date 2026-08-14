import type { ReactNode } from 'react';
import {
  View,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from 'react-native';

import { useAppTheme } from '@/theme/useAppTheme';

export type FieldFrameSize = 'md' | 'lg';

export interface FieldFrameProps extends Omit<ViewProps, 'style'> {
  children: ReactNode;
  focused?: boolean;
  invalid?: boolean;
  multiline?: boolean;
  minHeight?: number;
  size?: FieldFrameSize;
  contentPaddingHorizontal?: number;
  style?: StyleProp<ViewStyle>;
}

export function FieldFrame({
  children,
  focused = false,
  invalid = false,
  multiline = false,
  minHeight,
  size = 'lg',
  contentPaddingHorizontal = 16,
  style,
  ...rest
}: FieldFrameProps) {
  const { palette } = useAppTheme();
  const height = size === 'md' ? 48 : 56;
  const radius = size === 'md' ? 16 : 18;

  return (
    <View
      style={[
        {
          width: '100%',
          height: multiline ? undefined : height,
          minHeight: multiline ? (minHeight ?? height) : height,
          flexDirection: multiline ? 'column' : 'row',
          alignItems: multiline ? 'stretch' : 'center',
          overflow: 'hidden',
          borderRadius: radius,
          borderWidth: invalid || focused ? 1.5 : 1,
          borderColor: invalid
            ? palette.danger
            : focused
              ? palette.primary
              : palette.line,
          backgroundColor: palette.surfaceMuted,
          paddingHorizontal: contentPaddingHorizontal,
        },
        style,
      ]}
      {...rest}>
      {children}
    </View>
  );
}
