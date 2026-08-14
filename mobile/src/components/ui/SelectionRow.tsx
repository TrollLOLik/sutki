import { View } from 'react-native';

import { AppIcon, type AppIconName } from '@/components/ui/AppIcon';
import { AppText } from '@/components/ui/AppText';
import { PressableScale } from '@/components/ui/PressableScale';
import { useAppTheme } from '@/theme/useAppTheme';

export interface SelectionRowProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  icon?: AppIconName;
}

export function SelectionRow({ label, selected, onPress, icon }: SelectionRowProps) {
  const { palette } = useAppTheme();

  return (
    <PressableScale
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      pressedScale={0.985}
      style={{
        minHeight: 50,
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        borderRadius: 14,
        backgroundColor: palette.surfaceMuted,
        paddingHorizontal: 10,
        paddingVertical: 5,
      }}>
      {icon ? (
        <View style={{ width: 34, height: 34, alignItems: 'center', justifyContent: 'center' }}>
          <AppIcon name={icon} size={20} color={palette.inkSecondary} />
        </View>
      ) : null}
      <AppText
        variant="label"
        numberOfLines={1}
        style={{
          minWidth: 0,
          flex: 1,
          color: selected ? palette.primary : palette.ink,
          fontSize: 14,
          lineHeight: 19,
          fontWeight: selected ? '700' : '500',
        }}>
        {label}
      </AppText>
      <View
        style={{
          width: 20,
          height: 20,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 10,
          borderWidth: 1,
          borderColor: selected ? palette.primary : palette.line,
          backgroundColor: selected ? palette.primary : 'transparent',
        }}>
        {selected ? <AppIcon name="checkmark" size={14} tone="inverse" /> : null}
      </View>
    </PressableScale>
  );
}
