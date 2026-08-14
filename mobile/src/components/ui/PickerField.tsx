import type { ReactNode } from 'react';
import {
  type PressableProps,
  type StyleProp,
  type ViewStyle,
  View,
} from 'react-native';

import { AppIcon, type AppIconName } from '@/components/ui/AppIcon';
import { AppText } from '@/components/ui/AppText';
import { Field } from '@/components/ui/Field';
import { FieldFrame } from '@/components/ui/FieldFrame';
import { PressableScale } from '@/components/ui/PressableScale';

export interface PickerFieldProps extends Omit<PressableProps, 'children' | 'style'> {
  label?: string;
  value?: string | null;
  placeholder?: string;
  icon?: AppIconName;
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
  return (
    <Field
      label={label}
      description={description}
      error={error}
      required={required}>
      <PressableScale
        accessibilityRole="button"
        accessibilityState={{ disabled: Boolean(disabled) }}
        disabled={Boolean(disabled)}
        pressedScale={0.985}
        disabledOpacity={0.48}
        style={[
          {
            width: '100%',
          },
          style,
        ]}
        {...rest}>
        <FieldFrame invalid={Boolean(error)}>
          {before ? (
            <View style={{ flexShrink: 0 }}>{before}</View>
          ) : icon ? (
            <View style={{ flexShrink: 0 }}>
              <AppIcon name={icon} size={20} tone="primary" />
            </View>
          ) : null}
          <AppText
            variant="body"
            tone={value ? 'ink' : 'muted'}
            numberOfLines={1}
            style={{
              minWidth: 0,
              flex: 1,
              marginLeft: before || icon ? 12 : 0,
              lineHeight: 21,
            }}>
            {value || placeholder}
          </AppText>
          <View style={{ flexShrink: 0, marginLeft: 10 }}>
            {after ?? <AppIcon name="chevron-forward" size={19} tone="muted" />}
          </View>
        </FieldFrame>
      </PressableScale>
    </Field>
  );
}
