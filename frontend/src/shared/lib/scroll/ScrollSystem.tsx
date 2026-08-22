import Lenis from 'lenis';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';

type ScrollTarget = number | string | HTMLElement;

type SmoothScrollApi = {
  scrollTo: (target: ScrollTarget, options?: { immediate?: boolean; duration?: number; force?: boolean }) => void;
  start: () => void;
  stop: () => void;
  resize: () => void;
};

const SmoothScrollContext = createContext<SmoothScrollApi | null>(null);

export function SmoothScrollProvider({ children }: { children: ReactNode }) {
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    const nativeScrollMedia = window.matchMedia('(max-width: 899px), (pointer: coarse)');
    const reducedMotionMedia = window.matchMedia('(prefers-reduced-motion: reduce)');

    const configure = () => {
      lenisRef.current?.destroy();
      lenisRef.current = null;

      // Mobile browsers already provide inertial scrolling and dynamic browser
      // chrome. A second scroll interpolator makes direction-based app chrome
      // oscillate while a single gesture is still settling.
      if (nativeScrollMedia.matches || reducedMotionMedia.matches) return;

      lenisRef.current = new Lenis({
        autoRaf: true,
        autoResize: true,
        autoToggle: true,
        anchors: true,
        smoothWheel: true,
        syncTouch: false,
        overscroll: false,
        lerp: 0.095,
        wheelMultiplier: 0.92,
        touchMultiplier: 1,
        stopInertiaOnNavigate: true,
        prevent: (node) => node instanceof HTMLElement && node.hasAttribute('data-lenis-prevent'),
      });
    };

    configure();
    nativeScrollMedia.addEventListener('change', configure);
    reducedMotionMedia.addEventListener('change', configure);
    return () => {
      nativeScrollMedia.removeEventListener('change', configure);
      reducedMotionMedia.removeEventListener('change', configure);
      lenisRef.current?.destroy();
      lenisRef.current = null;
    };
  }, []);

  const scrollTo = useCallback<SmoothScrollApi['scrollTo']>((target, options) => {
    const lenis = lenisRef.current;
    if (lenis) {
      lenis.scrollTo(target, {
        duration: options?.duration ?? 0.85,
        immediate: options?.immediate,
        force: options?.force,
      });
      return;
    }

    if (typeof target === 'number') {
      window.scrollTo({ top: target, behavior: options?.immediate ? 'auto' : 'smooth' });
      return;
    }
    if (typeof target === 'string') {
      const element = target === 'top' ? document.documentElement : document.querySelector<HTMLElement>(target);
      element?.scrollIntoView({ behavior: options?.immediate ? 'auto' : 'smooth', block: 'start' });
      return;
    }
    target.scrollIntoView({ behavior: options?.immediate ? 'auto' : 'smooth', block: 'start' });
  }, []);

  const value = useMemo<SmoothScrollApi>(() => ({
    scrollTo,
    start: () => lenisRef.current?.start(),
    stop: () => lenisRef.current?.stop(),
    resize: () => lenisRef.current?.resize(),
  }), [scrollTo]);

  return <SmoothScrollContext.Provider value={value}>{children}</SmoothScrollContext.Provider>;
}

export function useSmoothScroll(): SmoothScrollApi {
  const value = useContext(SmoothScrollContext);
  if (!value) throw new Error('useSmoothScroll must be used inside SmoothScrollProvider');
  return value;
}

type ScrollLockState = {
  scrollY: number;
  fixedBody: boolean;
  htmlOverflow: string;
  htmlOverscroll: string;
  bodyPosition: string;
  bodyTop: string;
  bodyLeft: string;
  bodyRight: string;
  bodyWidth: string;
  bodyPaddingRight: string;
};

let scrollLockCount = 0;
let scrollLockState: ScrollLockState | null = null;
let scrollLockController: SmoothScrollApi | null = null;

function acquirePageScrollLock(smoothScroll: SmoothScrollApi | null): void {
  scrollLockCount += 1;
  if (scrollLockCount > 1) return;

  const html = document.documentElement;
  const body = document.body;
  const scrollY = window.scrollY;
  const fixedBody = !window.matchMedia('(min-width: 900px)').matches;
  const scrollbarWidth = Math.max(0, window.innerWidth - html.clientWidth);
  scrollLockState = {
    scrollY,
    fixedBody,
    htmlOverflow: html.style.overflow,
    htmlOverscroll: html.style.overscrollBehavior,
    bodyPosition: body.style.position,
    bodyTop: body.style.top,
    bodyLeft: body.style.left,
    bodyRight: body.style.right,
    bodyWidth: body.style.width,
    bodyPaddingRight: body.style.paddingRight,
  };
  scrollLockController = smoothScroll;

  smoothScroll?.stop();
  html.dataset.scrollLocked = 'true';
  html.style.overflow = 'hidden';
  html.style.overscrollBehavior = 'none';
  if (fixedBody) {
    body.style.position = 'fixed';
    body.style.top = '-' + scrollY + 'px';
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
  }
  if (scrollbarWidth > 0) body.style.paddingRight = scrollbarWidth + 'px';
}

function releasePageScrollLock(): void {
  scrollLockCount = Math.max(0, scrollLockCount - 1);
  if (scrollLockCount > 0 || !scrollLockState) return;

  const html = document.documentElement;
  const body = document.body;
  const previous = scrollLockState;
  const smoothScroll = scrollLockController;
  scrollLockState = null;
  scrollLockController = null;

  html.style.overflow = previous.htmlOverflow;
  html.style.overscrollBehavior = previous.htmlOverscroll;
  body.style.position = previous.bodyPosition;
  body.style.top = previous.bodyTop;
  body.style.left = previous.bodyLeft;
  body.style.right = previous.bodyRight;
  body.style.width = previous.bodyWidth;
  body.style.paddingRight = previous.bodyPaddingRight;

  if (previous.fixedBody) window.scrollTo(0, previous.scrollY);
  smoothScroll?.start();
  requestAnimationFrame(() => {
    if (previous.fixedBody) smoothScroll?.scrollTo(previous.scrollY, { immediate: true, force: true });
    smoothScroll?.resize();
    requestAnimationFrame(() => {
      if (scrollLockCount === 0) delete html.dataset.scrollLocked;
    });
  });
}

export function usePageScrollLock(locked: boolean) {
  const smoothScroll = useContext(SmoothScrollContext);

  useEffect(() => {
    if (!locked) return;
    acquirePageScrollLock(smoothScroll);
    return releasePageScrollLock;
  }, [locked, smoothScroll]);
}
