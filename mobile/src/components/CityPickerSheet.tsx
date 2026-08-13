import { Ionicons } from '@expo/vector-icons';
import { useEffect, useLayoutEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

import { BottomSheet, SearchField } from '@/components/ui';
import { suggestCities } from '@/lib/api/cities';
import { useAppTheme } from '@/theme/useAppTheme';

interface CityPickerSheetProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (city: string | null) => void;
  selectedCity?: string | null;
  allowAnyCity?: boolean;
}

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

  useLayoutEffect(() => {
    if (!visible) return;
    setQuery('');
    setSuggestions([]);
    setLoading(false);
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    if (query.trim().length === 0) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      const results = await suggestCities(query, controller.signal);
      if (!controller.signal.aborted) {
        setSuggestions(results);
        setLoading(false);
      }
    }, 300);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query, visible]);

  const select = (city: string | null) => {
    onSelect(city);
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      height="72%"
      title="Выберите город"
      subtitle="Начните вводить название"
      icon="location-outline"
      bodyStyle={{ paddingHorizontal: 0, paddingTop: 16, paddingBottom: 0 }}>
      <SearchField
        value={query}
        onChangeText={setQuery}
        placeholder="Поиск города"
        autoFocus
        containerStyle={{ marginHorizontal: 16, marginBottom: 12 }}
      />

      {allowAnyCity ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => select(null)}
          style={{
            minHeight: 56,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            borderBottomWidth: 1,
            borderBottomColor: palette.line,
            paddingHorizontal: 18,
          }}>
          <Ionicons name="globe-outline" size={20} color={palette.primary} />
          <Text style={{ flex: 1, color: palette.ink, fontSize: 15, fontWeight: '700' }}>Любой город</Text>
          {!selectedCity ? <Ionicons name="checkmark" size={20} color={palette.primary} /> : null}
        </Pressable>
      ) : null}

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        {suggestions.map((city) => (
          <Pressable
            key={city}
            accessibilityRole="button"
            onPress={() => select(city)}
            style={{
              minHeight: 56,
              flexDirection: 'row',
              alignItems: 'center',
              borderBottomWidth: 1,
              borderBottomColor: palette.line,
              paddingHorizontal: 18,
            }}>
            <Text numberOfLines={1} style={{ minWidth: 0, flex: 1, color: palette.ink, fontSize: 15 }}>
              {city}
            </Text>
            {selectedCity === city ? <Ionicons name="checkmark" size={20} color={palette.primary} /> : null}
          </Pressable>
        ))}

        {loading ? (
          <View style={{ flex: 1, minHeight: 140, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={palette.primary} />
          </View>
        ) : query.trim().length > 0 && suggestions.length === 0 ? (
          <Text style={{ paddingVertical: 32, textAlign: 'center', color: palette.inkMuted, fontSize: 14 }}>
            Города не найдены
          </Text>
        ) : query.trim().length === 0 ? (
          <Text style={{ paddingVertical: 32, textAlign: 'center', color: palette.inkMuted, fontSize: 13 }}>
            Введите название города
          </Text>
        ) : null}
      </ScrollView>
    </BottomSheet>
  );
}
