import { RefreshCw } from 'lucide-react';
import type { CSSProperties } from 'react';

export function PullToRefreshIndicator({
  pullDistance,
  refreshing,
  threshold = 72,
  label = 'Потяните вниз для обновления',
  refreshingLabel = 'Обновление данных',
}: {
  pullDistance: number;
  refreshing: boolean;
  threshold?: number;
  label?: string;
  refreshingLabel?: string;
}) {
  const visible = pullDistance > 0 || refreshing;
  return (
    <div
      className={`catalog-refresh-indicator ${visible ? 'is-visible' : ''} ${refreshing ? 'refreshing' : ''} ${pullDistance >= threshold ? 'armed' : ''}`}
      style={{ '--pull-distance': `${pullDistance}px`, '--pull-opacity': Math.min(1, pullDistance / 36), opacity: refreshing ? 1 : Math.min(1, pullDistance / 36) } as CSSProperties}
      role="status"
      aria-live="polite"
      aria-hidden={!visible}
      aria-label={refreshing ? refreshingLabel : label}
    >
      <RefreshCw size={19} />
    </div>
  );
}
