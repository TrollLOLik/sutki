import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';

export function useWindowTabPanelScroll<T extends string>(
  activeTab: T,
  positions: Record<T, number>,
  disabled = false,
) {
  const activeTabRef = useRef(activeTab);
  const panelNodesRef = useRef(new Map<T, HTMLElement>());
  const viewportNodeRef = useRef<HTMLElement | null>(null);
  const scrollCaptureSuspendedRef = useRef(true);

  activeTabRef.current = activeTab;

  const capture = useCallback(() => {
    if (disabled) return;
    positions[activeTabRef.current] = Math.max(0, window.scrollY);
  }, [disabled, positions]);

  const registerPanel = useCallback((tab: T, node: HTMLElement | null) => {
    if (node) panelNodesRef.current.set(tab, node);
    else panelNodesRef.current.delete(tab);
  }, []);

  const registerViewport = useCallback((node: HTMLElement | null) => {
    viewportNodeRef.current = node;
  }, []);

  useLayoutEffect(() => {
    if (disabled) {
      viewportNodeRef.current?.style.removeProperty('height');
      return;
    }

    const panel = panelNodesRef.current.get(activeTab);
    const viewport = viewportNodeRef.current;
    if (!panel || !viewport) return;

    const syncHeight = () => {
      viewport.style.height = `${Math.ceil(panel.scrollHeight)}px`;
    };
    syncHeight();

    const observer = new ResizeObserver(syncHeight);
    observer.observe(panel);
    scrollCaptureSuspendedRef.current = true;
    const restore = () => {
      const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      window.scrollTo({ top: Math.min(positions[activeTab] ?? 0, maxScroll), behavior: 'auto' });
    };

    restore();
    const frame = window.requestAnimationFrame(() => {
      syncHeight();
      restore();
      scrollCaptureSuspendedRef.current = false;
    });
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
    };
  }, [activeTab, disabled, positions]);

  useEffect(() => {
    if (disabled) return;
    const save = () => {
      if (scrollCaptureSuspendedRef.current) return;
      positions[activeTabRef.current] = Math.max(0, window.scrollY);
    };
    window.addEventListener('scroll', save, { passive: true });
    return () => window.removeEventListener('scroll', save);
  }, [disabled, positions]);

  return { capture, registerPanel, registerViewport };
}
