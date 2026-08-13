import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SearchOverlayHeader } from '@/components/SearchOverlayHeader';
import { SearchResultItem } from '@/components/SearchResultItem';
import { suggestCities, suggestAddress, type DaDataSuggestion } from '@/lib/api/cities';
import { useAppTheme } from '@/theme/useAppTheme';

interface MapSearchOverlayProps {
  visible: boolean;
  onClose: () => void;
  /** Called when a city is selected — parent should set camera via geocode. */
  onSelectCity: (city: string) => void;
  /** Called when an address is selected — coords for camera are provided. */
  onSelectAddress: (city: string, lat: number, lon: number) => void;
  /** Called when the user submits free-text (keyboard action). */
  onSubmitText: (text: string) => void;
}

/**
 * Full-screen search overlay for the map tab. Supports city autocomplete
 * (DaData suggestCities) and address autocomplete (DaData suggestAddress).
 * Tapping a city moves the map camera to that city; tapping an address
 * moves it to the specific coordinates.
 */
export function MapSearchOverlay({
  visible,
  onClose,
  onSelectCity,
  onSelectAddress,
  onSubmitText,
}: MapSearchOverlayProps) {
  const { palette } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [citySuggestions, setCitySuggestions] = useState<string[]>([]);
  const [addressSuggestions, setAddressSuggestions] = useState<DaDataSuggestion[]>([]);
  const [loadingCities, setLoadingCities] = useState(false);
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const [cityContext, setCityContext] = useState<string | null>(null);
  const searchInputRef = useRef<TextInput>(null);
  const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const focusSearchInput = useCallback(() => {
    if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
    requestAnimationFrame(() => {
      searchInputRef.current?.focus();
      focusTimerRef.current = setTimeout(() => searchInputRef.current?.focus(), 250);
    });
  }, []);

  useEffect(() => () => {
    if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
  }, []);

  useEffect(() => {
    if (!visible) {
      setQuery('');
      setCitySuggestions([]);
      setAddressSuggestions([]);
      setLoadingCities(false);
      setLoadingAddresses(false);
      setCityContext(null);
      return;
    }
  }, [visible]);

  // Debounced suggestions: cities (when no comma — likely a city query)
  useEffect(() => {
    if (!visible) return;
    if (query.trim().length < 2) {
      setCitySuggestions([]);
      setAddressSuggestions([]);
      setLoadingCities(false);
      setLoadingAddresses(false);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      // If we already selected a city, switch to address suggestions
      if (cityContext) {
        setLoadingAddresses(true);
        setLoadingCities(false);
        try {
          const results = await suggestAddress(
            query.trim(),
            'house',
            cityContext,
            undefined,
            controller.signal,
          );
          if (!controller.signal.aborted) {
            setAddressSuggestions(results);
            setLoadingAddresses(false);
          }
        } catch {
          if (!controller.signal.aborted) setLoadingAddresses(false);
        }
      } else {
        // First try city suggestions
        setLoadingCities(true);
        setLoadingAddresses(false);
        try {
          const cities = await suggestCities(query, controller.signal);
          if (!controller.signal.aborted) {
            setCitySuggestions(cities);
            setLoadingCities(false);
            // If no city results, try address suggestions with whatever we have
            if (cities.length === 0) {
              setLoadingAddresses(true);
              const addrs = await suggestAddress(
                query.trim(),
                'house',
                undefined,
                undefined,
                controller.signal,
              );
              if (!controller.signal.aborted) {
                setAddressSuggestions(addrs);
                setLoadingAddresses(false);
              }
            }
          }
        } catch {
          if (!controller.signal.aborted) {
            setLoadingCities(false);
          }
        }
      }
    }, 300);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query, visible, cityContext]);

  const handleSelectCity = (city: string) => {
    setCityContext(city);
    setQuery('');
    setCitySuggestions([]);
    setAddressSuggestions([]);
    onSelectCity(city);
  };

  const handleSelectAddress = (suggestion: DaDataSuggestion) => {
    const city = suggestion.data.city ?? cityContext ?? '';
    const lat = parseFloat(suggestion.data.geo_lat ?? '');
    const lon = parseFloat(suggestion.data.geo_lon ?? '');
    if (city && !isNaN(lat) && !isNaN(lon)) {
      onSelectAddress(city, lat, lon);
    }
    onClose();
  };

  const handleSubmitText = () => {
    const trimmed = query.trim();
    if (trimmed.length > 0) {
      onSubmitText(trimmed);
    }
  };

  // When city context is set, show a chip to clear it
  const cityContextName = cityContext;

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      statusBarTranslucent
      navigationBarTranslucent
      hardwareAccelerated
      onShow={focusSearchInput}
      onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 bg-surface"
      >
        <View className="flex-1 bg-surface" style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
          <SearchOverlayHeader
            inputRef={searchInputRef}
            query={query}
            onChangeText={(text) => {
              setQuery(text);
              if (text.length === 0) setCityContext(null);
            }}
            onClose={onClose}
            onSubmit={handleSubmitText}
            placeholder={cityContextName ? `Адрес в ${cityContextName}…` : 'Город или адрес'}
          />

          {/* City context chip */}
          {cityContextName ? (
            <View className="flex-row items-center px-4 pt-3">
              <Pressable
                onPress={() => {
                  setCityContext(null);
                  setQuery('');
                }}
                className="flex-row items-center gap-2 rounded-pill bg-primary-light border border-primary/20 px-3 py-1.5"
              >
                <Ionicons name="location" size={14} color={palette.primary} />
                <Text className="text-sm font-semibold text-primary">{cityContextName}</Text>
                <Ionicons name="close" size={14} color={palette.primary} />
              </Pressable>
            </View>
          ) : null}

          {/* Suggestions */}
          <ScrollView
            className="flex-1"
            contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 32 }}
            keyboardShouldPersistTaps="handled">
            {loadingCities || loadingAddresses ? (
              <View className="py-8 items-center justify-center">
                <ActivityIndicator color={palette.primary} size="small" />
              </View>
            ) : citySuggestions.length > 0 ? (
              <View>
                <Text className="text-xs font-bold text-ink-secondary tracking-wider mt-3 mb-3">
                  ГОРОДА
                </Text>
                <View style={{ gap: 8 }}>
                  {citySuggestions.map((city) => (
                    <SearchResultItem
                      key={city}
                      icon="location-outline"
                      title={city}
                      onPress={() => handleSelectCity(city)}
                    />
                  ))}
                </View>
              </View>
            ) : addressSuggestions.length > 0 ? (
              <View>
                <Text className="text-xs font-bold text-ink-secondary tracking-wider mt-3 mb-3">
                  {cityContextName ? 'АДРЕСА' : 'АДРЕСА'}
                </Text>
                <View style={{ gap: 8 }}>
                  {addressSuggestions.map((suggestion, index) => (
                    <SearchResultItem
                      key={`${suggestion.value}-${index}`}
                      icon="navigate-outline"
                      title={suggestion.value}
                      subtitle={suggestion.data.city && !cityContextName ? suggestion.data.city : undefined}
                      onPress={() => handleSelectAddress(suggestion)}
                    />
                  ))}
                </View>
              </View>
            ) : query.trim().length > 0 ? (
              <View className="py-8 items-center">
                <Text className="text-sm text-ink-secondary">
                  Ничего не найдено. Нажмите «ввод», чтобы найти на карте.
                </Text>
              </View>
            ) : (
              <View className="py-8 items-center">
                <Text className="text-sm text-ink-muted">Начните вводить город или адрес</Text>
              </View>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
