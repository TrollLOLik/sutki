import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { IconButton } from '@/components/ui/IconButton';
import { useAppTheme } from '@/theme/useAppTheme';

export type DialogTone = 'primary' | 'neutral' | 'success' | 'warning' | 'danger';

export interface DialogHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  icon?: keyof typeof Ionicons.glyphMap;
  tone?: DialogTone;
  onClose?: () => void;
  showClose?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function DialogHeader({
  title,
  description,
  icon,
  tone = 'primary',
  onClose,
  showClose = true,
  style,
}: DialogHeaderProps) {
  const { palette } = useAppTheme();
  const color =
    tone === 'danger'
      ? palette.danger
      : tone === 'success'
        ? palette.success
        : tone === 'warning'
          ? palette.primary
          : tone === 'neutral'
            ? palette.inkSecondary
            : palette.primary;
  const backgroundColor =
    tone === 'danger'
      ? palette.dangerLight
      : tone === 'success'
        ? palette.successLight
        : tone === 'neutral'
          ? palette.surfaceMuted
          : palette.primaryLight;

  return (
    <View
      style={[
        {
          minHeight: 70,
          width: '100%',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 11,
          borderBottomWidth: 1,
          borderBottomColor: palette.line,
          paddingHorizontal: 16,
          paddingVertical: 14,
        },
        style,
      ]}>
      {icon ? (
        <View
          style={{
            width: 42,
            height: 42,
            flexShrink: 0,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 13,
            backgroundColor,
          }}>
          <Ionicons name={icon} size={21} color={color} />
        </View>
      ) : null}

      <View style={{ minWidth: 0, flex: 1 }}>
        {typeof title === 'string' ? (
          <Text style={{ color: palette.ink, fontSize: 18, lineHeight: 23, fontWeight: '800' }}>
            {title}
          </Text>
        ) : (
          title
        )}
        {description ? (
          typeof description === 'string' ? (
            <Text
              style={{
                marginTop: 3,
                color: palette.inkSecondary,
                fontSize: 12,
                lineHeight: 17,
              }}>
              {description}
            </Text>
          ) : (
            description
          )
        ) : null}
      </View>

      {showClose && onClose ? (
        <IconButton
          accessibilityLabel="Закрыть"
          icon="close"
          iconSize={20}
          size={40}
          onPress={onClose}
        />
      ) : null}
    </View>
  );
}
