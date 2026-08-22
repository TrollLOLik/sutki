import { forwardRef, type AnchorHTMLAttributes, type ButtonHTMLAttributes } from 'react';
import { cx } from '../lib/cx';

export interface PressableProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  unstyled?: boolean;
}

export const Pressable = forwardRef<HTMLButtonElement, PressableProps>(function Pressable({ unstyled = true, className, type = 'button', ...props }, ref) {
  return <button {...props} ref={ref} type={type} className={cx('ui-pressable', unstyled && 'ui-pressable--unstyled', className)} />;
});

export interface PressableLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  unstyled?: boolean;
}

export const PressableLink = forwardRef<HTMLAnchorElement, PressableLinkProps>(function PressableLink({ unstyled = true, className, ...props }, ref) {
  return <a {...props} ref={ref} className={cx('ui-pressable-link', unstyled && 'ui-pressable--unstyled', className)} />;
});
