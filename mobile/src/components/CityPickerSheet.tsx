import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { BottomSheet } from './ui';
import { suggestCities } from '@/lib/api/cities';
import { useAppTheme } from '@/theme/useAppTheme';

interface CityPickerSheetProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (city: string | null) => void;
  /** Currently selected city, to render a checkmark. */
  selectedCity?: string | null;
  allowAnyCity?: boolean;
}

/**
 * Bottom-sheet city autocomplete backed by the DaData proxy (via suggestCities,
 * which is city-bounded and returns clean city names). Shared by profile
 * editing and any other screen that needs to pick a city.
 */
export function CityPickerSheet({
  visible,
  onClose,
  onSelect,
  selectedCity,
  allowAnyCity,
}: CityPickerSheetProps) {
  const { palette } = useAppTheme();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // Debounced suggest. AbortController cancels the in-flight request on retype.
  useEffect(() => {
    if (!visible) return;
    if (query.trim().length === 0) {
      setSuggestions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const controller = new AbortController();
    const handle = setTimeout(async () => {
      const results = await suggestCities(query, controller.signal);
      if (!controller.signal.aborted) {
        setSuggestions(results);
        setLoading(false);
      }
    }, 300);
    return () => {
      controller.abort();
      clearTimeout(handle);
    };
  }, [query, visible]);


  return (
    <BottomSheet visible={visible} onClose={onClose} height="70%">
      <View className="items-center pb-4">
        <View className="h-1 w-12 rounded-full bg-line mb-3" />
        <Text className="text-lg font-bold text-ink">Выберите город</Text>
      </View>

      <View className="h-12 flex-row items-center rounded-field border border-line bg-surface-muted px-3 mb-4">
        <Ionicons name="search" size={20} color={palette.inkMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Поиск города..."
          placeholderTextColor={palette.inkMuted}
          autoFocus
          className="ml-2 flex-1 text-base text-ink"
        />
        {query.length > 0 ? (
          <Pressable onPress={() => setQuery('')}>
            <Ionicons name="close-circle" size={18} color={palette.inkMuted} />
          </Pressable>
        ) : null}
      </View>

      {allowAnyCity ? (
        <Pressable
          onPress={() => onSelect(null)}
          className="flex-row items-center gap-2 border-b border-line py-3 mb-2 active:bg-surface-muted"
        >
          <Ionicons name="globe-outline" size={18} color={palette.primary} />
          <Text className="text-base text-ink font-semibold">Любой город</Text>
        </Pressable>
      ) : null}

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1" keyboardShouldPersistTaps="handled">
        {suggestions.map((city) => (
          <Pressable
            key={city}
            onPress={() => onSelect(city)}
            className="py-4 border-b border-line flex-row items-center justify-between active:opacity-70"
          >
            <Text className="text-base text-ink">{city}</Text>
            {selectedCity === city ? <Ionicons name="checkmark" size={20} color={palette.primary} /> : null}
          </Pressable>
        ))}
        {!loading && query.trim().length > 0 && suggestions.length === 0 ? (
          <Text className="text-center text-base text-ink-muted py-6">Города не найдены</Text>
        ) : null}
        {query.trim().length === 0 ? (
          <Text className="text-center text-sm text-ink-muted py-6">Начните вводить название города</Text>
        ) : null}
      </ScrollView>
    </BottomSheet>
  );
}
