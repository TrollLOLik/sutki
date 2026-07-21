import { Ionicons } from '@expo/vector-icons';
import { forwardRef, useState } from 'react';
import { Text, TextInput, View, type TextInputProps } from 'react-native';

import { cn } from '@/lib/cn';
import { useAppTheme } from '@/theme/useAppTheme';

interface InputProps extends TextInputProps {
  icon?: keyof typeof Ionicons.glyphMap;
  error?: string;
}

export const Input = forwardRef<TextInput, InputProps>(function Input(
  { icon, error, className, onFocus, onBlur, ...rest },
  ref,
) {
  const { palette } = useAppTheme();
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View className="w-full">
      <View
        className={cn(
          'h-14 flex-row items-center rounded-[18px] border bg-surface-muted px-4 transition-all duration-150',
          error 
            ? 'border-danger' 
            : isFocused 
              ? 'border-primary' 
              : 'border-line',
        )}>
        {icon ? (
          <Ionicons 
            name={icon} 
            size={20} 
            color={error ? palette.danger : isFocused ? palette.primary : palette.inkMuted} 
            style={{ marginRight: 10 }} 
          />
        ) : null}
        <TextInput
          ref={ref}
          placeholderTextColor={palette.inkMuted}
          className="flex-1 text-base text-ink"
          onFocus={(e) => {
            setIsFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            onBlur?.(e);
          }}
          {...rest}
        />
      </View>
      {error ? <Text className="mt-1.5 px-1 text-xs font-medium text-danger">{error}</Text> : null}
    </View>
  );
});
