import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import {
  Pressable,
  Text,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
  View,
} from 'react-native';

import { Field } from '@/components/ui/Field';
import { useAppTheme } from '@/theme/useAppTheme';

export interface PickerFieldProps extends Omit<PressableProps, 'children' | 'style'> {
  label?: string;
  value?: string | null;
  placeholder?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  before?: ReactNode;
  after?: ReactNode;
  description?: string;
  error?: string;
  required?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function PickerField({
  label,
  value,
  placeholder = '',
  icon,
  before,
  after,
  description,
  error,
  required,
  disabled,
  style,
  ...rest
}: PickerFieldProps) {
  const { palette } = useAppTheme();

  return (
    <Field
      label={label}
      description={description}
      error={error}
      required={required}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: Boolean(disabled) }}
        disabled={Boolean(disabled)}
        className="active:opacity-75"
        style={[
          {
            width: '100%',
            opacity: disabled ? 0.48 : 1,
          },
          style,
        ]}
        {...rest}>
        <View
          style={{
            minHeight: 56,
            width: '100%',
            flexDirection: 'row',
            alignItems: 'center',
            overflow: 'hidden',
            borderRadius: 18,
            borderWidth: error ? 1.5 : 1,
            borderColor: error ? palette.danger : palette.line,
            backgroundColor: palette.surfaceMuted,
            paddingHorizontal: 16,
          }}>
          {before ? (
            <View style={{ flexShrink: 0 }}>{before}</View>
          ) : icon ? (
            <View style={{ flexShrink: 0 }}>
              <Ionicons name={icon} size={20} color={palette.primary} />
            </View>
          ) : null}
          <Text
            numberOfLines={1}
            style={{
              minWidth: 0,
              flex: 1,
              marginLeft: before || icon ? 12 : 0,
              color: value ? palette.ink : palette.inkMuted,
              fontSize: 16,
              lineHeight: 21,
            }}>
            {value || placeholder}
          </Text>
          <View style={{ flexShrink: 0, marginLeft: 10 }}>
            {after ?? <Ionicons name="chevron-forward" size={19} color={palette.inkMuted} />}
          </View>
        </View>
      </Pressable>
    </Field>
  );
}
