import { useEffect, useRef, useState, type RefObject } from 'react';

const REFRESH_THRESHOLD = 72;
const MAX_PULL_DISTANCE = 96;

export interface PullToRefreshState {
  pullDistance: number;
  refreshing: boolean;
  threshold: number;
}

export function usePullToRefresh({
  scrollRef,
  disabled = false,
  onRefresh,
  onRefreshError,
}: {
  scrollRef?: RefObject<HTMLElement | null>;
  disabled?: boolean;
  onRefresh?: () => void | Promise<void>;
  onRefreshError?: (error: unknown) => void;
} = {}): PullToRefreshState {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const pullDistanceRef = useRef(0);
  const refreshingRef = useRef(false);
  const refreshRunRef = useRef(0);
  const onRefreshRef = useRef(onRefresh);
  const onRefreshErrorRef = useRef(onRefreshError);
  const refreshEnabled = !disabled && typeof onRefresh === 'function';

  useEffect(() => {
    onRefreshRef.current = onRefresh;
    onRefreshErrorRef.current = onRefreshError;
  }, [onRefresh, onRefreshError]);

  useEffect(() => {
    if (!refreshEnabled) {
      refreshRunRef.current += 1;
      pullDistanceRef.current = 0;
      refreshingRef.current = false;
      setPullDistance(0);
      setRefreshing(false);
      return;
    }

    const element = scrollRef?.current ?? null;
    let startX = 0;
    let startY = 0;
    let tracking = false;
    let mounted = true;

    const updateDistance = (distance: number) => {
      pullDistanceRef.current = distance;
      if (mounted) setPullDistance(distance);
    };
    const isAtTop = () => element ? element.scrollTop <= 0 : window.scrollY <= 0;
    const refresh = async () => {
      if (refreshingRef.current) return;
      const refreshRun = ++refreshRunRef.current;
      refreshingRef.current = true;
      setRefreshing(true);
      updateDistance(REFRESH_THRESHOLD);
      try {
        await onRefreshRef.current?.();
      } catch (error) {
        if (mounted) onRefreshErrorRef.current?.(error);
      } finally {
        if (refreshRunRef.current !== refreshRun) return;
        refreshingRef.current = false;
        if (mounted) {
          setRefreshing(false);
          updateDistance(0);
        }
      }
    };
    const onTouchStart = (event: TouchEvent) => {
      if (window.matchMedia('(min-width: 900px)').matches || document.documentElement.dataset.scrollLocked || !isAtTop() || refreshingRef.current || event.touches.length !== 1) return;
      startX = event.touches[0].clientX;
      startY = event.touches[0].clientY;
      tracking = true;
    };
    const onTouchMove = (event: TouchEvent) => {
      if (!tracking || event.touches.length !== 1) return;
      if (document.documentElement.dataset.scrollLocked || !isAtTop()) {
        tracking = false;
        updateDistance(0);
        return;
      }
      const deltaX = event.touches[0].clientX - startX;
      const deltaY = event.touches[0].clientY - startY;
      if (deltaY <= 0 || Math.abs(deltaX) > Math.abs(deltaY)) {
        if (deltaY < 0) tracking = false;
        return;
      }
      event.preventDefault();
      updateDistance(Math.min(MAX_PULL_DISTANCE, deltaY * .46));
    };
    const onTouchEnd = () => {
      if (!tracking) return;
      tracking = false;
      if (pullDistanceRef.current >= REFRESH_THRESHOLD) void refresh();
      else updateDistance(0);
    };
    const cancelPull = () => {
      if (refreshingRef.current) return;
      tracking = false;
      updateDistance(0);
    };

    if (element) {
      element.addEventListener('touchstart', onTouchStart, { passive: true });
      element.addEventListener('touchmove', onTouchMove, { passive: false });
      element.addEventListener('touchend', onTouchEnd, { passive: true });
      element.addEventListener('touchcancel', cancelPull, { passive: true });
    } else {
      window.addEventListener('touchstart', onTouchStart, { passive: true });
      window.addEventListener('touchmove', onTouchMove, { passive: false });
      window.addEventListener('touchend', onTouchEnd, { passive: true });
      window.addEventListener('touchcancel', cancelPull, { passive: true });
    }
    window.addEventListener('blur', cancelPull);
    document.addEventListener('visibilitychange', cancelPull);

    return () => {
      mounted = false;
      if (element) {
        element.removeEventListener('touchstart', onTouchStart);
        element.removeEventListener('touchmove', onTouchMove);
        element.removeEventListener('touchend', onTouchEnd);
        element.removeEventListener('touchcancel', cancelPull);
      } else {
        window.removeEventListener('touchstart', onTouchStart);
        window.removeEventListener('touchmove', onTouchMove);
        window.removeEventListener('touchend', onTouchEnd);
        window.removeEventListener('touchcancel', cancelPull);
      }
      window.removeEventListener('blur', cancelPull);
      document.removeEventListener('visibilitychange', cancelPull);
    };
  }, [refreshEnabled, scrollRef]);

  return { pullDistance, refreshing, threshold: REFRESH_THRESHOLD };
}
