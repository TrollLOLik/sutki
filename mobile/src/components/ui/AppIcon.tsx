import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

import {
  iconSizes,
  type IconSizeToken,
} from '@/theme/tokens';
import { useAppTheme } from '@/theme/useAppTheme';

type IoniconProps = ComponentProps<typeof Ionicons>;

export type AppIconTone =
  | 'ink'
  | 'secondary'
  | 'muted'
  | 'primary'
  | 'success'
  | 'danger'
  | 'warning'
  | 'inverse';

export interface AppIconProps
  extends Omit<IoniconProps, 'name' | 'size' | 'color'> {
  name: keyof typeof Ionicons.glyphMap;
  size?: IconSizeToken | number;
  tone?: AppIconTone;
  color?: string;
}

export function AppIcon({
  name,
  size = 'md',
  tone = 'secondary',
  color,
  accessibilityLabel,
  ...props
}: AppIconProps) {
  const { palette } = useAppTheme();
  const resolvedSize = typeof size === 'number' ? size : iconSizes[size];
  const resolvedColor =
    color ??
    (tone === 'ink'
      ? palette.ink
      : tone === 'muted'
        ? palette.inkMuted
        : tone === 'primary'
          ? palette.primary
          : tone === 'success'
            ? palette.success
            : tone === 'danger'
              ? palette.danger
              : tone === 'warning'
                ? palette.star
                : tone === 'inverse'
                  ? '#FFFFFF'
                  : palette.inkSecondary);

  return (
    <Ionicons
      name={name}
      size={resolvedSize}
      color={resolvedColor}
      accessible={Boolean(accessibilityLabel)}
      accessibilityRole={accessibilityLabel ? 'image' : undefined}
      accessibilityLabel={accessibilityLabel}
      importantForAccessibility={accessibilityLabel ? 'auto' : 'no'}
      {...props}
    />
  );
}
