const APP_HISTORY_KEY = '__sutkiHistoryIndex';
const APP_HISTORY_SCROLL_KEY = '__sutkiScrollY';

export function readAppHistoryIndex(state: unknown): number | null {
  if (typeof state !== 'object' || state === null) return null;

  const index = Reflect.get(state, APP_HISTORY_KEY);
  return Number.isInteger(index) && index >= 0 ? index : null;
}

export function withAppHistoryIndex(state: unknown, index: number): Record<string, unknown> {
  const current = typeof state === 'object' && state !== null && !Array.isArray(state)
    ? state as Record<string, unknown>
    : {};

  return { ...current, [APP_HISTORY_KEY]: index };
}

export function readAppHistoryScroll(state: unknown): number | null {
  if (typeof state !== 'object' || state === null) return null;

  const scrollY = Reflect.get(state, APP_HISTORY_SCROLL_KEY);
  return typeof scrollY === 'number' && Number.isFinite(scrollY) && scrollY >= 0 ? scrollY : null;
}

export function withAppHistoryScroll(state: unknown, scrollY: number): Record<string, unknown> {
  const current = typeof state === 'object' && state !== null && !Array.isArray(state)
    ? state as Record<string, unknown>
    : {};

  return { ...current, [APP_HISTORY_SCROLL_KEY]: Math.max(0, scrollY) };
}
