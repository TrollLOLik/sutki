import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

import { MaterialSurface, SegmentedControl } from '@/components/ui';
import { useThemeStore, type ThemePreference } from '@/store/theme';
import { useAppTheme } from '@/theme/useAppTheme';

const OPTIONS: { value: ThemePreference; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'light', label: 'Светлая', icon: 'sunny-outline' },
  { value: 'dark', label: 'Тёмная', icon: 'moon-outline' },
  { value: 'system', label: 'Системная', icon: 'phone-portrait-outline' },
];

export function ThemeSelector() {
  const preference = useThemeStore((state) => state.preference);
  const transition = useThemeStore((state) => state.transition);
  const startThemeTransition = useThemeStore((state) => state.startThemeTransition);
  const { palette } = useAppTheme();

  const handleOptionPress = (value: ThemePreference, origin?: { x: number; y: number }) => {
    if (value === preference || transition.active) return;
    startThemeTransition(origin ?? { x: 0, y: 0 }, value);
  };

  return (
    <MaterialSurface level="raised" radius={24} style={{ padding: 16 }}>
      <View className="mb-4 flex-row items-center gap-3">
        <View className="h-10 w-10 items-center justify-center rounded-full bg-primary-light">
          <Ionicons name="color-palette-outline" size={20} color={palette.primary} />
        </View>
        <View className="flex-1">
          <Text className="text-base font-extrabold text-ink">Оформление</Text>
          <Text className="mt-0.5 text-xs font-medium text-ink-secondary">Выберите тему приложения</Text>
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
