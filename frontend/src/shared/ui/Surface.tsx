import type { ElementType, HTMLAttributes } from 'react';
import { cx } from '../lib/cx';

export interface SurfaceProps extends HTMLAttributes<HTMLDivElement> {
  as?: ElementType;
  level?: 'base' | 'raised' | 'muted' | 'glass';
  radius?: 'sm' | 'md' | 'lg' | 'xl';
  bordered?: boolean;
  interactive?: boolean;
}

export function Surface({ as: Component = 'div', className, level = 'raised', radius = 'lg', bordered = true, interactive = false, ...props }: SurfaceProps) {
  return <Component {...props} className={cx('ui-surface', `ui-surface--${level}`, `ui-surface--${radius}`, bordered && 'ui-surface--bordered', interactive && 'ui-surface--interactive', className)} />;
}
