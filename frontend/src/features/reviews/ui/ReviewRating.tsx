import { Star } from 'lucide-react';
import type { HTMLAttributes } from 'react';
import { IconButton } from '@ui';
import { cx } from '@shared/lib/cx';
import './review-rating.css';

export interface ReviewRatingProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'onChange'> {
  value: number;
  max?: number;
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  onChange?: (value: number) => void;
}

export function ReviewRating({ value, max = 5, size = 'md', label = 'Оценка', onChange, className, ...props }: ReviewRatingProps) {
  const normalizedValue = Math.max(0, Math.min(max, Math.round(value)));
  const values = Array.from({ length: max }, (_, index) => index + 1);

  if (onChange) {
    return (
      <span {...props} className={cx('review-rating-stars', 'review-rating-stars--interactive', `review-rating-stars--${size}`, className)} role="radiogroup" aria-label={label}>
        {values.map((starValue) => (
          <IconButton
            key={starValue}
            className={starValue <= normalizedValue ? 'is-selected' : undefined}
            label={`${starValue} ${starValue === 1 ? 'звезда' : starValue < 5 ? 'звезды' : 'звёзд'}`}
            size="sm"
            mode="ghost"
            tone="neutral"
            role="radio"
            aria-checked={normalizedValue === starValue}
            icon={<Star fill={starValue <= normalizedValue ? 'currentColor' : 'none'} />}
            onClick={() => onChange(starValue)}
          />
        ))}
      </span>
    );
  }

  return (
    <span {...props} className={cx('review-rating-stars', `review-rating-stars--${size}`, className)} role="img" aria-label={`${label}: ${normalizedValue} из ${max}`}>
      {values.map((starValue) => <Star key={starValue} aria-hidden="true" fill={starValue <= normalizedValue ? 'currentColor' : 'none'} />)}
    </span>
  );
}
