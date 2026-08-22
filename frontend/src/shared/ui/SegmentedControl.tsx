import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { cx } from '../lib/cx';
import { DescriptionText } from './Typography';

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  badge?: ReactNode;
  disabled?: boolean;
}

export interface SegmentedControlProps<T extends string> {
  value: T;
  options: readonly SegmentedOption<T>[];
  onChange: (value: T) => void;
  ariaLabel?: string;
  className?: string;
}

export function SegmentedControl<T extends string>({ value, options, onChange, ariaLabel = 'Переключатель', className }: SegmentedControlProps<T>) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const selectIndex = (index: number) => {
    const option = options[index];
    if (!option || option.disabled) return;
    onChange(option.value);
    refs.current[index]?.focus();
  };

  const move = (currentIndex: number, direction: 1 | -1) => {
    let next = currentIndex;
    for (let attempts = 0; attempts < options.length; attempts += 1) {
      next = (next + direction + options.length) % options.length;
      if (!options[next]?.disabled) {
        selectIndex(next);
        return;
      }
    }
  };

  const handleKeyDown = (index: number, event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      move(index, 1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      move(index, -1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      selectIndex(options.findIndex((option) => !option.disabled));
    } else if (event.key === 'End') {
      event.preventDefault();
      let last = -1;
      for (let candidate = options.length - 1; candidate >= 0; candidate -= 1) {
        if (!options[candidate]?.disabled) { last = candidate; break; }
      }
      selectIndex(last);
    }
  };

  return (
    <div className={cx('ui-segmented', className)} role="tablist" aria-label={ariaLabel}>
      {options.map((option, index) => {
        const selected = value === option.value;
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
            onKeyDown={(event) => handleKeyDown(index, event)}
          >
            <span>{typeof option.label === 'string' || typeof option.label === 'number' ? <DescriptionText className="ui-text--inherit-metrics" color="inherit">{option.label}</DescriptionText> : option.label}</span>{option.badge}
          </button>
        );
      })}
    </div>
  );
}
