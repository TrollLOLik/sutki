import { createPortal } from 'react-dom';
import type { CSSProperties, ReactNode } from 'react';
import { useMediaQuery } from '../lib/adaptivity';
import { cx } from '../lib/cx';

export function RouteActionBarPortal({ children, contextClassName, contextStyle }: {
  children: ReactNode;
  contextClassName?: string;
  contextStyle?: CSSProperties;
}) {
  const mobile = useMediaQuery('(max-width: 899px)');
  const host = typeof document === 'undefined' ? null : document.getElementById('route-action-bar-host');

  if (!mobile || !host) return children;

  return createPortal(
    <div className={cx('route-action-bar-context', contextClassName)} style={contextStyle}>{children}</div>,
    host,
  );
}
