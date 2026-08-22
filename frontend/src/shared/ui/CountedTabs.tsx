import { useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { cx } from '../lib/cx';
import { BadgeText, BodyText } from './Typography';

export interface CountedTabItem<T extends string> {
  value: T;
  label: string;
  count?: number;
  disabled?: boolean;
  panelId?: string;
}

export interface CountedTabsProps<T extends string> {
  items: readonly CountedTabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
  semantic?: 'tabs' | 'filter';
  animatedIndicator?: boolean;
  compact?: boolean;
  standardTypography?: boolean;
  mode?: 'settings' | 'list';
}

export function CountedTabs<T extends string>({ items, value, onChange, ariaLabel, className, semantic = 'tabs', animatedIndicator = false, compact = false, standardTypography = false, mode }: CountedTabsProps<T>) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const previousValueRef = useRef<T | undefined>(undefined);
  const [indicator, setIndicator] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  useLayoutEffect(() => {
    if (!animatedIndicator) return;
    const root = rootRef.current;
    const activeIndex = items.findIndex((item) => item.value === value);
    const active = refs.current[activeIndex];
    if (!root || !active) return;
    const measure = () => setIndicator({ left: active.offsetLeft, top: active.offsetTop, width: active.offsetWidth, height: active.offsetHeight });
    measure();
    const targetLeft = Math.max(0, active.offsetLeft - (root.clientWidth - active.offsetWidth) / 2);
    const animateScroll = previousValueRef.current !== undefined && !window.matchMedia('(min-width: 900px)').matches;
    root.scrollTo({ left: targetLeft, behavior: animateScroll ? 'smooth' : 'auto' });
    previousValueRef.current = value;
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    observer.observe(active);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [animatedIndicator, items.length, value]);
  const select = (index: number) => {
    const item = items[index];
    if (!item || item.disabled) return;
    onChange(item.value);
    refs.current[index]?.focus();
  };
  const move = (index: number, delta: 1 | -1) => {
    for (let attempt = 1; attempt <= items.length; attempt += 1) {
      const candidate = (index + delta * attempt + items.length) % items.length;
      if (!items[candidate]?.disabled) { select(candidate); return; }
    }
  };
  const onKeyDown = (index: number, event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowRight') { event.preventDefault(); move(index, 1); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); move(index, -1); }
    if (event.key === 'Home') { event.preventDefault(); select(items.findIndex((item) => !item.disabled)); }
    if (event.key === 'End') {
      event.preventDefault();
      for (let candidate = items.length - 1; candidate >= 0; candidate -= 1) {
        if (!items[candidate]?.disabled) { select(candidate); break; }
      }
    }
  };

  return (
    <div ref={rootRef} className={cx('ui-counted-tabs', mode && `ui-counted-tabs--${mode}`, items.length <= 3 && 'ui-counted-tabs--stretch', compact && 'ui-counted-tabs--compact', animatedIndicator && 'ui-counted-tabs--indicator', className)} role={semantic === 'tabs' ? 'tablist' : 'group'} aria-label={ariaLabel}>
      {animatedIndicator && indicator ? <i className="ui-counted-tabs__indicator" aria-hidden="true" style={indicator} /> : null}
      {items.map((item, index) => {
        const selected = item.value === value;
        const count = item.count ?? 0;
        return <button key={item.value} ref={(element) => { refs.current[index] = element; }} type="button" disabled={item.disabled} role={semantic === 'tabs' ? 'tab' : undefined} aria-selected={semantic === 'tabs' ? selected : undefined} aria-controls={semantic === 'tabs' ? item.panelId : undefined} aria-pressed={semantic === 'filter' ? selected : undefined} tabIndex={semantic === 'tabs' ? (selected ? 0 : -1) : undefined} className={selected ? 'is-active' : ''} onClick={() => onChange(item.value)} onKeyDown={(event) => onKeyDown(index, event)}>
          <BodyText className={standardTypography ? undefined : 'ui-text--inherit-metrics'} color="inherit" weight={500}>{item.label}</BodyText>
          {item.count != null ? <BadgeText as="b" className={standardTypography ? undefined : 'ui-text--inherit-metrics'} color="inherit">{count > 99 ? '99+' : count}</BadgeText> : null}
        </button>;
      })}
    </div>
  );
}
