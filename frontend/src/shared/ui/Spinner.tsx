import { LoaderCircle } from 'lucide-react';
import { cx } from '../lib/cx';

export function Spinner({ size = 'md', label = 'Загрузка', className }: { size?: 'sm' | 'md' | 'lg'; label?: string; className?: string }) {
  return <span className={cx('ui-spinner', `ui-spinner--${size}`, className)} role="status" aria-label={label}><LoaderCircle /></span>;
}
