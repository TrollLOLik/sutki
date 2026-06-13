import { ActivityIndicator, Pressable, Text, type PressableProps } from 'react-native';

import { cn } from '@/lib/cn';
import { palette } from '@/theme/tokens';

type Variant = 'primary' | 'secondary' | 'success' | 'ghost';
type Size = 'md' | 'lg';

interface ButtonProps extends Omit<PressableProps, 'children'> {
  label: string;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const container: Record<Variant, string> = {
  primary: 'bg-primary active:bg-primary-pressed',
  secondary: 'bg-surface border border-line active:bg-surface-muted',
  success: 'bg-success active:opacity-90',
  ghost: 'bg-transparent active:bg-surface-muted',
};

const text: Record<Variant, string> = {
  primary: 'text-white',
  secondary: 'text-ink',
  success: 'text-white',
  ghost: 'text-primary',
};

const sizes: Record<Size, string> = {
  md: 'h-12',
  lg: 'h-14',
};

export function Button({
  label,
  variant = 'primary',
  size = 'lg',
  loading = false,
  disabled,
  className,
  ...rest
}: ButtonProps & { className?: string }) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      className={cn(
        'w-full flex-row items-center justify-center rounded-field px-5',
        sizes[size],
        container[variant],
        isDisabled && 'opacity-50',
        className,
      )}
      {...rest}>
      {loading ? (
        <ActivityIndicator
          color={variant === 'secondary' || variant === 'ghost' ? palette.primary : palette.surface}
        />
      ) : (
        <Text className={cn('text-base font-semibold', text[variant])}>{label}</Text>
      )}
    </Pressable>
  );
}
