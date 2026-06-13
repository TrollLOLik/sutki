import { Ionicons } from '@expo/vector-icons';
import { forwardRef } from 'react';
import { Text, TextInput, View, type TextInputProps } from 'react-native';

import { cn } from '@/lib/cn';
import { palette } from '@/theme/tokens';

interface InputProps extends TextInputProps {
  icon?: keyof typeof Ionicons.glyphMap;
  error?: string;
}

export const Input = forwardRef<TextInput, InputProps>(function Input(
  { icon, error, className, ...rest },
  ref,
) {
  return (
    <View className="w-full">
      <View
        className={cn(
          'h-14 flex-row items-center rounded-field border bg-surface px-4',
          error ? 'border-danger' : 'border-line',
        )}>
        {icon ? <Ionicons name={icon} size={20} color={palette.inkMuted} style={{ marginRight: 10 }} /> : null}
        <TextInput
          ref={ref}
          placeholderTextColor={palette.inkMuted}
          className="flex-1 text-base text-ink"
          {...rest}
        />
      </View>
      {error ? <Text className="mt-1 px-1 text-sm text-danger">{error}</Text> : null}
    </View>
  );
});
