import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  getAppScrollMovement,
  initialAppScrollChromeState,
  reduceAppScrollChrome,
  type AppScrollChromeState,
  type AppScrollMetrics,
} from './appScrollChrome';

function readScrollMetrics(): AppScrollMetrics {
  const root = document.scrollingElement ?? document.documentElement;
  const top = Math.max(0, root.scrollTop);
  const viewportHeight = root.clientHeight || window.innerHeight;
  return { top, remaining: Math.max(0, root.scrollHeight - viewportHeight - top) };
}

export function useAppScrollChrome(routeKey: string): boolean {
  const [hidden, setHidden] = useState(false);
  const stateRef = useRef<AppScrollChromeState>(initialAppScrollChromeState);

  useLayoutEffect(() => {
    stateRef.current = initialAppScrollChromeState;
    setHidden(false);
  }, [routeKey]);

  useEffect(() => {
    const viewport = window.visualViewport;
    const desktopMedia = window.matchMedia('(min-width: 900px)');
    let frame = 0;
    let previousMetrics = readScrollMetrics();

    const revealChrome = () => {
      previousMetrics = readScrollMetrics();
      stateRef.current = initialAppScrollChromeState;
      setHidden((current) => current ? false : current);
    };
    const syncMetrics = () => {
      previousMetrics = readScrollMetrics();
      stateRef.current = { ...stateRef.current, direction: null, travel: 0 };
    };
    const commit = (next: AppScrollChromeState) => {
      stateRef.current = next;
      setHidden((current) => current === next.hidden ? current : next.hidden);
    };
    const flushScroll = () => {
      frame = 0;
      const currentMetrics = readScrollMetrics();
      if (desktopMedia.matches || document.documentElement.dataset.scrollLocked) {
        revealChrome();
        return;
      }
      const movement = getAppScrollMovement(previousMetrics, currentMetrics);
      previousMetrics = currentMetrics;
      commit(reduceAppScrollChrome(stateRef.current, movement, currentMetrics.top));
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(flushScroll);
    };
    const onDesktopModeChange = () => {
      if (desktopMedia.matches) revealChrome();
      else syncMetrics();
    };
    const lockObserver = new MutationObserver(() => {
      if (document.documentElement.dataset.scrollLocked) revealChrome();
      else syncMetrics();
    });

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', syncMetrics, { passive: true });
    viewport?.addEventListener('resize', syncMetrics, { passive: true });
    desktopMedia.addEventListener('change', onDesktopModeChange);
    lockObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-scroll-locked'] });
    onDesktopModeChange();
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', syncMetrics);
      viewport?.removeEventListener('resize', syncMetrics);
      desktopMedia.removeEventListener('change', onDesktopModeChange);
      lockObserver.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [routeKey]);

  return hidden;
}
