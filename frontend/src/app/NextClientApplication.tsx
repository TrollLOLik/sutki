'use client';

import { useEffect } from 'react';
import type { PublicListingsBootstrap } from '@shared/api/publicListings';
import { initializeTheme } from '@shared/lib/theme';
import { App } from './App';
import { AppProviders } from './providers/AppProviders';

export function NextClientApplication({ initialLocation, bootstrap }: { initialLocation: string; bootstrap: PublicListingsBootstrap }) {
  useEffect(() => {
    initializeTheme();
  }, []);

  return (
    <AppProviders>
      <App initialLocation={initialLocation} listingsBootstrap={bootstrap} />
    </AppProviders>
  );
}
