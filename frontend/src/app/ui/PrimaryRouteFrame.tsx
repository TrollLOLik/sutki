import { useCallback, useRef, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import type { HomeTab } from '@pages/home';
import type { NavigationDirection } from '../router/useAppRouter';

const primarySwipeTabs: HomeTab[] = ['search', 'map', 'messages', 'profile'];
const primarySwipeIgnoreSelector = [
  'input',
  'textarea',
  'select',
  '[contenteditable="true"]',
  '[role="slider"]',
  '.detail-mobile-gallery',
  '.lightbox-swipe-stage',
  '.quick-filter-scroll',
  '.ui-counted-tabs',
  '.profile-settings-track',
  '.requests-tab-track',
].join(',');

export function PrimaryRouteFrame({ routeKey, navigationDirection, activeTab, disabled, onNavigate, children }: {
  routeKey: string;
  navigationDirection: NavigationDirection;
  activeTab: HomeTab | null;
  disabled: boolean;
  onNavigate: (tab: HomeTab) => void;
  children: ReactNode;
}) {
  const swipeRef = useRef({ pointerId: -1, startX: 0, startY: 0, x: 0, y: 0, startedAt: 0, horizontal: false });
  const suppressClickUntilRef = useRef(0);

  const resetSwipe = useCallback(() => {
    swipeRef.current = { pointerId: -1, startX: 0, startY: 0, x: 0, y: 0, startedAt: 0, horizontal: false };
  }, []);

  const startSwipe = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (document.documentElement.dataset.mobileKeyboard === 'open' || disabled || activeTab === null || event.pointerType === 'mouse' || !event.isPrimary) return;
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest(primarySwipeIgnoreSelector)) return;
    swipeRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      x: event.clientX,
      y: event.clientY,
      startedAt: performance.now(),
      horizontal: false,
    };
  }, [activeTab, disabled]);

  const moveSwipe = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const swipe = swipeRef.current;
    if (swipe.pointerId !== event.pointerId) return;
    swipe.x = event.clientX;
    swipe.y = event.clientY;
    const deltaX = swipe.x - swipe.startX;
    const deltaY = swipe.y - swipe.startY;
    if (!swipe.horizontal) {
      if (Math.abs(deltaY) > 12 && Math.abs(deltaY) > Math.abs(deltaX)) {
        resetSwipe();
        return;
      }
      if (Math.abs(deltaX) < 14 || Math.abs(deltaX) <= Math.abs(deltaY) * 1.15) return;
      swipe.horizontal = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    event.preventDefault();
  }, [resetSwipe]);

  const finishSwipe = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const swipe = swipeRef.current;
    if (swipe.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - swipe.startX;
    const deltaY = event.clientY - swipe.startY;
    const elapsed = Math.max(1, performance.now() - swipe.startedAt);
    const velocity = Math.abs(deltaX) / elapsed;
    const qualifies = swipe.horizontal
      && Math.abs(deltaX) > Math.abs(deltaY) * 1.25
      && (Math.abs(deltaX) >= 64 || (Math.abs(deltaX) >= 38 && velocity >= 0.45));
    resetSwipe();
    if (document.documentElement.dataset.mobileKeyboard === 'open' || !qualifies || disabled || activeTab === null) return;
    suppressClickUntilRef.current = performance.now() + 420;
    const currentIndex = primarySwipeTabs.indexOf(activeTab);
    const nextIndex = currentIndex + (deltaX < 0 ? 1 : -1);
    const nextTab = primarySwipeTabs[nextIndex];
    if (nextTab) onNavigate(nextTab);
  }, [activeTab, disabled, onNavigate, resetSwipe]);

  return (
    <div
      key={routeKey}
      className={`mobile-route-frame is-${navigationDirection} ${!disabled ? 'is-primary-swipe-enabled' : ''}`}
      onPointerDown={startSwipe}
      onPointerMove={moveSwipe}
      onPointerUp={finishSwipe}
      onPointerCancel={resetSwipe}
      onClickCapture={(event: ReactMouseEvent<HTMLDivElement>) => {
        if (performance.now() >= suppressClickUntilRef.current) return;
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      {children}
    </div>
  );
}
