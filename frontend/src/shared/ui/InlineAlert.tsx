import type { ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Info, TriangleAlert } from 'lucide-react';
import { cx } from '../lib/cx';
import { BodyText, DescriptionText } from './Typography';

const icons = { info: Info, success: CheckCircle2, warning: TriangleAlert, danger: AlertCircle };
export function InlineAlert({ tone = 'info', title, children, className }: { tone?: keyof typeof icons; title?: ReactNode; children: ReactNode; className?: string }) {
  const Icon = icons[tone];
  return <div className={cx('ui-alert', `ui-alert--${tone}`, className)} role={tone === 'danger' ? 'alert' : 'status'}><Icon size={20} /><div>{title ? <BodyText as="strong" weight={500} color="inherit">{title}</BodyText> : null}<DescriptionText as="p" color="inherit">{children}</DescriptionText></div></div>;
}
