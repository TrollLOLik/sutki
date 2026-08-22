import { forwardRef, type AnchorHTMLAttributes, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cx } from '../lib/cx';
import type { ButtonMode, ButtonSize, ButtonTone } from './Button';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  icon: ReactNode;
  size?: ButtonSize;
  variant?: 'plain' | 'surface' | 'primary' | 'danger';
  mode?: ButtonMode;
  tone?: ButtonTone;
}

export interface IconButtonLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  label: string;
  icon: ReactNode;
  size?: ButtonSize;
  mode?: ButtonMode;
  tone?: ButtonTone;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton({ label, icon, className, size = 'md', variant = 'surface', mode, tone, type = 'button', ...props }, ref) {
  const normalized = mode !== undefined || tone !== undefined;
  return (
    <button
      {...props}
      ref={ref}
      type={type}
      aria-label={label}
      title={props.title ?? label}
      className={cx(
        'ui-icon-button',
        `ui-icon-button--${size}`,
        normalized && 'ui-icon-button--system',
        normalized ? `ui-icon-button--mode-${mode ?? 'solid'}` : `ui-icon-button--${variant}`,
        normalized && `ui-icon-button--tone-${tone ?? 'primary'}`,
        className,
      )}
    >
      {icon}
    </button>
  );
});

export function IconButtonLink({ label, icon, className, size = 'md', mode = 'soft', tone = 'neutral', ...props }: IconButtonLinkProps) {
  return <a {...props} aria-label={label} title={props.title ?? label} className={cx('ui-icon-button', 'ui-icon-button--system', `ui-icon-button--${size}`, `ui-icon-button--mode-${mode}`, `ui-icon-button--tone-${tone}`, className)}>{icon}</a>;
}
