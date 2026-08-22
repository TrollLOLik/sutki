import { ArrowDownUp, Check, ChevronDown } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { useMediaQuery } from '../lib/adaptivity';
import { BottomSheet } from './BottomSheet';
import { Button } from './Button';
import { IconButton } from './IconButton';
import { Surface } from './Surface';
import { BodyText } from './Typography';

export interface SortOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

export interface SortSurfaceProps<T extends string> {
  open: boolean;
  value: T;
  options: readonly SortOption<T>[];
  onOpenChange: (open: boolean) => void;
  onChange: (value: T) => void;
  label?: string;
  trigger?: 'icon' | 'field';
}

export function SortSurface<T extends string>({ open, value, options, onOpenChange, onChange, label = 'Сортировка', trigger = 'icon' }: SortSurfaceProps<T>) {
  const desktop = useMediaQuery('(min-width: 900px)');
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open || !desktop) return undefined;
    const onPointerDown = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) onOpenChange(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onOpenChange(false); (triggerRef.current ?? wrapRef.current?.querySelector<HTMLButtonElement>('button'))?.focus(); }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [desktop, onOpenChange, open]);

  const select = (next: T) => {
    onChange(next);
    onOpenChange(false);
    window.requestAnimationFrame(() => (triggerRef.current ?? wrapRef.current?.querySelector<HTMLButtonElement>('button'))?.focus());
  };
  const optionsView = <div className="ui-sort-options" role="radiogroup" aria-label={label}>{options.map((option) => <button key={option.value} type="button" role="radio" aria-checked={option.value === value} className={option.value === value ? 'is-selected' : ''} data-has-icon={option.icon ? 'true' : 'false'} onClick={() => select(option.value)}>{option.icon ? <i>{option.icon}</i> : null}<BodyText className="ui-text--inherit-metrics" color="inherit">{option.label}</BodyText><b>{option.value === value ? <Check size={15} /> : null}</b></button>)}</div>;

  const selectedLabel = options.find((option) => option.value === value)?.label ?? label;

  return <div className={`ui-sort-surface ui-sort-surface--${trigger}`} ref={wrapRef}>
    {trigger === 'field' ? (
      <Button className="ui-sort-trigger-field" size="md" mode="outline" tone="neutral" startIcon={<ArrowDownUp size={18} />} endIcon={<ChevronDown size={17} />} aria-expanded={open} aria-haspopup="dialog" onClick={() => onOpenChange(!open)}>{selectedLabel}</Button>
    ) : (
      <IconButton ref={triggerRef} label={label} icon={<ArrowDownUp size={21} />} mode="soft" tone="neutral" aria-expanded={open} aria-haspopup="dialog" onClick={() => onOpenChange(!open)} />
    )}
    {desktop && open ? <Surface className="ui-sort-popover" level="raised" radius="lg" role="dialog" aria-label={label}>{optionsView}</Surface> : null}
    {!desktop ? <BottomSheet open={open} className="ui-sort-sheet" title={label} subtitle="Выберите порядок отображения" hideCloseButton headerStart={<span className="ui-sort-sheet__icon"><ArrowDownUp size={21} /></span>} onClose={() => onOpenChange(false)}>{optionsView}</BottomSheet> : null}
  </div>;
}
