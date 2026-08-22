import type { ChangeEvent, HTMLAttributes } from 'react';
import { cx } from '../lib/cx';

export interface DualRangeProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  min: number;
  max: number;
  valueMin: number;
  valueMax: number;
  step?: number;
  minDistance?: number;
  minLabel?: string;
  maxLabel?: string;
  onChange: (min: number, max: number) => void;
}

export function DualRange({ min, max, valueMin, valueMax, step = 1, minDistance = 0, minLabel = 'Минимальное значение', maxLabel = 'Максимальное значение', onChange, className, ...props }: DualRangeProps) {
  const left = ((valueMin - min) / (max - min)) * 100;
  const right = 100 - ((valueMax - min) / (max - min)) * 100;
  const changeMin = (event: ChangeEvent<HTMLInputElement>) => onChange(Math.min(Number(event.target.value), valueMax - minDistance), valueMax);
  const changeMax = (event: ChangeEvent<HTMLInputElement>) => onChange(valueMin, Math.max(Number(event.target.value), valueMin + minDistance));

  return (
    <div {...props} className={cx('ui-dual-range', 'dual-range', className)}>
      <div className="ui-dual-range__track dual-range-track"><span style={{ left: `${left}%`, right: `${right}%` }} /></div>
      <input aria-label={minLabel} type="range" min={min} max={max} step={step} value={valueMin} onChange={changeMin} />
      <input aria-label={maxLabel} type="range" min={min} max={max} step={step} value={valueMax} onChange={changeMax} />
    </div>
  );
}
