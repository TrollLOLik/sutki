import type { ReactNode } from 'react';
import { View, type ViewProps } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { cn } from '@/lib/cn';

export interface FieldProps extends ViewProps {
  label?: string;
  description?: string;
  error?: string;
  required?: boolean;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Field({
  label,
  description,
  error,
  required = false,
  action,
  children,
  className,
  ...rest
}: FieldProps) {
  return (
    <View className={cn('w-full gap-2', className)} {...rest}>
      {label || action ? (
        <View className="min-h-5 flex-row items-center justify-between gap-3 px-1">
          {label ? (
            <AppText
              variant="label"
              tone="secondary"
              className="min-w-0 flex-1">
              {label}
              {required ? (
                <AppText variant="label" tone="primary">
                  {' *'}
                </AppText>
              ) : null}
            </AppText>
          ) : (
            <View />
          )}
          {action}
        </View>
      ) : null}

      {children}

      {error ? (
        <AppText
          variant="caption"
          tone="danger"
          accessibilityLiveRegion="polite"
          className="px-1">
          {error}
        </AppText>
      ) : description ? (
        <AppText variant="caption" tone="muted" className="px-1">
          {description}
        </AppText>
      ) : null}
    </View>
  );
}
