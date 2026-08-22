import { Minus, Plus } from 'lucide-react';
import { BodyText } from './Typography';
import { IconButton } from './IconButton';

export interface CounterProps {
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  label?: string;
}

export function Counter({ value, min = 0, max = 99, onChange, label = 'Количество' }: CounterProps) {
  return (
    <div className="ui-counter" aria-label={label}>
      <IconButton label="Уменьшить" icon={<Minus />} size="sm" mode="soft" tone="neutral" disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))} />
      <BodyText as="strong" weight={500} aria-live="polite">{value}</BodyText>
      <IconButton label="Увеличить" icon={<Plus />} size="sm" mode="soft" tone="neutral" disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))} />
    </div>
  );
}
