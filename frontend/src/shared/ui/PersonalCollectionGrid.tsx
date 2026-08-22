import { forwardRef, type HTMLAttributes } from 'react';
import { cx } from '../lib/cx';

export type PersonalCollectionGridProps = HTMLAttributes<HTMLDivElement>;

export const PersonalCollectionGrid = forwardRef<HTMLDivElement, PersonalCollectionGridProps>(function PersonalCollectionGrid({ className, ...props }, ref) {
  return <div {...props} ref={ref} className={cx('ui-personal-collection-grid', className)} />;
});
