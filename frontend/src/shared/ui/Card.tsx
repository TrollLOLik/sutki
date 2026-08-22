import type { HTMLAttributes, ReactNode } from 'react';
import { Surface, type SurfaceProps } from './Surface';
import { cx } from '../lib/cx';

export interface CardProps extends Omit<SurfaceProps, 'children'> {
  header?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export function Card({ header, footer, children, padding = 'md', className, ...props }: CardProps) {
  return (
    <Surface {...props} className={cx('ui-card', `ui-card--padding-${padding}`, className)}>
      {header ? <div className="ui-card__header">{header}</div> : null}
      {children ? <div className="ui-card__body">{children}</div> : null}
      {footer ? <div className="ui-card__footer">{footer}</div> : null}
    </Surface>
  );
}

export type CardBodyProps = HTMLAttributes<HTMLDivElement>;
