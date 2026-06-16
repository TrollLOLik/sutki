import { View, useWindowDimensions } from 'react-native';

import { Skeleton } from '@/components/ui';

/** Placeholder for a listing card while the feed loads (TZ §2 skeletons). */
export function ListingCardSkeleton() {
  const { width: screenWidth } = useWindowDimensions();

  // Mirrors the calculation in ListingCard
  const cardInnerWidth = screenWidth - 56;
  const imgWidth = cardInnerWidth * 0.45;
  const imgHeight = imgWidth * (3 / 4);

  return (
    <View className="mb-3 rounded-card border border-line bg-surface p-3">
      {/* Top Part: Image & Details */}
      <View className="flex-row gap-3">
        {/* Left: Image Skeleton with exact size */}
        <Skeleton
          radius={12}
          style={{ width: imgWidth, height: imgHeight }}
        />

        {/* Right: Details Skeleton */}
        <View className="flex-1 gap-2 py-0.5">
          {/* Rating row */}
          <View className="flex-row justify-between items-center">
            <Skeleton width="40%" height={14} radius={4} />
            <Skeleton width={20} height={20} radius={999} />
          </View>
          {/* Title */}
          <Skeleton width="90%" height={16} radius={4} />
          <Skeleton width="65%" height={16} radius={4} />
          {/* Address */}
          <Skeleton width="75%" height={12} radius={4} />
          {/* Metro */}
          <Skeleton width="55%" height={12} radius={4} />
          {/* Specs */}
          <View className="flex-row gap-2 mt-1">
            <Skeleton width="22%" height={12} radius={4} />
            <Skeleton width="28%" height={12} radius={4} />
            <Skeleton width="20%" height={12} radius={4} />
          </View>
        </View>
      </View>

      {/* Bottom Part: Price & Button */}
      <View className="flex-row justify-between items-center mt-3">
        <Skeleton width="35%" height={22} radius={4} />
        <Skeleton width={88} height={36} radius={999} />
      </View>
    </View>
  );
}
