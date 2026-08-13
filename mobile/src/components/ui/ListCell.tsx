import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, Text, View, type PressableProps } from 'react-native';

import { useAppTheme } from '@/theme/useAppTheme';
import { ComponentMarker } from '@/components/debug/ComponentMarker';

export interface ListCellProps extends Omit<PressableProps, 'children'> {
  before?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  after?: ReactNode;
  chevron?: boolean;
  multiline?: boolean;
}

function renderCopy(value: ReactNode, type: 'title' | 'subtitle', color: string) {
  return typeof value === 'string' || typeof value === 'number' ? (
    <Text
      numberOfLines={type === 'title' ? 1 : 2}
      style={{
        color,
        fontSize: type === 'title' ? 15 : 12,
        lineHeight: type === 'title' ? 20 : 17,
        fontWeight: type === 'title' ? '800' : '500',
      }}>
      {value}
    </Text>
  ) : (
    value
  );
}

export function ListCell({
  before,
  title,
  subtitle,
  after,
  chevron = true,
  multiline = false,
  disabled,
  style,
  ...rest
}: ListCellProps) {
  const { palette } = useAppTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={Boolean(disabled)}
      style={(state) => [
        {
          minHeight: multiline || subtitle ? 68 : 56,
          width: '100%',
          opacity: disabled ? 0.46 : state.pressed ? 0.68 : 1,
        },
        typeof style === 'function' ? style(state) : style,
      ]}
      {...rest}>
      <ComponentMarker kind="surface" name="ListCell" />
      <View
        pointerEvents="none"
        style={{
          minHeight: multiline || subtitle ? 68 : 56,
          width: '100%',
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 14,
          paddingVertical: 10,
        }}>
        {before ? <View style={{ flexShrink: 0, marginRight: 12 }}>{before}</View> : null}
        <View style={{ minWidth: 0, flex: 1 }}>
          {renderCopy(title, 'title', palette.ink)}
          {subtitle ? renderCopy(subtitle, 'subtitle', palette.inkSecondary) : null}
        </View>
        {after ? <View style={{ flexShrink: 0, marginLeft: 10 }}>{after}</View> : null}
        {chevron ? (
          <View style={{ flexShrink: 0, marginLeft: after ? 6 : 10 }}>
            <Ionicons name="chevron-forward" size={18} color={palette.inkMuted} />
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}
