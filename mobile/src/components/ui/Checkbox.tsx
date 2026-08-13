import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, Text, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

import { useAppTheme } from '@/theme/useAppTheme';
import { ComponentMarker } from '@/components/debug/ComponentMarker';

export interface CheckboxProps extends Omit<PressableProps, 'children' | 'style'> {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label?: ReactNode;
  description?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function Checkbox({
  checked,
  onCheckedChange,
  label,
  description,
  disabled,
  style,
  ...rest
}: CheckboxProps) {
  const { palette } = useAppTheme();

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled: Boolean(disabled) }}
      disabled={Boolean(disabled)}
      hitSlop={label ? undefined : 8}
      onPress={() => onCheckedChange(!checked)}
      className="active:opacity-75"
      style={[
        {
          minWidth: 24,
          minHeight: 24,
          flexDirection: 'row',
          alignItems: description ? 'flex-start' : 'center',
          gap: 10,
          opacity: disabled ? 0.42 : 1,
        },
        style,
      ]}
      {...rest}>
      <ComponentMarker kind="button" name="Checkbox" />
      <View
        pointerEvents="none"
        style={{
          width: 24,
          height: 24,
          marginTop: description ? 1 : 0,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 7,
          borderWidth: 1,
          borderColor: checked ? palette.primary : palette.line,
          backgroundColor: checked ? palette.primary : palette.surfaceMuted,
        }}>
        {checked ? <Ionicons name="checkmark" size={17} color="#FFFFFF" /> : null}
      </View>
      {label || description ? (
        <View pointerEvents="none" style={{ minWidth: 0, flex: 1, gap: 2 }}>
          {typeof label === 'string' ? (
            <Text style={{ color: palette.ink, fontSize: 14, fontWeight: '700', lineHeight: 20 }}>{label}</Text>
          ) : label}
          {typeof description === 'string' ? (
            <Text style={{ color: palette.inkSecondary, fontSize: 12, lineHeight: 17 }}>{description}</Text>
          ) : description}
        </View>
      ) : null}
    </Pressable>
  );
}
