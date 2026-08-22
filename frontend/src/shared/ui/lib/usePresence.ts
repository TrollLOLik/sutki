import { useEffect, useState } from 'react';

export type PresenceState = 'closed' | 'opening' | 'open' | 'closing';

export function usePresence(open: boolean, exitDuration = 420) {
  const [rendered, setRendered] = useState(open);
  const [state, setState] = useState<PresenceState>(open ? 'open' : 'closed');

  useEffect(() => {
    if (open) {
      setRendered(true);
      setState('opening');
      const frame = window.requestAnimationFrame(() => setState('open'));
      return () => window.cancelAnimationFrame(frame);
    }

    if (!rendered) {
      setState('closed');
      return undefined;
    }

    setState('closing');
    const timeout = window.setTimeout(() => {
      setRendered(false);
      setState('closed');
    }, exitDuration);
    return () => window.clearTimeout(timeout);
  }, [exitDuration, open, rendered]);

  return { rendered, state, closing: state === 'closing' };
}
