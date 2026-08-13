import { Text, View } from 'react-native';
import { shadows } from '@/theme/tokens';
import { Skeleton } from './Skeleton';

interface MetricTileProps {
  label: string;
  value?: string | number | null;
  loading?: boolean;
  icon?: React.ReactNode;
}

/**
 * Reusable metric tile component with white background, soft shadow, and Skeleton loading state (TZ §2).
 */
export function MetricTile({ label, value, loading = false, icon }: MetricTileProps) {
  // If not loading and value is empty/null, render "—". If value is rating at 0.0, render "—" as well.
  const displayValue = loading
    ? ''
    : (value === null || value === undefined || value === '0.0' || value === '—')
    ? '—'
    : value;

  return (
    <View
      className="flex-1 rounded-card border border-line bg-surface p-4"
      style={shadows.tile}
    >
      {icon ? <View className="mb-2 flex-row">{icon}</View> : null}
      {loading ? (
        <Skeleton width="65%" height={22} radius={6} />
      ) : (
        <Text className="text-xl font-extrabold text-ink leading-tight">{displayValue}</Text>
      )}
      <Text className="text-xs font-semibold text-ink-secondary mt-1 leading-none">{label}</Text>
    </View>
  );
}
