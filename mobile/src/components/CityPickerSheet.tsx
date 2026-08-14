import { useEffect, useLayoutEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';

import { AppText, BottomSheet, SearchField, SelectionRow } from '@/components/ui';
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
        <View style={{ marginHorizontal: 16, marginBottom: 8 }}>
          <SelectionRow
            label="Любой город"
            icon="globe-outline"
            selected={!selectedCity}
            onPress={() => select(null)}
          />
        </View>
      ) : null}

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1, gap: 8, paddingHorizontal: 16, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        {suggestions.map((city) => (
          <SelectionRow
            key={city}
            label={city}
            icon="location-outline"
            selected={selectedCity === city}
            onPress={() => select(city)}
          />
        ))}

        {loading ? (
          <View style={{ flex: 1, minHeight: 140, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={palette.primary} />
          </View>
        ) : query.trim().length > 0 && suggestions.length === 0 ? (
          <AppText variant="label" tone="muted" align="center" style={{ paddingVertical: 32 }}>
            Города не найдены
          </AppText>
        ) : query.trim().length === 0 ? (
          <AppText variant="caption" tone="muted" align="center" style={{ paddingVertical: 32 }}>
            Введите название города
          </AppText>
        ) : null}
      </ScrollView>
    </BottomSheet>
  );
}
