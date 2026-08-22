import { forwardRef, type ElementType, type HTMLAttributes, type ReactNode } from 'react';
import { cx } from '../lib/cx';

export type TypographyVariant =
  | 'display'
  | 'title1'
  | 'title2'
  | 'title3'
  | 'headline'
  | 'body'
  | 'subhead'
  | 'caption'
  | 'label';

export interface TypographyProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType;
  variant?: TypographyVariant;
  tone?: 'primary' | 'secondary' | 'muted' | 'accent' | 'danger' | 'success';
  weight?: 'regular' | 'medium' | 'semibold' | 'bold' | 'black';
  truncate?: boolean;
  children: ReactNode;
}

export function Typography({ as: Component = 'span', variant = 'body', tone = 'primary', weight, truncate = false, className, ...props }: TypographyProps) {
  return <Component {...props} className={cx('ui-typography', `ui-typography--${variant}`, `ui-typography--${tone}`, weight && `ui-typography--${weight}`, truncate && 'ui-typography--truncate', className)} />;
}

export type TextWeight = 400 | 500;
export type TextColor = 'default' | 'secondary' | 'muted' | 'accent' | 'success' | 'danger' | 'warning' | 'inverse' | 'inherit';

export interface TextComponentProps extends Omit<HTMLAttributes<HTMLElement>, 'color'> {
  as?: ElementType;
  weight?: TextWeight;
  color?: TextColor;
  truncate?: boolean;
  children: ReactNode;
}

const TextRole = forwardRef<HTMLElement, TextComponentProps & { role: string }>(function TextRole({ as: Component = 'span', role, weight, color, truncate = false, className, ...props }, ref) {
  return <Component {...props} ref={ref} className={cx('ui-text', `ui-text--${role}`, `ui-text--weight-${weight}`, `ui-text--color-${color}`, truncate && 'ui-text--truncate', className)} />;
});

export const HeroTitle = forwardRef<HTMLElement, TextComponentProps>(function HeroTitle({ as = 'h1', weight = 500, color = 'default', ...props }, ref) {
  return <TextRole {...props} ref={ref} as={as} role="hero-title" weight={weight} color={color} />;
});

export const PageTitle = forwardRef<HTMLElement, TextComponentProps>(function PageTitle({ as = 'h1', weight = 500, color = 'default', ...props }, ref) {
  return <TextRole {...props} ref={ref} as={as} role="page-title" weight={weight} color={color} />;
});

export const SectionTitle = forwardRef<HTMLElement, TextComponentProps>(function SectionTitle({ as = 'h2', weight = 500, color = 'default', ...props }, ref) {
  return <TextRole {...props} ref={ref} as={as} role="section-title" weight={weight} color={color} />;
});

export const BodyText = forwardRef<HTMLElement, TextComponentProps>(function BodyText({ as = 'span', weight = 400, color = 'default', ...props }, ref) {
  return <TextRole {...props} ref={ref} as={as} role="body" weight={weight} color={color} />;
});

export const DescriptionText = forwardRef<HTMLElement, TextComponentProps>(function DescriptionText({ as = 'span', weight = 400, color = 'secondary', ...props }, ref) {
  return <TextRole {...props} ref={ref} as={as} role="description" weight={weight} color={color} />;
});

export const BadgeText = forwardRef<HTMLElement, TextComponentProps>(function BadgeText({ as = 'span', weight = 500, color = 'accent', ...props }, ref) {
  return <TextRole {...props} ref={ref} as={as} role="badge" weight={weight} color={color} />;
});
