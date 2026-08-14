import { useCallback, useEffect, useRef } from 'react';

import { hapticTapLight } from '@/lib/haptics';

const MAX_CONFIRMATION_DELAY_MS = 1000;

export function useHapticValueChange<T>(value: T) {
  const previousValue = useRef(value);
  const pendingChange = useRef<{ value: T; requestedAt: number } | null>(null);

  useEffect(() => {
    if (Object.is(previousValue.current, value)) return;

    previousValue.current = value;
    const pending = pendingChange.current;
    pendingChange.current = null;

    if (
      pending
      && Object.is(pending.value, value)
      && Date.now() - pending.requestedAt <= MAX_CONFIRMATION_DELAY_MS
    ) {
      hapticTapLight();
    }
  }, [value]);

  return useCallback((nextValue: T) => {
    pendingChange.current = { value: nextValue, requestedAt: Date.now() };
  }, []);
}
