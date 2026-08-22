import { useCallback, useEffect, useRef, useState } from 'react';

export interface TransientMessageController {
  message: string;
  showMessage: (message: string, durationMs?: number) => void;
  clearMessage: () => void;
}

export function useTransientMessage(defaultDurationMs = 1800): TransientMessageController {
  const [message, setMessage] = useState('');
  const timerRef = useRef<number | null>(null);

  const clearMessage = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setMessage('');
  }, []);

  const showMessage = useCallback((nextMessage: string, durationMs = defaultDurationMs) => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    setMessage(nextMessage);
    timerRef.current = window.setTimeout(() => {
      setMessage('');
      timerRef.current = null;
    }, durationMs);
  }, [defaultDurationMs]);

  useEffect(() => () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
  }, []);

  return { message, showMessage, clearMessage };
}
