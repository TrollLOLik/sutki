import { Pressable, Text } from 'react-native';

import { useAppTheme } from '@/theme/useAppTheme';

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}

export function Chip({ label, selected = false, onPress }: ChipProps) {
  const { palette } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{
        height: 36,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 999,
        borderWidth: 1,
        paddingHorizontal: 16,
        backgroundColor: selected ? palette.primaryLight : '#FFFFFF',
        borderColor: selected ? palette.primary : '#E0E0E0',
      }}>
      <Text
        style={{
          fontSize: 14,
          fontWeight: selected ? '600' : '400',
          color: selected ? palette.primary : palette.inkSecondary,
        }}>
        {label}
      </Text>
    </Pressable>
  );
}

