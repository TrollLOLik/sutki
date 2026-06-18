import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { suggestCities } from '@/lib/api/cities';
import { palette, radii } from '@/theme/tokens';

interface CityPickerSheetProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (city: string) => void;
  /** Currently selected city, to render a checkmark. */
  selectedCity?: string | null;
}

/**
 * Bottom-sheet city autocomplete backed by the DaData proxy (via suggestCities,
 * which is city-bounded and returns clean city names). Shared by profile
 * editing and any other screen that needs to pick a city.
 */
export function CityPickerSheet({ visible, onClose, onSelect, selectedCity }: CityPickerSheetProps) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(600)).current;

  useEffect(() => {
    if (visible) {
      setQuery('');
      setSuggestions([]);
      fade.setValue(0);
      slide.setValue(600);
      requestAnimationFrame(() => {
        Animated.parallel([
          Animated.timing(fade, { toValue: 0.4, duration: 250, useNativeDriver: true }),
          Animated.timing(slide, {
            toValue: 0,
            duration: 250,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
        ]).start();
      });
    }
  }, [visible, fade, slide]);

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

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(slide, {
        toValue: 600,
        duration: 200,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start(() => onClose());
  };

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={handleClose}>
      <View className="flex-1 justify-end">
        <Animated.View
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'black', opacity: fade }}
        >
          <Pressable style={{ flex: 1 }} onPress={handleClose} />
        </Animated.View>

        <Animated.View
          style={{
            transform: [{ translateY: slide }],
            backgroundColor: palette.surface,
            borderTopLeftRadius: radii.card,
            borderTopRightRadius: radii.card,
            height: '70%',
          }}
          className="px-4 pb-8 pt-4"
        >
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
        </Animated.View>
      </View>
    </Modal>
  );
}
