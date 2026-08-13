import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';

import {
  MaterialSurface,
  type MaterialLevel,
} from '@/components/ui/MaterialSurface';
import { ComponentMarker } from '@/components/debug/ComponentMarker';
import { useAppTheme } from '@/theme/useAppTheme';

type CardPadding = 'none' | 'sm' | 'md' | 'lg';

export interface CardProps extends Omit<ViewProps, 'children'> {
  header?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
  padding?: CardPadding;
  level?: MaterialLevel;
  radius?: number;
}

const paddingBySize: Record<CardPadding, number> = {
  none: 0,
  sm: 12,
  md: 16,
  lg: 20,
};

export function Card({
  header,
  footer,
  children,
  padding = 'md',
  level = 'raised',
  radius = 22,
  style,
  ...rest
}: CardProps) {
  const { palette } = useAppTheme();
  const paddingValue = paddingBySize[padding];

  return (
    <MaterialSurface level={level} radius={radius} style={style} {...rest}>
      <ComponentMarker kind="surface" name="Card" placement="top-right" />
      {header ? (
        <View style={[styles.region, { padding: paddingValue }]}>{header}</View>
      ) : null}
      {header && children ? <View style={[styles.divider, { backgroundColor: palette.line }]} /> : null}
      {children ? (
        <View style={[styles.region, { padding: paddingValue }]}>{children}</View>
      ) : null}
      {footer && (header || children) ? <View style={[styles.divider, { backgroundColor: palette.line }]} /> : null}
      {footer ? (
        <View style={[styles.region, { padding: paddingValue }]}>{footer}</View>
      ) : null}
    </MaterialSurface>
  );
}

const styles = StyleSheet.create({
  region: {
    width: '100%',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
});
