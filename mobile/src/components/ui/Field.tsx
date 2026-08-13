import type { ReactNode } from 'react';
import { Text, View, type ViewProps } from 'react-native';

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
            <Text className="min-w-0 flex-1 text-sm font-bold text-ink-secondary">
              {label}
              {required ? <Text className="text-primary"> *</Text> : null}
            </Text>
          ) : (
            <View />
          )}
          {action}
        </View>
      ) : null}

      {children}

      {error ? (
        <Text
          accessibilityLiveRegion="polite"
          className="px-1 text-xs font-medium leading-4 text-danger">
          {error}
        </Text>
      ) : description ? (
        <Text className="px-1 text-xs leading-4 text-ink-muted">{description}</Text>
      ) : null}
    </View>
  );
}
