import type { CSSProperties, HTMLAttributes } from 'react';
import { cx } from '../lib/cx';

export interface StackProps extends HTMLAttributes<HTMLDivElement> {
  direction?: 'row' | 'column';
  gap?: 4 | 6 | 8 | 10 | 12 | 16 | 20 | 24 | 32 | 40;
  align?: CSSProperties['alignItems'];
  justify?: CSSProperties['justifyContent'];
  wrap?: boolean;
}

export function Stack({ direction = 'column', gap = 12, align, justify, wrap = false, className, style, ...props }: StackProps) {
  return <div {...props} className={cx('ui-stack', className)} style={{ flexDirection: direction, gap, alignItems: align, justifyContent: justify, flexWrap: wrap ? 'wrap' : undefined, ...style }} />;
}
