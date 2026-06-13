import { Pressable, Text } from 'react-native';

import { cn } from '@/lib/cn';

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}

export function Chip({ label, selected = false, onPress }: ChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      className={cn(
        'h-9 items-center justify-center rounded-pill border px-4',
        selected ? 'border-primary bg-primary' : 'border-line bg-surface',
      )}>
      <Text className={cn('text-sm font-medium', selected ? 'text-white' : 'text-ink')}>{label}</Text>
    </Pressable>
  );
}
