import { Pressable, Text } from 'react-native';

import { useAppTheme } from '@/theme/useAppTheme';
import { ComponentMarker } from '@/components/debug/ComponentMarker';

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
        minHeight: 38,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 999,
        borderWidth: 1,
        paddingHorizontal: 16,
        backgroundColor: selected ? palette.primaryLight : palette.surfaceMuted,
        borderColor: selected ? palette.primary : palette.line,
      }}>
      <ComponentMarker kind="button" name="Chip" />
      <Text
        numberOfLines={1}
        ellipsizeMode="tail"
        style={{
          flexShrink: 1,
          fontSize: 14,
          fontWeight: selected ? '600' : '400',
          color: selected ? palette.primary : palette.inkSecondary,
        }}>
        {label}
      </Text>
    </Pressable>
  );
}

