import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { MaterialSurface } from '@/components/ui/MaterialSurface';
import { ComponentMarker } from '@/components/debug/ComponentMarker';
import { useAppTheme } from '@/theme/useAppTheme';

export interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  action?: ReactNode;
  debugName?: string;
}

export function EmptyState({
  icon = 'sparkles-outline',
  title,
  subtitle,
  action,
  debugName = 'EmptyState',
}: EmptyStateProps) {
  const { palette } = useAppTheme();

  return (
    <View className="flex-1 items-center justify-center px-8">
      <ComponentMarker kind="state" name={debugName} />
      <MaterialSurface
        level="raised"
        radius={32}
        className="mb-5 h-16 w-16 items-center justify-center">
        <Ionicons name={icon} size={28} color={palette.inkMuted} />
      </MaterialSurface>
      <Text className="text-center text-lg font-extrabold text-ink">{title}</Text>
      {subtitle ? (
        <Text className="mt-2 max-w-[320px] text-center text-sm leading-5 text-ink-secondary">
          {subtitle}
        </Text>
      ) : null}
      {action ? <View className="mt-5 w-full max-w-[280px]">{action}</View> : null}
    </View>
  );
}
