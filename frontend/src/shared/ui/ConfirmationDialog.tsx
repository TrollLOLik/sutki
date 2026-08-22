import type { ReactNode } from 'react';
import { cx } from '../lib/cx';
import { OverlaySurface } from './OverlaySurface';
import { DialogHeader } from './DialogHeader';

export interface ConfirmationDialogProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  icon: ReactNode;
  tone?: 'primary' | 'success' | 'warning' | 'danger';
  children?: ReactNode;
  actions: ReactNode;
  singleAction?: boolean;
  closeOnBackdrop?: boolean;
  mobileSheet?: boolean;
  className?: string;
  standardTypography?: boolean;
}

export function ConfirmationDialog({
  open,
  onClose,
  title,
  description,
  icon,
  tone = 'warning',
  children,
  actions,
  singleAction = false,
  closeOnBackdrop = true,
  mobileSheet = false,
  className,
}: ConfirmationDialogProps) {
  return (
    <OverlaySurface
      open={open}
      onClose={onClose}
      ariaLabel={typeof title === 'string' ? title : 'Подтверждение действия'}
      closeOnBackdrop={closeOnBackdrop}
      layerClassName={cx('ui-confirm-layer', mobileSheet && 'ui-confirm-layer--mobile-sheet')}
      className={cx('ui-confirm-dialog', `ui-confirm-dialog--${tone}`, className)}
    >
      <DialogHeader title={title} description={description} icon={icon} tone={tone} onClose={onClose} showClose={false} />
      {children ? <div className="ui-confirm-dialog__body">{children}</div> : null}
      <footer className={cx('ui-confirm-dialog__actions', singleAction && 'is-single')}>{actions}</footer>
    </OverlaySurface>
  );
}
