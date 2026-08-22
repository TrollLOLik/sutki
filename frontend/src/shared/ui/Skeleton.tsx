import type { HTMLAttributes } from 'react';
import { cx } from '../lib/cx';

export interface SkeletonProps extends HTMLAttributes<HTMLSpanElement> {
  width?: string | number;
  height?: string | number;
  radius?: string | number;
}

export function Skeleton({ className, width, height, radius, style, ...props }: SkeletonProps) {
  return <span {...props} className={cx('ui-skeleton', className)} style={{ width, height, borderRadius: radius, ...style }} aria-hidden="true" />;
}
