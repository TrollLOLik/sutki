import type { ReactNode } from 'react';
import { Text, View, type ViewProps } from 'react-native';

import { cn } from '@/lib/cn';

export interface FormSectionProps extends ViewProps {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

function renderCopy(value: ReactNode, className: string) {
  return typeof value === 'string' || typeof value === 'number' ? (
    <Text className={className}>{value}</Text>
  ) : (
    value
  );
}

export function FormSection({
  title,
  description,
  action,
  children,
  className,
  ...rest
}: FormSectionProps) {
  return (
    <View className={cn('w-full gap-3', className)} {...rest}>
      <View className="flex-row items-start justify-between gap-3 px-1">
        <View className="min-w-0 flex-1 gap-1">
          {renderCopy(title, 'text-lg font-extrabold text-ink')}
          {description
            ? renderCopy(description, 'text-sm leading-5 text-ink-secondary')
            : null}
        </View>
        {action}
      </View>
      <View className="w-full gap-4">{children}</View>
    </View>
  );
}
