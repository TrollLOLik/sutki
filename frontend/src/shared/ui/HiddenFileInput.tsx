import { forwardRef, type InputHTMLAttributes } from 'react';
import { cx } from '../lib/cx';

export interface HiddenFileInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {}

export const HiddenFileInput = forwardRef<HTMLInputElement, HiddenFileInputProps>(function HiddenFileInput({ className, ...props }, ref) {
  return <input {...props} ref={ref} type="file" className={cx('ui-hidden-file-input', className)} />;
});
