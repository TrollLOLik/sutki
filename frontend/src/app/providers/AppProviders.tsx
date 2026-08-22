import type { ReactNode } from 'react';
import { SmoothScrollProvider } from '@shared/lib/scroll/ScrollSystem';
import { UIProvider } from '@ui';

export interface AppProvidersProps {
  children: ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <UIProvider>
      <SmoothScrollProvider>{children}</SmoothScrollProvider>
    </UIProvider>
  );
}
