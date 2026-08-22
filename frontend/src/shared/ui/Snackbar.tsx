import type { ReactNode } from 'react';
import { Check, X } from 'lucide-react';
import { IconButton } from './IconButton';
import { cx } from '../lib/cx';
import { BodyText } from './Typography';

export interface SnackbarProps {
  open: boolean;
  children: ReactNode;
  action?: ReactNode;
  onClose?: () => void;
  tone?: 'neutral' | 'success' | 'danger';
}

export function Snackbar({ open, children, action, onClose, tone = 'neutral' }: SnackbarProps) {
  if (!open) return null;
  return <div className={cx('ui-snackbar', `ui-snackbar--${tone}`)} role="status">{tone === 'success' ? <i aria-hidden="true"><Check size={18} /></i> : null}<BodyText className="ui-text--inherit-metrics" color="inherit">{children}</BodyText>{action}{onClose ? <IconButton label="Закрыть" size="sm" variant="plain" icon={<X size={16} />} onClick={onClose} /> : null}</div>;
}
