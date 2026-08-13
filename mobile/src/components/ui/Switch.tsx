import type { ReactNode } from 'react';
import { Pressable, Text, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

import { useAppTheme } from '@/theme/useAppTheme';
import { ComponentMarker } from '@/components/debug/ComponentMarker';

export interface SwitchProps extends Omit<PressableProps, 'children' | 'style'> {
  value: boolean;
  onValueChange: (value: boolean) => void;
  label?: ReactNode;
  description?: ReactNode;
  leading?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function Switch({ value, onValueChange, label, description, leading, disabled, style, ...rest }: SwitchProps) {
  const { palette } = useAppTheme();

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled: Boolean(disabled) }}
      disabled={Boolean(disabled)}
      onPress={() => onValueChange(!value)}
      className="active:opacity-75"
      style={[
        {
          minHeight: 30,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          opacity: disabled ? 0.42 : 1,
        },
        style,
      ]}
      {...rest}>
      <ComponentMarker kind="button" name="Switch" />
      {leading ? <View pointerEvents="none" style={{ flexShrink: 0 }}>{leading}</View> : null}
      {label || description ? (
        <View pointerEvents="none" style={{ minWidth: 0, flex: 1, gap: 2 }}>
          {typeof label === 'string' ? <Text style={{ color: palette.ink, fontSize: 15, fontWeight: '700', lineHeight: 20 }}>{label}</Text> : label}
          {typeof description === 'string' ? <Text style={{ color: palette.inkSecondary, fontSize: 12, lineHeight: 17 }}>{description}</Text> : description}
        </View>
      ) : null}
      <View
        pointerEvents="none"
        style={{
          width: 48,
          height: 28,
          flexShrink: 0,
          justifyContent: 'center',
          borderRadius: 14,
          paddingHorizontal: 3,
          backgroundColor: value ? palette.primary : palette.line,
        }}>
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: 11,
            backgroundColor: '#FFFFFF',
            shadowColor: '#000000',
            shadowOpacity: 0.14,
            shadowRadius: 3,
            shadowOffset: { width: 0, height: 1 },
            elevation: 2,
            transform: [{ translateX: value ? 20 : 0 }],
          }}
        />
      </View>
    </Pressable>
  );
}
