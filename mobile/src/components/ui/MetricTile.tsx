import { View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
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
        <AppText variant="title" className="leading-tight">{displayValue}</AppText>
      )}
      <AppText variant="caption" tone="secondary" className="mt-1 font-semibold leading-none">{label}</AppText>
    </View>
  );
}
