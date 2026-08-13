import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { useAppTheme } from '@/theme/useAppTheme';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  badge?: ReactNode;
  disabled?: boolean;
}

export interface SegmentedControlProps<T extends string> {
  value: T;
  options: readonly SegmentedOption<T>[];
  onChange: (value: T, origin?: { x: number; y: number }) => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

export function SegmentedControl<T extends string>({ value, options, onChange, accessibilityLabel = 'Переключатель', style }: SegmentedControlProps<T>) {
  const { palette } = useAppTheme();

  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      style={[
        {
          width: '100%',
          alignSelf: 'stretch',
          minHeight: 50,
          flexDirection: 'row',
          gap: 4,
          borderRadius: 16,
          backgroundColor: palette.surfaceMuted,
          padding: 4,
        },
        style,
      ]}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected, disabled: Boolean(option.disabled) }}
            disabled={Boolean(option.disabled)}
            onPress={(event) => onChange(option.value, { x: event.nativeEvent.pageX, y: event.nativeEvent.pageY })}
            className="active:opacity-75"
            style={{
              minWidth: 0,
              flexBasis: 0,
              flexGrow: 1,
              flexShrink: 1,
              opacity: option.disabled ? 0.4 : 1,
            }}>
            <View
              pointerEvents="none"
              style={{
                minHeight: 42,
                flex: 1,
                minWidth: 0,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                borderRadius: 13,
                borderWidth: selected ? 1 : 0,
                borderColor: selected ? palette.line : 'transparent',
                backgroundColor: selected ? palette.surface : 'transparent',
              }}>
              {option.icon ? <Ionicons name={option.icon} size={16} color={selected ? palette.primary : palette.inkSecondary} /> : null}
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ minWidth: 0, flexShrink: 1, color: selected ? palette.ink : palette.inkSecondary, fontSize: 13, fontWeight: selected ? '800' : '600' }}>
                {option.label}
              </Text>
              {option.badge}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
