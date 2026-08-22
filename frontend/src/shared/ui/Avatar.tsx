import type { HTMLAttributes } from 'react';
import { cx } from '../lib/cx';

export interface AvatarProps extends HTMLAttributes<HTMLSpanElement> {
  src?: string;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  online?: boolean;
  verified?: boolean;
}

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'С';
}

export function Avatar({ src, name = 'Пользователь', size = 'md', online = false, verified = false, className, ...props }: AvatarProps) {
  return (
    <span {...props} className={cx('ui-avatar', `ui-avatar--${size}`, className)} aria-label={name}>
      {src ? <img src={src} alt="" /> : <span>{initials(name)}</span>}
      {online ? <i className="ui-avatar__online" aria-label="В сети" /> : null}
      {verified ? <b className="ui-avatar__verified" aria-label="Проверен">✓</b> : null}
    </span>
  );
}
