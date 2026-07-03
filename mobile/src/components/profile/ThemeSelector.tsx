import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { useThemeStore, type ThemePreference } from '@/store/theme';
import { useAppTheme } from '@/theme/useAppTheme';
import { shadows } from '@/theme/tokens';

const OPTIONS: { value: ThemePreference; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'light', label: 'Светлая', icon: 'sunny-outline' },
  { value: 'dark', label: 'Тёмная', icon: 'moon-outline' },
  { value: 'system', label: 'Системная', icon: 'phone-portrait-outline' },
];

/**
 * "Оформление" card on the profile screen: light / dark / system segmented
 * control backed by the persisted theme store.
 */
export function ThemeSelector() {
  const preference = useThemeStore((s) => s.preference);
  const setPreference = useThemeStore((s) => s.setPreference);
  const { palette } = useAppTheme();

  return (
    <View
      className="border border-line bg-surface p-4 rounded-card"
      style={shadows.tile}>
      <View className="mb-3 flex-row items-center gap-2">
        <Ionicons name="color-palette-outline" size={18} color={palette.primary} />
        <Text className="text-sm font-extrabold text-ink">Оформление</Text>
      </View>
      <View className="flex-row rounded-field bg-surface-muted p-1" accessibilityRole="radiogroup">
        {OPTIONS.map((option) => {
          const active = preference === option.value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`Тема: ${option.label}`}
              onPress={() => setPreference(option.value)}
              className={`h-10 flex-1 flex-row items-center justify-center gap-1.5 rounded-[9px] ${
                active ? 'bg-surface' : ''
              }`}
              style={active ? shadows.tile : undefined}>
              <Ionicons
                name={option.icon}
                size={15}
                color={active ? palette.primary : palette.inkSecondary}
              />
              <Text
                className={`text-xs ${active ? 'font-bold text-ink' : 'font-semibold text-ink-secondary'}`}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
