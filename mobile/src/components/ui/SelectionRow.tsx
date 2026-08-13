import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { useAppTheme } from '@/theme/useAppTheme';
import { ComponentMarker } from '@/components/debug/ComponentMarker';

export interface SelectionRowProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
}

export function SelectionRow({ label, selected, onPress, icon }: SelectionRowProps) {
  const { palette } = useAppTheme();

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={{
        minHeight: 50,
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        borderRadius: 14,
        backgroundColor: palette.surfaceMuted,
        paddingHorizontal: 10,
        paddingVertical: 5,
      }}>
      <ComponentMarker kind="button" name="SelectionRow" />
      {icon ? (
        <View style={{ width: 34, height: 34, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={icon} size={20} color={palette.inkSecondary} />
        </View>
      ) : null}
      <Text
        numberOfLines={1}
        style={{
          minWidth: 0,
          flex: 1,
          color: selected ? palette.primary : palette.ink,
          fontSize: 14,
          lineHeight: 19,
          fontWeight: selected ? '700' : '500',
        }}>
        {label}
      </Text>
      <View
        style={{
          width: 20,
          height: 20,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 10,
          borderWidth: 1,
          borderColor: selected ? palette.primary : palette.line,
          backgroundColor: selected ? palette.primary : 'transparent',
        }}>
        {selected ? <Ionicons name="checkmark" size={14} color="#FFFFFF" /> : null}
      </View>
    </Pressable>
  );
}
