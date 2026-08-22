import type { ReactNode } from 'react';
import { cx } from '../lib/cx';

export interface DialogActionsProps {
  reset?: ReactNode;
  secondary?: ReactNode;
  primary: ReactNode;
  className?: string;
}

/**
 * Единый порядок действий во всех окнах:
 * сброс слева, вспомогательные действия рядом, основное действие справа.
 */
export function DialogActions({ reset, secondary, primary, className }: DialogActionsProps) {
  const single = !reset && !secondary;
  return (
    <div className={cx('ui-dialog-actions', single && 'is-single', className)}>
      {reset ? <div className="ui-dialog-actions__start">{reset}</div> : null}
      <div className="ui-dialog-actions__end">{secondary}{primary}</div>
    </div>
  );
}
