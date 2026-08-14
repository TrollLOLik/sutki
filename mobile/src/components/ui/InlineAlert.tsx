import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { AppIcon, type AppIconName } from '@/components/ui/AppIcon';
import { AppText } from '@/components/ui/AppText';
import { useAppTheme } from '@/theme/useAppTheme';

export type InlineAlertTone = 'info' | 'success' | 'warning' | 'danger';

export interface InlineAlertProps {
  tone?: InlineAlertTone;
  title?: ReactNode;
  children: ReactNode;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}

const icons: Record<InlineAlertTone, AppIconName> = {
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
      <AppIcon name={icons[tone]} size={compact ? 19 : 21} color={color} />
      <View style={{ minWidth: 0, flex: 1, gap: title ? 3 : 0 }}>
        {typeof title === 'string' ? <AppText variant="label" style={{ color, fontWeight: '800', lineHeight: 19 }}>{title}</AppText> : title}
        {typeof children === 'string' ? <AppText variant="caption" style={{ color, fontSize: compact ? 12 : 13, lineHeight: compact ? 17 : 19, fontWeight: '400' }}>{children}</AppText> : children}
      </View>
    </View>
  );
}
