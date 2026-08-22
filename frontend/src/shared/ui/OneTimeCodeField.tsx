import { forwardRef, useImperativeHandle, useRef, type ChangeEvent, type InputHTMLAttributes } from 'react';
import { cx } from '../lib/cx';
import { BodyText } from './Typography';

export interface OneTimeCodeFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'maxLength' | 'type'> {
  value: string;
  length: number;
  onValueChange: (value: string) => void;
  cellsLabel?: string;
  wrapClassName?: string;
  cellsClassName?: string;
  inputClassName?: string;
}

export const OneTimeCodeField = forwardRef<HTMLInputElement, OneTimeCodeFieldProps>(function OneTimeCodeField({ value, length, onValueChange, cellsLabel = 'Поле кода', wrapClassName, cellsClassName, inputClassName, className, ...props }, ref) {
  const inputRef = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);
  const focusInput = () => inputRef.current?.focus();
  const change = (event: ChangeEvent<HTMLInputElement>) => onValueChange(event.target.value.replace(/\D/g, '').slice(0, length));

  return (
    <div className={cx('ui-one-time-code', wrapClassName, className)}>
      <button className={cx('ui-one-time-code__cells', cellsClassName)} type="button" onClick={focusInput} aria-label={cellsLabel} aria-controls={props.id}>
        {Array.from({ length }, (_, index) => <span key={index} className={cx(value[index] && 'is-filled', index === value.length && 'is-active')}><BodyText as="b" className="ui-text--inherit-metrics" color="inherit">{value[index] ?? ''}</BodyText></span>)}
      </button>
      <input {...props} ref={inputRef} className={cx('ui-one-time-code__input', inputClassName)} type="text" inputMode="numeric" autoComplete="one-time-code" value={value} maxLength={length} onChange={change} />
    </div>
  );
});
