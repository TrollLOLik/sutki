import type { HTMLAttributes } from 'react';
import { cx } from '../lib/cx';
import { RouteActionBarPortal } from './RouteActionBarPortal';

function actionBarContext(className?: string) {
  if (className?.includes('detail-mobile-booking-bar')) return 'detail-page';
  if (className?.includes('booking-mobile-submit')) return 'booking-page';
  if (className?.includes('request-detail-footer')) return 'request-detail-page';
  return undefined;
}

export function StickyActionBar({ className, ...props }: HTMLAttributes<HTMLElement>) {
  const footer = <footer {...props} className={cx('ui-sticky-action-bar', className)} />;
  return <RouteActionBarPortal contextClassName={actionBarContext(className)}>{footer}</RouteActionBarPortal>;
}
