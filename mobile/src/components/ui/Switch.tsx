import type { ReactNode } from 'react';
import { View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { PressableScale } from '@/components/ui/PressableScale';
import { useAppTheme } from '@/theme/useAppTheme';

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
    <PressableScale
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled: Boolean(disabled) }}
      disabled={Boolean(disabled)}
      onPress={() => onValueChange(!value)}
      pressedScale={0.985}
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
      {leading ? <View pointerEvents="none" style={{ flexShrink: 0 }}>{leading}</View> : null}
      {label || description ? (
        <View pointerEvents="none" style={{ minWidth: 0, flex: 1, gap: 2 }}>
          {typeof label === 'string' ? <AppText variant="label" style={{ color: palette.ink, fontSize: 15, lineHeight: 20 }}>{label}</AppText> : label}
          {typeof description === 'string' ? <AppText variant="caption" style={{ color: palette.inkSecondary, lineHeight: 17, fontWeight: '400' }}>{description}</AppText> : description}
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
    </PressableScale>
  );
}
