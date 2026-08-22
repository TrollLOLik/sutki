import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from '../lib/cx';
import { DescriptionText, SectionTitle } from './Typography';

export interface FormSectionProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}

export function FormSection({ title, description, action, className, children, ...props }: FormSectionProps) {
  return (
    <section {...props} className={cx('ui-form-section', className)}>
      <header><div><SectionTitle as="h3">{title}</SectionTitle>{description ? <DescriptionText as="p">{description}</DescriptionText> : null}</div>{action}</header>
      <div className="ui-form-section__body">{children}</div>
    </section>
  );
}
