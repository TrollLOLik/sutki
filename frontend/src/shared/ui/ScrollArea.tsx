import { OverlayScrollbarsComponent } from 'overlayscrollbars-react';
import type { ReactNode } from 'react';

type ScrollAxis = 'vertical' | 'horizontal' | 'both';

export function ScrollArea({
  className,
  children,
  axis = 'vertical',
  ariaLabel,
}: {
  className?: string;
  children: ReactNode;
  axis?: ScrollAxis;
  ariaLabel?: string;
}) {
  return (
    <OverlayScrollbarsComponent
      element="div"
      className={className}
      data-overlayscrollbars-initialize=""
      data-lenis-prevent=""
      role={ariaLabel ? 'region' : undefined}
      aria-label={ariaLabel}
      options={{
        overflow: {
          x: axis === 'vertical' ? 'hidden' : 'scroll',
          y: axis === 'horizontal' ? 'hidden' : 'scroll',
        },
        scrollbars: {
          theme: 'os-theme-sutki',
          visibility: 'hidden',
          autoHide: 'never',
          autoHideDelay: 650,
          autoHideSuspend: true,
          dragScroll: true,
          clickScroll: 'instant',
          pointers: ['mouse', 'touch', 'pen'],
        },
      }}
      defer
    >
      {children}
    </OverlayScrollbarsComponent>
  );
}
