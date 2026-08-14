import type { ReactNode } from 'react';
import { View, type ViewProps } from 'react-native';
import Animated, { FadeInDown, FadeOutUp, useReducedMotion } from 'react-native-reanimated';

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
  const reduceMotion = useReducedMotion();
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
        <Animated.View
          key={error}
          entering={reduceMotion ? undefined : FadeInDown.duration(150).springify().damping(20)}
          exiting={reduceMotion ? undefined : FadeOutUp.duration(110)}>
          <AppText
            variant="caption"
            tone="danger"
            accessibilityLiveRegion="polite"
            className="px-1">
            {error}
          </AppText>
        </Animated.View>
      ) : description ? (
        <AppText variant="caption" tone="muted" className="px-1">
          {description}
        </AppText>
      ) : null}
    </View>
  );
}
