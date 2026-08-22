import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useAdaptivity, type AdaptivitySnapshot } from '../../lib/adaptivity';
import { cx } from '../../lib/cx';

export type UIDensity = 'comfortable' | 'compact';

export interface UIContextValue {
  density: UIDensity;
  adaptivity: AdaptivitySnapshot;
}

const UIContext = createContext<UIContextValue | null>(null);

export interface UIProviderProps {
  children: ReactNode;
  density?: UIDensity;
  className?: string;
}

export function UIProvider({ children, density = 'comfortable', className }: UIProviderProps) {
  const adaptivity = useAdaptivity();
  const value = useMemo(() => ({ density, adaptivity }), [adaptivity, density]);

  return (
    <UIContext.Provider value={value}>
      <div
        className={cx('ui-root', `ui-root--${density}`, className)}
        data-ui-density={density}
      >
        {children}
      </div>
    </UIContext.Provider>
  );
}

export function useUI(): UIContextValue {
  const value = useContext(UIContext);
  if (!value) throw new Error('useUI must be used inside UIProvider');
  return value;
}
