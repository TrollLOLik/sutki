import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import { LoaderCircle } from 'lucide-react';
import { cx } from '../lib/cx';
import { BodyText } from './Typography';

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'danger' | 'success';
export type ButtonSize = 'sm' | 'md' | 'lg';
export type ButtonMode = 'solid' | 'outline' | 'soft' | 'ghost';
export type ButtonTone = 'primary' | 'neutral' | 'danger' | 'success' | 'warning' | 'inverse';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Visual format. When mode or tone is provided, the normalized button system is used. */
  mode?: ButtonMode;
  /** Semantic color, independent from the button format. */
  tone?: ButtonTone;
  stretched?: boolean;
  loading?: boolean;
  startIcon?: ReactNode;
  endIcon?: ReactNode;
  /** @deprecated Use startIcon. */
  before?: ReactNode;
  /** @deprecated Use endIcon. */
  after?: ReactNode;
}

export interface ButtonLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  size?: ButtonSize;
  mode?: ButtonMode;
  tone?: ButtonTone;
  stretched?: boolean;
  startIcon?: ReactNode;
  endIcon?: ReactNode;
}

export function Button({
  className,
  children,
  variant = 'primary',
  size = 'md',
  mode,
  tone,
  stretched = false,
  loading = false,
  startIcon,
  endIcon,
  before,
  after,
  disabled,
  type = 'button',
  ...props
}: ButtonProps) {
  const normalized = mode !== undefined || tone !== undefined;
  const leading = startIcon ?? before;
  const trailing = endIcon ?? after;
  return (
    <button
      {...props}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(
        'ui-button',
        `ui-button--${size}`,
        normalized && 'ui-button--system',
        normalized ? `ui-button--mode-${mode ?? 'solid'}` : `ui-button--${variant}`,
        normalized && `ui-button--tone-${tone ?? 'primary'}`,
        stretched && 'ui-button--stretched',
        className,
      )}
    >
      {loading ? <span className="ui-button__icon ui-button__icon--start" aria-hidden="true"><LoaderCircle className="ui-button__spinner" /></span> : leading ? <span className="ui-button__icon ui-button__icon--start" aria-hidden="true">{leading}</span> : null}
      <span className="ui-button__label">{typeof children === 'string' || typeof children === 'number' ? <BodyText className="ui-text--inherit-metrics" color="inherit">{children}</BodyText> : children}</span>
      {!loading && trailing ? <span className="ui-button__icon ui-button__icon--end" aria-hidden="true">{trailing}</span> : null}
    </button>
  );
}

export function ButtonLink({ className, children, size = 'md', mode = 'solid', tone = 'primary', stretched = false, startIcon, endIcon, ...props }: ButtonLinkProps) {
  return (
    <a
      {...props}
      className={cx('ui-button', 'ui-button--system', `ui-button--${size}`, `ui-button--mode-${mode}`, `ui-button--tone-${tone}`, stretched && 'ui-button--stretched', className)}
    >
      {startIcon ? <span className="ui-button__icon ui-button__icon--start" aria-hidden="true">{startIcon}</span> : null}
      <span className="ui-button__label">{children}</span>
      {endIcon ? <span className="ui-button__icon ui-button__icon--end" aria-hidden="true">{endIcon}</span> : null}
    </a>
  );
}
