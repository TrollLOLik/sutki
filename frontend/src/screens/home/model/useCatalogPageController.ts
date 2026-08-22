import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ListingLayoutMode } from '@entities/listing';
import { usePullToRefresh } from '@shared/lib/scroll/usePullToRefresh';
import { getCatalogScrollMovement, type CatalogScrollMetrics } from './catalogScrollChrome';

interface CatalogPageControllerOptions {
  initialLayout?: ListingLayoutMode;
  initialScrollTop?: number;
  skipInitialLoading?: boolean;
  onTabBarHiddenChange?: (hidden: boolean) => void;
}

export function useCatalogPageController({ initialLayout, initialScrollTop = 0, skipInitialLoading, onTabBarHiddenChange }: CatalogPageControllerOptions) {
  const initialChromeHidden = initialScrollTop > 12;
  const [layout, setLayout] = useState<ListingLayoutMode>(initialLayout ?? 'list');
  const [simulatedLoading, setSimulatedLoading] = useState(!(initialChromeHidden || skipInitialLoading));
  const [headerCollapsed, setHeaderCollapsed] = useState(initialChromeHidden);
  const [tabBarHidden, setTabBarHidden] = useState(initialChromeHidden);
  const { pullDistance, refreshing } = usePullToRefresh();
  const headerCollapsedRef = useRef(initialChromeHidden);
  const tabBarHiddenRef = useRef(initialChromeHidden);

  useLayoutEffect(() => {
    if (initialScrollTop <= 12) return;
    headerCollapsedRef.current = true;
    tabBarHiddenRef.current = true;
    setHeaderCollapsed(true);
    setTabBarHidden(true);
  }, [initialScrollTop]);

  useLayoutEffect(() => {
    onTabBarHiddenChange?.(tabBarHidden);
  }, [onTabBarHiddenChange, tabBarHidden]);

  useEffect(() => {
    if (initialLayout) return;
    try {
      const saved = window.localStorage.getItem('catalog-layout');
      if (saved === 'list' || saved === 'grid') setLayout(saved);
    } catch {
      // Storage can be unavailable in private or embedded contexts.
    }
  }, [initialLayout]);

  const toggleLayout = () => setLayout((current) => {
    const next = current === 'list' ? 'grid' : 'list';
    try { window.localStorage.setItem('catalog-layout', next); } catch { /* Keep the in-memory choice. */ }
    return next;
  });

  useEffect(() => {
    const timer = window.setTimeout(() => setSimulatedLoading(false), 420);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const desktopQuery = window.matchMedia('(min-width: 900px)');
    const viewport = window.visualViewport;
    let frame = 0;
    let movementDirection: 'up' | 'down' | null = null;
    let movementTravel = 0;

    const readMetrics = (): CatalogScrollMetrics => {
      const root = document.scrollingElement ?? document.documentElement;
      const top = Math.max(0, root.scrollTop);
      const viewportHeight = root.clientHeight || window.innerHeight;
      return { top, remaining: Math.max(0, root.scrollHeight - viewportHeight - top) };
    };

    let previousMetrics = readMetrics();

    const commit = (collapsed: boolean, hidden: boolean) => {
      if (headerCollapsedRef.current !== collapsed) {
        headerCollapsedRef.current = collapsed;
        setHeaderCollapsed(collapsed);
      }
      if (tabBarHiddenRef.current !== hidden) {
        tabBarHiddenRef.current = hidden;
        setTabBarHidden(hidden);
      }
    };

    const resetMovement = () => { movementDirection = null; movementTravel = 0; };
    const syncMetrics = () => {
      previousMetrics = readMetrics();
      resetMovement();
      if (desktopQuery.matches || previousMetrics.top <= 12) commit(false, false);
    };
    const applyMovement = (direction: 'up' | 'down', distance: number, top: number) => {
      if (desktopQuery.matches) { commit(false, false); resetMovement(); return; }
      if (direction === 'up' && top <= 12) { commit(false, false); resetMovement(); return; }
      if (movementDirection !== direction) { movementDirection = direction; movementTravel = 0; }
      movementTravel += distance;
      if (movementTravel < 12) return;
      commit(direction === 'down', direction === 'down');
      movementTravel = 0;
    };
    const flushScroll = () => {
      frame = 0;
      const currentMetrics = readMetrics();
      if (document.documentElement.dataset.scrollLocked) { previousMetrics = currentMetrics; resetMovement(); return; }
      const movement = getCatalogScrollMovement(previousMetrics, currentMetrics);
      previousMetrics = currentMetrics;
      if (desktopQuery.matches || currentMetrics.top <= 12) { commit(false, false); resetMovement(); return; }
      if (movement) applyMovement(movement.direction, movement.distance, currentMetrics.top);
    };
    const onScroll = () => { if (!frame) frame = window.requestAnimationFrame(flushScroll); };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', syncMetrics, { passive: true });
    viewport?.addEventListener('resize', syncMetrics, { passive: true });
    desktopQuery.addEventListener('change', syncMetrics);
    syncMetrics();
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', syncMetrics);
      viewport?.removeEventListener('resize', syncMetrics);
      desktopQuery.removeEventListener('change', syncMetrics);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return { layout, toggleLayout, simulatedLoading, headerCollapsed, pullDistance, refreshing };
}
