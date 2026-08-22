import type { HTMLAttributes } from 'react';
import { cx } from '../lib/cx';

export interface ContainerProps extends HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  gutters?: 'none' | 'sm' | 'md' | 'lg';
}

export function Container({ size = 'lg', gutters = 'md', className, ...props }: ContainerProps) {
  return <div {...props} className={cx('ui-container', `ui-container--${size}`, `ui-container--gutters-${gutters}`, className)} />;
}
