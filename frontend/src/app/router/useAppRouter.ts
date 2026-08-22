import { useCallback, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { appRoutePath, parseAppRoute, type AppRoute } from './appRoute';
import { readAppHistoryIndex, readAppHistoryScroll, withAppHistoryIndex, withAppHistoryScroll } from './appHistory';

type ActiveNavigationDirection = 'forward' | 'back' | 'replace';
export type NavigationDirection = ActiveNavigationDirection | 'idle';

let routeTransitionId = 0;
const ROUTE_MOTION_DURATION_MS = 420;
const ROUTE_ENGINE_RELEASE_DELAY_MS = 48;

function commitRouteTransition(
  direction: ActiveNavigationDirection,
  update: () => void,
) {
  const root = document.documentElement;
  const transitionId = ++routeTransitionId;
  root.dataset.routeDirection = direction;
  root.dataset.routePresentation = 'stack';

  const canAnimate = typeof document.startViewTransition === 'function'
    && window.matchMedia('(max-width: 899px)').matches
    && document.documentElement.dataset.motion !== 'reduced';

  if (!canAnimate) {
    delete root.dataset.routeEngine;
    update();
    delete root.dataset.routeDirection;
    delete root.dataset.routePresentation;
    return;
  }

  root.dataset.routeEngine = 'view';
  const transition = document.startViewTransition(() => flushSync(update));
  void transition.finished.finally(() => {
    if (transitionId !== routeTransitionId) return;
    delete root.dataset.routeDirection;
    delete root.dataset.routePresentation;
    window.setTimeout(() => {
      if (transitionId === routeTransitionId) delete root.dataset.routeEngine;
    }, ROUTE_ENGINE_RELEASE_DELAY_MS);
  }).catch(() => undefined);
}

export function useAppRouter(initialLocation?: string) {
  const browserReady = typeof window !== 'undefined';
  const initialScrollY = browserReady ? window.scrollY : 0;
  const [route, setRoute] = useState<AppRoute>(() => parseAppRoute(initialLocation));
  const [navigationDirection, setNavigationDirection] = useState<NavigationDirection>('idle');
  const [scrollRestoration, setScrollRestoration] = useState(() => ({ key: 0, top: initialScrollY }));
  const historyIndexRef = useRef(browserReady ? readAppHistoryIndex(window.history.state) ?? 0 : 0);
  const scrollPositionsRef = useRef(new Map<number, number>([[historyIndexRef.current, initialScrollY]]));
  const scrollRestorationKeyRef = useRef(0);
  const routeRef = useRef(route);

  useEffect(() => {
    const previousScrollRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    window.history.replaceState(
      withAppHistoryScroll(withAppHistoryIndex(window.history.state, historyIndexRef.current), window.scrollY),
      '',
    );

    let scrollFrame = 0;
    let persistTimer = 0;
    const rememberCurrentScroll = () => {
      if (scrollFrame) return;
      scrollFrame = window.requestAnimationFrame(() => {
        scrollFrame = 0;
        const scrollY = Math.max(0, window.scrollY);
        const entryIndex = historyIndexRef.current;
        const entryUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
        scrollPositionsRef.current.set(entryIndex, scrollY);

        // Updating browser history on every animation frame is noticeably
        // expensive on mobile. Keep the in-memory position current and only
        // persist it after the gesture settles.
        window.clearTimeout(persistTimer);
        persistTimer = window.setTimeout(() => {
          persistTimer = 0;
          const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
          if (historyIndexRef.current !== entryIndex || currentUrl !== entryUrl) return;
          window.history.replaceState(withAppHistoryScroll(window.history.state, scrollY), '');
        }, 140);
      });
    };

    const onPopState = (event: PopStateEvent) => {
      const nextIndex = readAppHistoryIndex(event.state) ?? 0;
      const direction = nextIndex < historyIndexRef.current ? 'back' : 'forward';
      const nextRoute = parseAppRoute();
      const nextScroll = scrollPositionsRef.current.get(nextIndex) ?? readAppHistoryScroll(event.state) ?? 0;
      historyIndexRef.current = nextIndex;
      commitRouteTransition(direction, () => {
        routeRef.current = nextRoute;
        setNavigationDirection(direction);
        setRoute(nextRoute);
        setScrollRestoration({ key: ++scrollRestorationKeyRef.current, top: nextScroll });
      });
    };
    window.addEventListener('scroll', rememberCurrentScroll, { passive: true });
    window.addEventListener('popstate', onPopState);
    return () => {
      window.cancelAnimationFrame(scrollFrame);
      window.clearTimeout(persistTimer);
      window.removeEventListener('scroll', rememberCurrentScroll);
      window.removeEventListener('popstate', onPopState);
      window.history.scrollRestoration = previousScrollRestoration;
    };
  }, []);

  useEffect(() => {
    if (navigationDirection === 'idle') return undefined;

    const timeout = window.setTimeout(() => {
      setNavigationDirection('idle');
    }, ROUTE_MOTION_DURATION_MS);

    return () => window.clearTimeout(timeout);
  }, [navigationDirection, route]);

  const navigate = useCallback((next: AppRoute, options?: { replace?: boolean; direction?: ActiveNavigationDirection; animate?: boolean }) => {
    const path = appRoutePath(next);
    const direction = options?.direction ?? (options?.replace ? 'replace' : 'forward');
    const currentScroll = Math.max(0, window.scrollY);
    scrollPositionsRef.current.set(historyIndexRef.current, currentScroll);
    window.history.replaceState(withAppHistoryScroll(window.history.state, currentScroll), '');
    if (options?.replace) {
      scrollPositionsRef.current.set(historyIndexRef.current, 0);
      window.history.replaceState(withAppHistoryScroll(withAppHistoryIndex(next, historyIndexRef.current), 0), '', path);
    } else {
      historyIndexRef.current += 1;
      scrollPositionsRef.current.set(historyIndexRef.current, 0);
      window.history.pushState(withAppHistoryScroll(withAppHistoryIndex(next, historyIndexRef.current), 0), '', path);
    }
    const updateRoute = () => {
      routeRef.current = next;
      setNavigationDirection(options?.animate === false ? 'idle' : direction);
      setRoute(next);
      setScrollRestoration({ key: ++scrollRestorationKeyRef.current, top: 0 });
    };
    if (options?.animate === false) updateRoute();
    else commitRouteTransition(direction, updateRoute);
  }, []);

  const back = useCallback((fallback: AppRoute = { name: 'home' }) => {
    const currentScroll = Math.max(0, window.scrollY);
    scrollPositionsRef.current.set(historyIndexRef.current, currentScroll);
    window.history.replaceState(withAppHistoryScroll(window.history.state, currentScroll), '');
    if (historyIndexRef.current > 0) {
      window.history.back();
      return;
    }
    scrollPositionsRef.current.set(historyIndexRef.current, 0);
    window.history.replaceState(withAppHistoryScroll(withAppHistoryIndex(fallback, historyIndexRef.current), 0), '', appRoutePath(fallback));
    commitRouteTransition('back', () => {
      routeRef.current = fallback;
      setNavigationDirection('back');
      setRoute(fallback);
      setScrollRestoration({ key: ++scrollRestorationKeyRef.current, top: 0 });
    });
  }, []);

  return { route, navigationDirection, scrollRestoration, navigate, back };
}
