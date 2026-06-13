import { MotiView } from 'moti';

import { palette } from '@/theme/tokens';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  radius?: number;
  style?: object;
}

/** Lightweight pulsing placeholder used for loading states (TZ §2). */
export function Skeleton({ width = '100%', height = 16, radius = 8, style }: SkeletonProps) {
  return (
    <MotiView
      from={{ opacity: 0.5 }}
      animate={{ opacity: 1 }}
      transition={{ type: 'timing', duration: 800, loop: true, repeatReverse: true }}
      style={[{ width: width as number, height, borderRadius: radius, backgroundColor: palette.surfaceSkeleton }, style]}
    />
  );
}
