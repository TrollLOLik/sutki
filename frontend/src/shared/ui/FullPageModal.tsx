import type { ReactNode } from 'react';
import { cx } from '../lib/cx';
import { Button } from './Button';
import { ListPageHeader } from './ListPageHeader';
import { OverlaySurface } from './OverlaySurface';

export interface FullPageModalProps {
  open: boolean;
  title: string;
  ariaLabel?: string;
  onClose: () => void;
  children: ReactNode;
  headerEnd?: ReactNode;
  headerAfter?: ReactNode;
  footer?: ReactNode;
  closeLabel?: string;
  className?: string;
  layerClassName?: string;
  backdropClassName?: string;
  headerClassName?: string;
  footerClassName?: string;
  closeOnBackdrop?: boolean;
  id?: string;
  exitDuration?: number;
}

export function FullPageModal({
  open,
  title,
  ariaLabel = title,
  onClose,
  children,
  headerEnd,
  headerAfter,
  footer,
  closeLabel = 'Закрыть',
  className,
  layerClassName,
  backdropClassName,
  headerClassName,
  footerClassName,
  closeOnBackdrop,
  id,
  exitDuration,
}: FullPageModalProps) {
  return (
    <OverlaySurface
      open={open}
      onClose={onClose}
      ariaLabel={ariaLabel}
      className={cx('ui-full-page-modal', className)}
      layerClassName={layerClassName}
      backdropClassName={backdropClassName}
      closeOnBackdrop={closeOnBackdrop}
      id={id}
      exitDuration={exitDuration}
    >
      <ListPageHeader
        presentation="mobile"
        className={cx('ui-full-page-modal__header', headerClassName)}
        title={title}
        onBack={onClose}
        actions={headerEnd}
      />
      {headerAfter}
      {children}
      {footer ? <footer className={cx('ui-full-page-modal__footer', footerClassName)}>{footer}</footer> : null}
    </OverlaySurface>
  );
}

export function FullPageModalReset({ children = 'Сбросить', onClick }: { children?: ReactNode; onClick: () => void }) {
  return <Button className="ui-full-page-modal__reset" size="sm" mode="ghost" tone="primary" onClick={onClick}>{children}</Button>;
}
