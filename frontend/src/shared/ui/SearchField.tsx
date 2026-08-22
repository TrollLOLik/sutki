import { Search, X } from 'lucide-react';
import { useState, type ChangeEvent } from 'react';
import { cx } from '../lib/cx';
import { TextField, type TextFieldProps } from './TextField';
import { IconButton } from './IconButton';

export interface SearchFieldProps extends Omit<TextFieldProps, 'type' | 'before' | 'after'> {
  onClear?: () => void;
}

export function SearchField({ value, defaultValue, onClear, onChange, className, ...props }: SearchFieldProps) {
  const controlled = value !== undefined;
  const [internalValue, setInternalValue] = useState(() => String(defaultValue ?? ''));
  const resolvedValue = controlled ? String(value ?? '') : internalValue;
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (!controlled) setInternalValue(event.target.value);
    onChange?.(event);
  };
  const clear = () => {
    if (!controlled) setInternalValue('');
    onClear?.();
  };
  return (
    <TextField
      {...props}
      className={cx('ui-search-field', className)}
      type="text"
      inputMode="search"
      enterKeyHint="search"
      value={resolvedValue}
      onChange={handleChange}
      before={<Search size={18} />}
      after={resolvedValue && onClear ? <IconButton label="Очистить" size="sm" variant="plain" icon={<X size={16} />} onClick={clear} /> : undefined}
    />
  );
}
