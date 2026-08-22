import { cx } from '../lib/cx';

export interface ProgressProps {
  value: number;
  max?: number;
  label?: string;
  className?: string;
}

export function Progress({ value, max = 100, label = 'Прогресс', className }: ProgressProps) {
  const percent = Math.max(0, Math.min(100, max > 0 ? value / max * 100 : 0));
  return <div className={cx('ui-progress', className)} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}><i style={{ width: `${percent}%` }} /></div>;
}
