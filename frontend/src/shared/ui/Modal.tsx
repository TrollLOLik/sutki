import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cx } from '../lib/cx';
import { useDialogA11y } from './lib/useDialogA11y';
import { usePageScrollLock } from '../lib/scroll/ScrollSystem';
import { usePresence } from './lib/usePresence';
import { DialogHeader, type DialogTone } from './DialogHeader';

export interface ModalProps {
  open: boolean;
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  tone?: DialogTone;
  children?: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  size?: 'sm' | 'md' | 'lg';
  closeOnBackdrop?: boolean;
  className?: string;
  layerClassName?: string;
  bodyClassName?: string;
  footerClassName?: string;
}

export function Modal({ open, title, description, icon, tone = 'primary', children, footer, onClose, size = 'md', closeOnBackdrop = true, className, layerClassName, bodyClassName, footerClassName }: ModalProps) {
  const { rendered, closing } = usePresence(open, 420);
  const requestClose = () => { if (open && !closing) onClose(); };
  const { dialogRef, titleId, descriptionId, onKeyDown } = useDialogA11y({ open: rendered, onClose: requestClose });
  usePageScrollLock(rendered);
  if (!rendered) return null;

  return createPortal(
    <div className={cx('ui-overlay', layerClassName, closing && 'is-closing')} role="presentation" data-overlay-root="modal">
      <div
        className="ui-overlay__backdrop"
        role="presentation"
        onMouseDown={closeOnBackdrop ? requestClose : undefined}
      />
      <section
        ref={dialogRef}
        className={cx('ui-modal', `ui-modal--${size}`, closing && 'is-closing', className)}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <DialogHeader title={title} description={description} icon={icon} tone={tone} onClose={requestClose} titleId={titleId} descriptionId={description ? descriptionId : undefined} />
        {children ? <div className={cx('ui-modal__body', bodyClassName)}>{children}</div> : null}
        {footer ? <footer className={cx('ui-modal__footer', footerClassName)}>{footer}</footer> : null}
      </section>
    </div>,
    document.body,
  );
}
