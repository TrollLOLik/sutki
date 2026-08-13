import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { useAppTheme } from '@/theme/useAppTheme';

export type InlineAlertTone = 'info' | 'success' | 'warning' | 'danger';

export interface InlineAlertProps {
  tone?: InlineAlertTone;
  title?: ReactNode;
  children: ReactNode;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}

const icons: Record<InlineAlertTone, keyof typeof Ionicons.glyphMap> = {
  info: 'information-circle-outline',
  success: 'checkmark-circle-outline',
  warning: 'warning-outline',
  danger: 'alert-circle-outline',
};

export function InlineAlert({ tone = 'info', title, children, compact = false, style }: InlineAlertProps) {
  const { palette, isDark } = useAppTheme();
  const color = tone === 'danger' ? palette.danger : tone === 'success' ? palette.success : tone === 'warning' ? palette.primary : palette.info;
  const backgroundColor = tone === 'danger' ? palette.dangerLight : tone === 'success' ? palette.successLight : tone === 'warning' ? palette.primaryLight : palette.infoLight;

  return (
    <View
      accessibilityRole={tone === 'danger' || tone === 'warning' ? 'alert' : 'summary'}
      style={[
        {
          width: '100%',
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: compact ? 9 : 11,
          borderRadius: compact ? 15 : 18,
          borderWidth: 1,
          borderColor: isDark ? `${color}55` : `${color}38`,
          backgroundColor,
          paddingHorizontal: compact ? 12 : 14,
          paddingVertical: compact ? 11 : 13,
        },
        style,
      ]}>
      <Ionicons name={icons[tone]} size={compact ? 19 : 21} color={color} />
      <View style={{ minWidth: 0, flex: 1, gap: title ? 3 : 0 }}>
        {typeof title === 'string' ? <Text style={{ color, fontSize: 14, fontWeight: '800', lineHeight: 19 }}>{title}</Text> : title}
        {typeof children === 'string' ? <Text style={{ color, fontSize: compact ? 12 : 13, lineHeight: compact ? 17 : 19 }}>{children}</Text> : children}
      </View>
    </View>
  );
}
