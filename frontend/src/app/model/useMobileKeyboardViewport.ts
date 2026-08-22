import { useEffect } from 'react';

export function useMobileKeyboardViewport(): void {
  useEffect(() => {
    const root = document.documentElement;
    const viewport = window.visualViewport;
    const mobile = window.matchMedia('(max-width: 899px)');
    let baselineHeight = Math.max(window.innerHeight, (viewport?.height ?? 0) + (viewport?.offsetTop ?? 0));
    let blurTimer = 0;
    let stableKeyboardOffset = 0;
    let keyboardOpeningUntil = 0;
    let settleTimers: number[] = [];

    const isEditable = (element: Element | null): boolean => {
      if (!(element instanceof HTMLElement) || element.matches(':disabled, [readonly]')) return false;
      if (element.isContentEditable || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) return true;
      if (!(element instanceof HTMLInputElement)) return false;
      return !['button', 'checkbox', 'color', 'file', 'hidden', 'radio', 'range', 'reset', 'submit'].includes(element.type);
    };

    const scrollFocusedElementIntoViewport = () => {
      const active = document.activeElement;
      if (!isEditable(active) || !(active instanceof HTMLElement)) return;
      const viewportHeight = Math.max(1, viewport?.height ?? window.innerHeight);
      const viewportTop = Math.max(0, viewport?.offsetTop ?? 0);
      const visibleTop = viewportTop + 12;
      const visibleBottom = viewportTop + viewportHeight - 16;
      const rect = active.getBoundingClientRect();
      const delta = rect.bottom > visibleBottom
        ? rect.bottom - visibleBottom
        : rect.top < visibleTop
          ? rect.top - visibleTop
          : 0;
      if (Math.abs(delta) < 2) return;

      let scrollParent = active.parentElement;
      while (scrollParent && scrollParent !== document.body) {
        const style = window.getComputedStyle(scrollParent);
        const scrollable = /(auto|scroll)/.test(style.overflowY) && scrollParent.scrollHeight > scrollParent.clientHeight;
        if (scrollable) break;
        scrollParent = scrollParent.parentElement;
      }
      if (scrollParent && scrollParent !== document.body) scrollParent.scrollTop += delta;
      else window.scrollBy({ top: delta, behavior: 'auto' });
    };

    const update = () => {
      if (!mobile.matches) {
        delete root.dataset.mobileKeyboard;
        root.style.removeProperty('--app-visual-viewport-height');
        root.style.removeProperty('--app-visual-viewport-offset-top');
        root.style.removeProperty('--app-keyboard-offset');
        return;
      }
      const viewportHeight = Math.max(1, viewport?.height ?? window.innerHeight);
      const viewportOffsetTop = Math.max(0, viewport?.offsetTop ?? 0);
      const visibleBottom = viewportHeight + viewportOffsetTop;
      const editableFocused = isEditable(document.activeElement);
      if (!editableFocused) baselineHeight = Math.max(baselineHeight, window.innerHeight, visibleBottom);
      const measuredKeyboardOffset = Math.max(0, baselineHeight - visibleBottom);
      const blurSettling = blurTimer !== 0 && !editableFocused;
      const keyboardOffset = blurSettling
        ? Math.max(stableKeyboardOffset, measuredKeyboardOffset)
        : measuredKeyboardOffset;
      stableKeyboardOffset = keyboardOffset;
      if (keyboardOffset > 96) keyboardOpeningUntil = 0;
      const keyboardOpening = editableFocused && performance.now() < keyboardOpeningUntil;

      root.style.setProperty('--app-visual-viewport-height', `${Math.round(viewportHeight)}px`);
      root.style.setProperty('--app-visual-viewport-offset-top', `${Math.round(viewportOffsetTop)}px`);
      root.style.setProperty('--app-keyboard-offset', `${Math.round(keyboardOffset)}px`);
      if (keyboardOffset > 96 || blurSettling || keyboardOpening) root.dataset.mobileKeyboard = 'open';
      else delete root.dataset.mobileKeyboard;
      if (editableFocused) window.requestAnimationFrame(scrollFocusedElementIntoViewport);
    };

    const scheduleSettledUpdates = () => {
      settleTimers.forEach((timer) => window.clearTimeout(timer));
      settleTimers = [0, 60, 160, 320].map((delay) => window.setTimeout(update, delay));
    };

    const onFocusIn = () => {
      if (!isEditable(document.activeElement)) return;
      window.clearTimeout(blurTimer);
      blurTimer = 0;
      keyboardOpeningUntil = performance.now() + 700;
      root.dataset.mobileKeyboard = 'open';
      scheduleSettledUpdates();
    };
    const onFocusOut = () => {
      window.clearTimeout(blurTimer);
      blurTimer = window.setTimeout(() => {
        blurTimer = 0;
        update();
        scheduleSettledUpdates();
      }, 180);
    };
    const onResize = () => window.requestAnimationFrame(update);

    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    viewport?.addEventListener('resize', onResize);
    viewport?.addEventListener('scroll', onResize);
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    update();
    return () => {
      window.clearTimeout(blurTimer);
      blurTimer = 0;
      settleTimers.forEach((timer) => window.clearTimeout(timer));
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
      viewport?.removeEventListener('resize', onResize);
      viewport?.removeEventListener('scroll', onResize);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
      delete root.dataset.mobileKeyboard;
      root.style.removeProperty('--app-visual-viewport-height');
      root.style.removeProperty('--app-visual-viewport-offset-top');
      root.style.removeProperty('--app-keyboard-offset');
    };
  }, []);
}
