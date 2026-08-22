import type { CSSProperties, HTMLAttributes } from 'react';
import { cx } from '../lib/cx';

export interface GridProps extends HTMLAttributes<HTMLDivElement> {
  columns?: number | string;
  minColumnWidth?: number;
  gap?: number;
  align?: CSSProperties['alignItems'];
}

export function Grid({ columns, minColumnWidth, gap = 12, align, className, style, ...props }: GridProps) {
  const template = minColumnWidth
    ? `repeat(auto-fit, minmax(min(100%, ${minColumnWidth}px), 1fr))`
    : typeof columns === 'number'
      ? `repeat(${columns}, minmax(0, 1fr))`
      : columns;
  return <div {...props} className={cx('ui-grid', className)} style={{ gridTemplateColumns: template, gap, alignItems: align, ...style }} />;
}
