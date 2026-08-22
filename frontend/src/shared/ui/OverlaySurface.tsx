import { useCallback, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cx } from '../lib/cx';
import { usePageScrollLock } from '../lib/scroll/ScrollSystem';
import { useDialogA11y } from './lib/useDialogA11y';
import { usePresence } from './lib/usePresence';

export interface OverlaySurfaceProps {
  open: boolean;
  onClose: () => void;
  ariaLabel: string;
  children: ReactNode;
  className?: string;
  layerClassName?: string;
  backdropClassName?: string;
  closeOnBackdrop?: boolean;
  id?: string;
  exitDuration?: number;
}

export function OverlaySurface({
  open,
  onClose,
  ariaLabel,
  children,
  className,
  layerClassName,
  backdropClassName,
  closeOnBackdrop = true,
  id,
  exitDuration = 420,
}: OverlaySurfaceProps) {
  const { rendered, closing } = usePresence(open, exitDuration);
  const requestClose = useCallback(() => {
    if (open && !closing) onClose();
  }, [closing, onClose, open]);
  const { dialogRef, onKeyDown } = useDialogA11y({ open: rendered, onClose: requestClose });
  usePageScrollLock(rendered);

  if (!rendered) return null;

  return createPortal(
    <div className={cx('ui-overlay-surface', layerClassName, closing && 'is-closing')} role="presentation" data-overlay-root="surface">
      <div className={cx('ui-overlay-surface__backdrop', backdropClassName)} role="presentation" onMouseDown={closeOnBackdrop ? requestClose : undefined} />
      <section
        id={id}
        ref={dialogRef}
        className={cx('ui-overlay-surface__content', className, closing && 'is-closing')}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        {children}
      </section>
    </div>,
    document.body,
  );
}
