import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { IconButton } from './IconButton';
import { useDialogA11y } from './lib/useDialogA11y';
import { usePageScrollLock } from '../lib/scroll/ScrollSystem';
import { cx } from '../lib/cx';
import { usePresence } from './lib/usePresence';
import { BodyText, DescriptionText } from './Typography';

export interface BottomSheetProps {
  open: boolean;
  title: ReactNode;
  subtitle?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  closeOnBackdrop?: boolean;
  desktopPresentation?: 'sheet' | 'modal';
  desktopNested?: boolean;
  className?: string;
  bodyClassName?: string;
  hideHeader?: boolean;
  hideCloseButton?: boolean;
  headerStart?: ReactNode;
}

const EXIT_DURATION_MS = 420;

export function BottomSheet({ open, title, subtitle, children, footer, onClose, closeOnBackdrop = true, desktopPresentation = 'sheet', desktopNested = false, className, bodyClassName, hideHeader = false, hideCloseButton = false, headerStart }: BottomSheetProps) {
  const { rendered, closing } = usePresence(open, EXIT_DURATION_MS);
  const closeRequestedRef = useRef(false);
  useEffect(() => {
    if (open && !closing) closeRequestedRef.current = false;
  }, [closing, open]);

  const requestClose = useCallback(() => {
    if (!open || closing || closeRequestedRef.current) return;
    closeRequestedRef.current = true;
    onClose();
  }, [closing, onClose, open]);

  const { dialogRef, titleId, descriptionId, onKeyDown } = useDialogA11y({
    open: rendered,
    onClose: requestClose,
  });
  usePageScrollLock(rendered);
  if (!rendered) return null;
  const desktopModal = desktopPresentation === 'modal';

  return createPortal(
    <div className={cx('ui-sheet-layer', desktopModal && 'ui-sheet-layer--desktop-modal', desktopModal && desktopNested && 'ui-sheet-layer--desktop-nested', closing && 'is-closing')} role="presentation" data-overlay-root="sheet">
      <div
        className="ui-overlay__backdrop"
        role="presentation"
        onMouseDown={closeOnBackdrop ? requestClose : undefined}
      />
      <section
        ref={dialogRef}
        className={cx('ui-bottom-sheet', desktopModal && 'ui-bottom-sheet--desktop-modal', closing && 'is-closing', className)}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={subtitle ? descriptionId : undefined}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <i className="ui-bottom-sheet__handle" aria-hidden="true" />
        {hideHeader ? <span id={titleId} className="ui-visually-hidden">{title}</span> : null}
        {hideHeader && subtitle ? <span id={descriptionId} className="ui-visually-hidden">{subtitle}</span> : null}
        {!hideHeader ? <header className={headerStart ? 'has-start' : undefined}>
          {headerStart ? <div className="ui-bottom-sheet__header-start">{headerStart}</div> : null}
          <div>
            <h2 id={titleId}><BodyText className="ui-text--inherit-metrics" color="inherit">{title}</BodyText></h2>
            {subtitle ? <p id={descriptionId}><DescriptionText className="ui-text--inherit-metrics" color="inherit">{subtitle}</DescriptionText></p> : null}
          </div>
          {!hideCloseButton ? <IconButton label={'\u0417\u0430\u043a\u0440\u044b\u0442\u044c'} variant="plain" icon={<X size={20} />} onClick={requestClose} /> : null}
        </header> : null}
        {children ? <div className={cx('ui-bottom-sheet__body', bodyClassName)}>{children}</div> : null}
        {footer ? <footer className="ui-bottom-sheet__footer">{footer}</footer> : null}
      </section>
    </div>,
    document.body,
  );
}
