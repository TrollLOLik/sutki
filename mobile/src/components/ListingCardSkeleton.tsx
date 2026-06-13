import { View } from 'react-native';

import { Skeleton } from '@/components/ui';

/** Placeholder for a listing card while the feed loads (TZ §2 skeletons). */
export function ListingCardSkeleton() {
  return (
    <View className="mb-4 overflow-hidden rounded-card border border-line bg-surface">
      <Skeleton height={180} radius={0} />
      <View className="gap-2 p-3">
        <Skeleton width="70%" height={18} />
        <Skeleton width="45%" height={14} />
        <Skeleton width="35%" height={20} />
      </View>
    </View>
  );
}
