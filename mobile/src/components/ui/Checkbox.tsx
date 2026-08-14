import type { ReactNode } from 'react';
import { View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

import { AppIcon } from '@/components/ui/AppIcon';
import { AppText } from '@/components/ui/AppText';
import { PressableScale } from '@/components/ui/PressableScale';
import { useAppTheme } from '@/theme/useAppTheme';

export interface CheckboxProps extends Omit<PressableProps, 'children' | 'style'> {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label?: ReactNode;
  description?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function Checkbox({
  checked,
  onCheckedChange,
  label,
  description,
  disabled,
  style,
  ...rest
}: CheckboxProps) {
  const { palette } = useAppTheme();

  return (
    <PressableScale
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled: Boolean(disabled) }}
      disabled={Boolean(disabled)}
      hitSlop={label ? undefined : 8}
      onPress={() => onCheckedChange(!checked)}
      pressedScale={0.98}
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
          borderRadius: 7,
          borderWidth: 1,
          borderColor: checked ? palette.primary : palette.line,
          backgroundColor: checked ? palette.primary : palette.surfaceMuted,
        }}>
        {checked ? <AppIcon name="checkmark" size={17} tone="inverse" /> : null}
      </View>
      {label || description ? (
        <View pointerEvents="none" style={{ minWidth: 0, flex: 1, gap: 2 }}>
          {typeof label === 'string' ? (
            <AppText variant="label" style={{ color: palette.ink, lineHeight: 20 }}>{label}</AppText>
          ) : label}
          {typeof description === 'string' ? (
            <AppText variant="caption" style={{ color: palette.inkSecondary, lineHeight: 17, fontWeight: '400' }}>{description}</AppText>
          ) : description}
        </View>
      ) : null}
    </PressableScale>
  );
}
