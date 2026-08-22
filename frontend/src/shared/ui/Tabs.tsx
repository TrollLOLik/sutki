import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { cx } from '../lib/cx';
import { BadgeText, BodyText } from './Typography';

export interface TabOption<T extends string> {
  value: T;
  label: ReactNode;
  badge?: number;
  disabled?: boolean;
}

export interface TabsProps<T extends string> {
  value: T;
  options: readonly TabOption<T>[];
  onChange: (value: T) => void;
  ariaLabel?: string;
  className?: string;
}

export function Tabs<T extends string>({ value, options, onChange, ariaLabel = 'Разделы', className }: TabsProps<T>) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const moveFocus = (currentIndex: number, direction: 1 | -1) => {
    if (!options.length) return;
    let nextIndex = currentIndex;
    for (let attempts = 0; attempts < options.length; attempts += 1) {
      nextIndex = (nextIndex + direction + options.length) % options.length;
      if (!options[nextIndex]?.disabled) break;
    }
    const option = options[nextIndex];
    if (!option || option.disabled) return;
    onChange(option.value);
    refs.current[nextIndex]?.focus();
  };

  const onKeyDown = (index: number, event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      moveFocus(index, 1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      moveFocus(index, -1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      const first = options.findIndex((option) => !option.disabled);
      if (first >= 0) {
        onChange(options[first].value);
        refs.current[first]?.focus();
      }
    } else if (event.key === 'End') {
      event.preventDefault();
      let last = -1;
      for (let candidate = options.length - 1; candidate >= 0; candidate -= 1) {
        if (!options[candidate]?.disabled) { last = candidate; break; }
      }
      if (last >= 0) {
        onChange(options[last].value);
        refs.current[last]?.focus();
      }
    }
  };

  return (
    <div className={cx('ui-tabs', className)} role="tablist" aria-label={ariaLabel}>
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            ref={(element) => { refs.current[index] = element; }}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            disabled={option.disabled}
            className={selected ? 'is-active' : ''}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => onKeyDown(index, event)}
          >
            <BodyText className="ui-text--inherit-metrics" color="inherit">{option.label}</BodyText>
            {option.badge ? <BadgeText as="b" className="ui-text--inherit-metrics" color="inherit">{option.badge}</BadgeText> : null}
          </button>
        );
      })}
    </div>
  );
}
