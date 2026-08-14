import type { ReactNode } from 'react';
import { View } from 'react-native';

import { AppIcon, type AppIconName } from '@/components/ui/AppIcon';
import { AppText } from '@/components/ui/AppText';
import { MaterialSurface } from '@/components/ui/MaterialSurface';
import { useAppTheme } from '@/theme/useAppTheme';

export interface EmptyStateProps {
  icon?: AppIconName;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

export function EmptyState({
  icon = 'sparkles-outline',
  title,
  subtitle,
  action,
}: EmptyStateProps) {
  const { palette } = useAppTheme();

  return (
    <View className="flex-1 items-center justify-center px-8">
      <MaterialSurface
        level="raised"
        radius={32}
        className="mb-5 h-16 w-16 items-center justify-center">
        <AppIcon name={icon} size={28} color={palette.inkMuted} />
      </MaterialSurface>
      <AppText variant="sectionTitle" align="center">{title}</AppText>
      {subtitle ? (
        <AppText variant="label" tone="secondary" align="center" className="mt-2 max-w-[320px] font-normal leading-5">
          {subtitle}
        </AppText>
      ) : null}
      {action ? <View className="mt-5 w-full max-w-[280px]">{action}</View> : null}
    </View>
  );
}
