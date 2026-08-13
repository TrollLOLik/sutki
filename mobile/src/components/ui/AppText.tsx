import { forwardRef, type ComponentRef } from 'react';
import {
  Text as NativeText,
  type TextProps,
  type TextStyle,
} from 'react-native';

import {
  typography,
  type TypographyVariant,
} from '@/theme/tokens';
import { useAppTheme } from '@/theme/useAppTheme';

export type AppTextTone =
  | 'ink'
  | 'secondary'
  | 'muted'
  | 'primary'
  | 'success'
  | 'danger'
  | 'warning'
  | 'inverse'
  | 'inherit';

export interface AppTextProps extends TextProps {
  variant?: TypographyVariant;
  tone?: AppTextTone;
  align?: TextStyle['textAlign'];
}

export const AppText = forwardRef<ComponentRef<typeof NativeText>, AppTextProps>(
  function AppText(
    {
      variant = 'body',
      tone = 'ink',
      align,
      style,
      ...props
    },
    ref,
  ) {
    const { palette } = useAppTheme();

    const color =
      tone === 'secondary'
        ? palette.inkSecondary
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
                    : tone === 'inherit'
                      ? undefined
                      : palette.ink;

    return (
      <NativeText
        ref={ref}
        style={[
          typography[variant],
          color ? { color } : null,
          align ? { textAlign: align } : null,
          style,
        ]}
        {...props}
      />
    );
  },
);
