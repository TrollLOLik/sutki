import { Ionicons } from '@expo/vector-icons';
import { useRef } from 'react';
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
 * \"Оформление\" card on the profile screen: light / dark / system segmented
 * control backed by the persisted theme store.
 *
 * On each tap the button's on-screen center is measured and passed to
 * startThemeTransition() so the root circular-reveal overlay can originate
 * the animation from exactly that point.
 */
export function ThemeSelector() {
  const preference = useThemeStore((s) => s.preference);
  const transition = useThemeStore((s) => s.transition);
  const startThemeTransition = useThemeStore((s) => s.startThemeTransition);
  const { palette } = useAppTheme();

  // One ref per option — used to measure the button's page coordinates.
  const buttonRefs = useRef<Record<ThemePreference, View | null>>({
    light: null,
    dark: null,
    system: null,
  });

  const handleOptionPress = (value: ThemePreference) => {
    // No-op if already selected or a transition is in progress.
    if (value === preference || transition.active) return;

    const ref = buttonRefs.current[value];
    if (!ref) {
      // Fallback: switch without animation (should never happen).
      startThemeTransition({ x: 0, y: 0 }, value);
      return;
    }

    ref.measure((_x, _y, width, height, pageX, pageY) => {
      const origin = {
        x: pageX + width / 2,
        y: pageY + height / 2,
      };
      startThemeTransition(origin, value);
    });
  };

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
              ref={(ref) => {
                buttonRefs.current[option.value] = ref as View | null;
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`Тема: ${option.label}`}
              onPress={() => handleOptionPress(option.value)}
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
