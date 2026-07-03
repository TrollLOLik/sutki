import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

import { useAppTheme } from '@/theme/useAppTheme';

interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
}

export function EmptyState({ icon = 'sparkles-outline', title, subtitle }: EmptyStateProps) {
  const { palette } = useAppTheme();
  return (
    <View className="flex-1 items-center justify-center px-8">
      <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-surface-muted">
        <Ionicons name={icon} size={28} color={palette.inkMuted} />
      </View>
      <Text className="text-center text-lg font-semibold text-ink">{title}</Text>
      {subtitle ? <Text className="mt-1 text-center text-base text-ink-secondary">{subtitle}</Text> : null}
    </View>
  );
}
