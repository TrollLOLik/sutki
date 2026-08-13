import type { ReactNode } from 'react';
import { Pressable, Text, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

import { useAppTheme } from '@/theme/useAppTheme';

export interface RadioProps extends Omit<PressableProps, 'children' | 'style'> {
  selected: boolean;
  onSelect: () => void;
  label?: ReactNode;
  description?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function Radio({ selected, onSelect, label, description, disabled, style, ...rest }: RadioProps) {
  const { palette } = useAppTheme();

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled: Boolean(disabled) }}
      disabled={Boolean(disabled)}
      hitSlop={label ? undefined : 8}
      onPress={onSelect}
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
      <View
        pointerEvents="none"
        style={{
          width: 24,
          height: 24,
          marginTop: description ? 1 : 0,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 12,
          borderWidth: selected ? 2 : 1.5,
          borderColor: selected ? palette.primary : palette.line,
          backgroundColor: palette.surfaceMuted,
        }}>
        {selected ? <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: palette.primary }} /> : null}
      </View>
      {label || description ? (
        <View pointerEvents="none" style={{ minWidth: 0, flex: 1, gap: 2 }}>
          {typeof label === 'string' ? <Text style={{ color: palette.ink, fontSize: 14, fontWeight: '700', lineHeight: 20 }}>{label}</Text> : label}
          {typeof description === 'string' ? <Text style={{ color: palette.inkSecondary, fontSize: 12, lineHeight: 17 }}>{description}</Text> : description}
        </View>
      ) : null}
    </Pressable>
  );
}
