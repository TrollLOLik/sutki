import { View } from 'react-native';

import {
  AppText,
  MaterialSurface,
  PastelIcon,
  SegmentedControl,
  type AppIconName,
} from '@/components/ui';
import { useThemeStore, type ThemePreference } from '@/store/theme';

const OPTIONS: {
  value: ThemePreference;
  label: string;
  icon: AppIconName;
}[] = [
  { value: 'light', label: 'Светлая', icon: 'sunny-outline' },
  { value: 'dark', label: 'Тёмная', icon: 'moon-outline' },
  { value: 'system', label: 'Системная', icon: 'phone-portrait-outline' },
];

export function ThemeSelector() {
  const preference = useThemeStore((state) => state.preference);
  const transition = useThemeStore((state) => state.transition);
  const startThemeTransition = useThemeStore((state) => state.startThemeTransition);

  const handleOptionPress = (
    value: ThemePreference,
    origin?: { x: number; y: number },
  ) => {
    if (value === preference || transition.active) return;
    startThemeTransition(origin ?? { x: 0, y: 0 }, value);
  };

  return (
    <MaterialSurface level="raised" radius={24} style={{ padding: 16 }}>
      <View className="mb-4 flex-row items-center gap-3">
        <PastelIcon name="color-palette-outline" size={20} containerSize={40} />
        <View className="flex-1">
          <AppText variant="bodyStrong">Оформление</AppText>
          <AppText variant="caption" tone="secondary" style={{ marginTop: 2 }}>
            Выберите тему приложения
          </AppText>
        </View>
      </View>
      <SegmentedControl
        accessibilityLabel="Тема приложения"
        value={preference}
        options={OPTIONS}
        onChange={handleOptionPress}
      />
    </MaterialSurface>
  );
}
