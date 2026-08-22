'use client';

import { useEffect } from 'react';
import { initializeTheme } from '@shared/lib/theme';
import { App } from './App';
import { AppProviders } from './providers/AppProviders';

export function NextClientApplication({ initialLocation }: { initialLocation: string }) {
  useEffect(() => {
    initializeTheme();
  }, []);

  return (
    <AppProviders>
      <App initialLocation={initialLocation} />
    </AppProviders>
  );
}
