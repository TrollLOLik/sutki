import type { ReactNode } from 'react';
import { EmptyState } from './EmptyState';

/** Alias with product-friendly naming for page stubs. */
export function Placeholder(props: { icon?: ReactNode; title: ReactNode; description?: ReactNode; actionLabel?: string; onAction?: () => void }) {
  return <EmptyState {...props} />;
}
