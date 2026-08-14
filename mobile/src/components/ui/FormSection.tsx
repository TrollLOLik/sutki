import type { ReactNode } from 'react';
import { View, type TextStyle, type ViewProps } from 'react-native';

import { AppText, type AppTextTone } from '@/components/ui/AppText';
import { cn } from '@/lib/cn';
import type { TypographyVariant } from '@/theme/tokens';

export interface FormSectionProps extends ViewProps {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

function renderCopy(
  value: ReactNode,
  variant: TypographyVariant,
  tone: AppTextTone = 'ink',
  style?: TextStyle,
) {
  return typeof value === 'string' || typeof value === 'number' ? (
    <AppText variant={variant} tone={tone} style={style}>
      {value}
    </AppText>
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
          {renderCopy(title, 'sectionTitle')}
          {description
            ? renderCopy(description, 'label', 'secondary', {
                fontWeight: '400',
                lineHeight: 20,
              })
            : null}
        </View>
        {action}
      </View>
      <View className="w-full gap-4">{children}</View>
    </View>
  );
}
