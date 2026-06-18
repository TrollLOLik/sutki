import { Ionicons } from '@expo/vector-icons';
import { parseISO, format, addDays } from 'date-fns';
import { ru } from 'date-fns/locale';
import { router } from 'expo-router';
import { useMemo, useState, useRef, useEffect } from 'react';
import {
  Animated,
  Easing,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { env } from '@/lib/env';

import { CalendarRange, type DateRange } from '@/components/CalendarRange';
import { EmptyState } from '@/components/EmptyState';
import { ListingCard } from '@/components/ListingCard';
import { ListingCardSkeleton } from '@/components/ListingCardSkeleton';
import { Button, Chip } from '@/components/ui';
import { useMyListings } from '@/lib/api/create-listing';
import { useFavoriteIds, useToggleFavorite } from '@/lib/api/favorites';
import { filtersToListParams, useListings } from '@/lib/api/listings';
import { formatGuests } from '@/lib/format';
import { countActiveFilters, useFiltersStore } from '@/store/filters';
import { BlurView } from 'expo-blur';
import { useTabBarStore } from '@/store/tabbar';
import { useSessionStore } from '@/store/session';
import { palette, radii } from '@/theme/tokens';

const QUICK_FILTERS = [
  { label: 'Квартиры', value: 'all' },
  { label: 'Студии', value: 'studio' },
  { label: '1-комн.', value: '1' },
  { label: '2-комн.', value: '2' },
];

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const filters = useFiltersStore();
  const insets = useSafeAreaInsets();

  const [searchModalVisible, setSearchModalVisible] = useState(false);

  const headerAnim = useRef(new Animated.Value(1)).current;
  const headerVisible = useRef(true);
  const lastOffset = useRef(0);

  const handleScroll = (event: any) => {
    const currentOffset = event.nativeEvent.contentOffset.y;

    // 1. Tab Bar scroll hide logic
    if (currentOffset <= 10) {
      if (!useTabBarStore.getState().visible) {
        useTabBarStore.getState().setVisible(true);
      }
    } else {
      const direction = currentOffset > lastOffset.current ? 'down' : 'up';
      if (direction === 'down' && useTabBarStore.getState().visible) {
        useTabBarStore.getState().setVisible(false);
      } else if (direction === 'up' && !useTabBarStore.getState().visible) {
        useTabBarStore.getState().setVisible(true);
      }
    }

    // 2. Search Filters collapse logic
    if (currentOffset <= 10) {
      if (!headerVisible.current) {
        headerVisible.current = true;
        Animated.timing(headerAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: false,
        }).start();
      }
    } else {
      const direction = currentOffset > lastOffset.current ? 'down' : 'up';
      if (direction === 'down' && headerVisible.current) {
        headerVisible.current = false;
        Animated.timing(headerAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: false,
        }).start();
      } else if (direction === 'up' && !headerVisible.current) {
        headerVisible.current = true;
        Animated.timing(headerAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: false,
        }).start();
      }
    }

    lastOffset.current = currentOffset;
  };

  const headerHeight = headerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 104],
  });
  const headerOpacity = headerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const listPaddingTop = insets.top + 172;
  const listParams = useMemo(
    () => filtersToListParams(filters, query, { limit: 50 }),
    [filters, query],
  );
  const { data, isLoading, isError, refetch, isRefetching } = useListings(listParams);
  const { data: favoriteIds } = useFavoriteIds();
  const toggleFavorite = useToggleFavorite();

  const { status: authStatus } = useSessionStore();
  const isAuthenticated = authStatus === 'authenticated';
  const { data: myListingsData } = useMyListings({ limit: 50 }, { enabled: isAuthenticated });

  const myListingsIds = useMemo(() => {
    return new Set(myListingsData?.items.map((item) => item.id) ?? []);
  }, [myListingsData]);

  const visible = useMemo(() => {
    // Filtering (text, city, price, rooms, amenities, guests, dates) is done
    // server-side; only the favorites toggle and hiding the user's own
    // listings remain client-side.
    let list = data?.items ?? [];
    if (filters.favoritesOnly) {
      list = list.filter((item) => favoriteIds?.has(item.id) ?? false);
    }
    if (isAuthenticated && myListingsIds.size > 0) {
      list = list.filter((item) => !myListingsIds.has(item.id));
    }
    return list;
  }, [data?.items, filters.favoritesOnly, favoriteIds, isAuthenticated, myListingsIds]);

  const activeFilters = countActiveFilters(filters);

  // Picker States
  const [dateModalVisible, setDateModalVisible] = useState(false);
  const [guestModalVisible, setGuestModalVisible] = useState(false);

  const [tempRange, setTempRange] = useState<DateRange>({ start: null, end: null });
  const [tempGuests, setTempGuests] = useState(filters.guests);

  const dateFade = useRef(new Animated.Value(0)).current;
  const dateSlide = useRef(new Animated.Value(600)).current;

  const guestFade = useRef(new Animated.Value(0)).current;
  const guestSlide = useRef(new Animated.Value(400)).current;

  const openDateModal = () => {
    const start = filters.checkIn ? parseISO(filters.checkIn) : null;
    const end = filters.checkOut ? parseISO(filters.checkOut) : null;
    setTempRange({ start, end });
    setDateModalVisible(true);
    Animated.parallel([
      Animated.timing(dateFade, {
        toValue: 0.4,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(dateSlide, {
        toValue: 0,
        duration: 250,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();
  };

  const closeDateModal = () => {
    Animated.parallel([
      Animated.timing(dateFade, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(dateSlide, {
        toValue: 600,
        duration: 200,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setDateModalVisible(false);
    });
  };

  const openGuestModal = () => {
    setTempGuests(filters.guests);
    setGuestModalVisible(true);
    Animated.parallel([
      Animated.timing(guestFade, {
        toValue: 0.4,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(guestSlide, {
        toValue: 0,
        duration: 250,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();
  };

  const closeGuestModal = () => {
    Animated.parallel([
      Animated.timing(guestFade, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(guestSlide, {
        toValue: 400,
        duration: 200,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setGuestModalVisible(false);
    });
  };

  const handleApplyDates = () => {
    if (tempRange.start) {
      const startStr = format(tempRange.start, 'yyyy-MM-dd');
      let endStr: string | null = null;
      if (tempRange.end) {
        endStr = format(tempRange.end, 'yyyy-MM-dd');
      } else {
        const nextDay = addDays(tempRange.start, 1);
        endStr = format(nextDay, 'yyyy-MM-dd');
      }
      filters.setFilters({ checkIn: startStr, checkOut: endStr });
    } else {
      filters.setFilters({ checkIn: null, checkOut: null });
    }
    closeDateModal();
  };

  const handleApplyGuests = () => {
    filters.setFilters({ guests: tempGuests });
    closeGuestModal();
  };

  // Dates Display Label
  const dateLabel = useMemo(() => {
    if (filters.checkIn && filters.checkOut) {
      try {
        const start = parseISO(filters.checkIn);
        const end = parseISO(filters.checkOut);
        const startDay = start.getDate();
        const endDay = end.getDate();
        const startMonthName = format(start, 'MMM', { locale: ru }).replace('.', '');
        const endMonthName = format(end, 'MMM', { locale: ru }).replace('.', '');
        
        if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
          return `${startDay} — ${endDay} ${startMonthName}`;
        }
        return `${startDay} ${startMonthName} — ${endDay} ${endMonthName}`;
      } catch (e) {
        return 'Сегодня — Завтра';
      }
    }
    return 'Сегодня — Завтра';
  }, [filters.checkIn, filters.checkOut]);

  return (
    <View className="flex-1 bg-surface">
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 10,
            paddingTop: insets.top + 10,
            paddingBottom: 10,
            overflow: 'hidden',
          },
        ]}
        className="px-4"
      >
        <Animated.View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            opacity: headerAnim,
          }}
        >
          <BlurView
            intensity={95}
            tint="light"
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          />
        </Animated.View>
        <View className="flex-row items-center gap-2">
          <Pressable
            onPress={() => {
              setSearchModalVisible(true);
            }}
            className="h-12 flex-1 flex-row items-center rounded-field border border-line bg-surface px-3 active:bg-surface-muted"
          >
            <Ionicons name="search" size={20} color={palette.inkMuted} />
            <Text
              numberOfLines={1}
              className={`ml-2 flex-1 text-base ${query ? 'text-ink font-semibold' : 'text-ink-muted'}`}
            >
              {query || 'Город, адрес или название'}
            </Text>
            {query.length > 0 ? (
              <Pressable
                accessibilityLabel="Очистить"
                onPress={(e) => {
                  e.stopPropagation();
                  setQuery('');
                }}
              >
                <Ionicons name="close-circle" size={18} color={palette.inkMuted} />
              </Pressable>
            ) : null}
          </Pressable>
          <Pressable
            accessibilityLabel="Фильтры"
            onPress={() => router.push('/filters')}
            className="h-12 w-12 items-center justify-center rounded-field border border-line bg-surface active:bg-surface-muted">
            <Ionicons name="options-outline" size={22} color={palette.primary} />
            {activeFilters > 0 ? (
              <View className="absolute -right-1 -top-1 h-5 min-w-5 items-center justify-center rounded-pill bg-primary px-1">
                <Text className="text-xs font-bold text-white">{activeFilters}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>

        <Animated.View
          style={{
            height: headerHeight,
            opacity: headerOpacity,
            overflow: 'hidden',
          }}
        >
          <FlatList
            style={{ marginTop: 10, height: 36, minHeight: 36, maxHeight: 36 }}
            data={QUICK_FILTERS}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => item.value}
            contentContainerClassName="gap-2"
            renderItem={({ item }) => {
              const isAll = item.value === 'all';
              const selected = isAll
                ? filters.rooms.length === 0
                : filters.rooms.includes(item.value as any);
              return (
                <Chip
                  label={item.label}
                  selected={selected}
                  onPress={() => {
                    if (isAll) {
                      filters.setFilters({ rooms: [] });
                    } else {
                      filters.toggleRoom(item.value as any);
                    }
                  }}
                />
              );
            }}
          />

          <View style={{ marginTop: 10 }} className="flex-row items-center gap-2">
            {/* Dates Button */}
            <Pressable
              onPress={openDateModal}
              className="flex-1 h-12 flex-row items-center justify-between rounded-field border border-line bg-surface px-3 active:bg-surface-muted">
              <View className="flex-row items-center gap-2">
                <Ionicons name="calendar-outline" size={18} color={palette.primary} />
                <Text className="text-sm font-medium text-ink">{dateLabel}</Text>
              </View>
              <Ionicons name="chevron-down" size={16} color={palette.inkMuted} />
            </Pressable>

            {/* Guests Button */}
            <Pressable
              onPress={openGuestModal}
              className="flex-1 h-12 flex-row items-center justify-between rounded-field border border-line bg-surface px-3 active:bg-surface-muted">
              <View className="flex-row items-center gap-2">
                <Ionicons name="person-outline" size={18} color={palette.primary} />
                <Text className="text-sm font-medium text-ink">{formatGuests(filters.guests)}</Text>
              </View>
              <Ionicons name="chevron-down" size={16} color={palette.inkMuted} />
            </Pressable>

            {/* Favorites filter (replaces the old Избранное tab) */}
            <Pressable
              accessibilityLabel="Только избранное"
              accessibilityState={{ selected: filters.favoritesOnly }}
              onPress={filters.toggleFavoritesOnly}
              className={`h-12 w-12 items-center justify-center rounded-field border active:opacity-80 ${
                filters.favoritesOnly ? 'border-primary bg-primary-light' : 'border-line bg-surface'
              }`}>
              <Ionicons
                name={filters.favoritesOnly ? 'heart' : 'heart-outline'}
                size={22}
                color={palette.primary}
              />
            </Pressable>
          </View>
        </Animated.View>
      </Animated.View>

      {isLoading ? (
        <FlatList
          data={[0, 1, 2, 3]}
          keyExtractor={(i) => String(i)}
          contentContainerClassName="px-4"
          contentContainerStyle={{ paddingTop: listPaddingTop, paddingBottom: 112 }}
          showsVerticalScrollIndicator={false}
          renderItem={() => <ListingCardSkeleton />}
        />
      ) : isError ? (
        <View style={{ paddingTop: listPaddingTop }} className="flex-1 gap-4 px-4">
          <EmptyState
            icon="cloud-offline-outline"
            title="Не удалось загрузить"
            subtitle="Проверьте подключение и попробуйте снова."
          />
          <View className="px-8">
            <Button label="Повторить" variant="secondary" onPress={() => refetch()} />
          </View>
        </View>
      ) : visible.length === 0 ? (
        <View style={{ paddingTop: listPaddingTop }} className="flex-1">
          <EmptyState
            icon="search-outline"
            title="Ничего не найдено"
            subtitle="Измените запрос или сбросьте фильтры."
          />
        </View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(item) => String(item.id)}
          contentContainerClassName="px-4"
          contentContainerStyle={{ paddingTop: listPaddingTop, paddingBottom: 112 }}
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => refetch()}
              tintColor={palette.primary}
            />
          }
          renderItem={({ item }) => (
            <ListingCard
              listing={item}
              onPress={() =>
                router.push({ pathname: '/listing/[id]', params: { id: String(item.id) } })
              }
              isFavorite={favoriteIds?.has(item.id) ?? false}
              onToggleFavorite={() =>
                toggleFavorite.mutate({
                  id: item.id,
                  isFavorite: favoriteIds?.has(item.id) ?? false,
                })
              }
            />
          )}
        />
      )}

      {/* Date Picker Bottom Sheet Modal */}
      {dateModalVisible && (
        <Modal visible={true} transparent animationType="none">
          <View className="flex-1 justify-end">
            {/* Animated Backdrop */}
            <Animated.View
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'black',
                opacity: dateFade,
              }}
            >
              <Pressable style={{ flex: 1 }} onPress={closeDateModal} />
            </Animated.View>

            {/* Animated Bottom Sheet Container */}
            <Animated.View
              style={{
                transform: [{ translateY: dateSlide }],
                backgroundColor: palette.surface,
                borderTopLeftRadius: radii.card,
                borderTopRightRadius: radii.card,
              }}
              className="px-4 pb-8 pt-4"
            >
              {/* Header */}
              <View className="flex-row items-center justify-between pb-4 border-b border-line mb-4">
                <TouchableOpacity onPress={() => setTempRange({ start: null, end: null })} className="min-w-[80px] py-1">
                  <Text className="text-sm font-semibold text-primary">Сбросить</Text>
                </TouchableOpacity>
                <Text className="text-lg font-bold text-ink">Выберите даты</Text>
                <TouchableOpacity onPress={closeDateModal} className="min-w-[80px] py-1 items-end">
                  <Ionicons name="close" size={24} color={palette.ink} />
                </TouchableOpacity>
              </View>

              {/* Calendar component from booking screen */}
              <View className="py-2">
                <CalendarRange value={tempRange} onChange={setTempRange} />
              </View>

              {/* Apply Button */}
              <View className="mt-4">
                <Button label="Применить" onPress={handleApplyDates} />
              </View>
            </Animated.View>
          </View>
        </Modal>
      )}

      {/* Guest Picker Bottom Sheet Modal */}
      {guestModalVisible && (
        <Modal visible={true} transparent animationType="none">
          <View className="flex-1 justify-end">
            {/* Animated Backdrop */}
            <Animated.View
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'black',
                opacity: guestFade,
              }}
            >
              <Pressable style={{ flex: 1 }} onPress={closeGuestModal} />
            </Animated.View>

            {/* Animated Bottom Sheet Container */}
            <Animated.View
              style={{
                transform: [{ translateY: guestSlide }],
                backgroundColor: palette.surface,
                borderTopLeftRadius: radii.card,
                borderTopRightRadius: radii.card,
              }}
              className="px-4 pb-8 pt-4"
            >
              {/* Header */}
              <View className="flex-row items-center justify-between pb-4 border-b border-line mb-6">
                <View className="w-10" />
                <Text className="text-lg font-bold text-ink">Количество гостей</Text>
                <TouchableOpacity onPress={closeGuestModal} className="w-10 items-end">
                  <Ionicons name="close" size={24} color={palette.ink} />
                </TouchableOpacity>
              </View>

              {/* Counter Row */}
              <View className="flex-row items-center justify-center gap-6 py-6 mb-4">
                <TouchableOpacity
                  disabled={tempGuests <= 1}
                  onPress={() => setTempGuests((g) => Math.max(1, g - 1))}
                  className="h-12 w-12 items-center justify-center rounded-full border border-line active:bg-surface-muted disabled:opacity-40"
                >
                  <Ionicons name="remove" size={24} color={palette.ink} />
                </TouchableOpacity>
                
                <Text className="min-w-16 text-center text-3xl font-extrabold text-ink">
                  {tempGuests}
                </Text>

                <TouchableOpacity
                  onPress={() => setTempGuests((g) => g + 1)}
                  className="h-12 w-12 items-center justify-center rounded-full border border-line active:bg-surface-muted"
                >
                  <Ionicons name="add" size={24} color={palette.ink} />
                </TouchableOpacity>
              </View>

              {/* Apply Button */}
              <Button label="Применить" onPress={handleApplyGuests} />
            </Animated.View>
          </View>
        </Modal>
      )}

      {/* Dadata Search Overlay Modal */}
      <SearchModal
        visible={searchModalVisible}
        onClose={() => setSearchModalVisible(false)}
        onSelect={(val) => {
          setQuery(val);
          setSearchModalVisible(false);
        }}
        initialValue={query}
      />
    </View>
  );
}

interface SearchModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (q: string) => void;
  initialValue: string;
}

// DaData suggestion fetcher helper
const fetchSuggestions = async (q: string): Promise<string[]> => {
  const trimmed = q.trim();
  if (trimmed.length === 0) return [];
  try {
    const res = await fetch(`${env.apiUrl}/api/v1/cities/suggest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        query: trimmed,
      }),
    });
    const data = await res.json();
    if (data?.suggestions) {
      return (data.suggestions as any[])
        .map((s) => s?.value)
        .filter((v: unknown): v is string => typeof v === 'string' && v.length > 0)
        .filter((v: string, i: number, a: string[]) => a.indexOf(v) === i);
    }
  } catch (err) {
    console.error('DaData suggestion fetch error:', err);
  }
  return [];
};

function SearchModal({ visible, onClose, onSelect, initialValue }: SearchModalProps) {
  const [searchVal, setSearchVal] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (visible) {
      setSearchVal(initialValue);
      setSuggestions([]);
    } else {
      setSearchVal('');
      setSuggestions([]);
      setIsLoadingSuggestions(false);
    }
  }, [visible, initialValue]);

  // Debounced suggestion fetching
  useEffect(() => {
    if (!visible) return;

    if (searchVal.trim().length === 0) {
      setSuggestions([]);
      setIsLoadingSuggestions(false);
      return;
    }

    setIsLoadingSuggestions(true);
    const delayDebounceFn = setTimeout(async () => {
      const results = await fetchSuggestions(searchVal);
      setSuggestions(results);
      setIsLoadingSuggestions(false);
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchVal, visible]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 bg-surface"
      >
        <View
          className="flex-1 bg-surface"
          style={{
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
          }}
        >
          {/* Header */}
          <View className="flex-row items-center justify-between px-4 pb-4 pt-2 border-b border-line">
            <View className="flex-1 flex-row items-center rounded-field bg-surface-muted px-3 h-12 border border-line">
              <Ionicons name="search" size={20} color={palette.inkMuted} />
              <TextInput
                value={searchVal}
                onChangeText={setSearchVal}
                placeholder="Город, адрес или название"
                placeholderTextColor={palette.inkMuted}
                autoFocus
                className="ml-2 flex-1 text-base text-ink"
                onSubmitEditing={() => {
                  if (searchVal.trim()) {
                    onSelect(searchVal.trim());
                  }
                }}
              />
              {searchVal.length > 0 ? (
                <Pressable onPress={() => setSearchVal('')}>
                  <Ionicons name="close-circle" size={18} color={palette.inkMuted} />
                </Pressable>
              ) : null}
            </View>
            <Pressable
              onPress={onClose}
              className="ml-4 h-12 justify-center"
            >
              <Text className="text-base font-semibold text-primary">Отменить</Text>
            </Pressable>
          </View>

          {/* Suggestions & Popular */}
          <ScrollView className="flex-1 px-4 pt-2 pb-6" keyboardShouldPersistTaps="handled">
            {isLoadingSuggestions ? (
              <View className="py-8 items-center justify-center">
                <ActivityIndicator color={palette.primary} size="small" />
              </View>
            ) : searchVal.trim().length > 0 ? (
              <View>
                <Text className="text-xs font-bold text-ink-secondary tracking-wider mt-3 mb-3">РЕЗУЛЬТАТЫ ПОИСКА</Text>
                {suggestions.map((item, index) => (
                  <Pressable
                    key={index}
                    onPress={() => onSelect(item)}
                    className="flex-row items-center py-3.5 border-b border-line active:opacity-70"
                  >
                    <View className="h-9 w-9 rounded-pill bg-surface-muted items-center justify-center mr-3">
                      <Ionicons name="location-outline" size={18} color={palette.primary} />
                    </View>
                    <View className="flex-1">
                      <Text className="text-base text-ink font-semibold" numberOfLines={1}>{item}</Text>
                    </View>
                  </Pressable>
                ))}
                {suggestions.length === 0 && (
                  <View className="py-8 items-center">
                    <Text className="text-sm text-ink-secondary">Ничего не найдено</Text>
                  </View>
                )}
              </View>
            ) : (
              <View>
                {/* Recent Searches stub */}
                <Text className="text-xs font-bold text-ink-secondary tracking-wider mt-3 mb-3">НЕДАВНИЕ ЗАПРОСЫ</Text>
                {[
                  { name: 'Москва, Пресненская набережная', date: 'Вчера' },
                  { name: 'Санкт-Петербург, Невский проспект', date: '2 дня назад' },
                ].map((item, index) => (
                  <Pressable
                    key={index}
                    onPress={() => onSelect(item.name)}
                    className="flex-row items-center py-3.5 border-b border-line active:opacity-70"
                  >
                    <View className="h-9 w-9 rounded-pill bg-surface-muted items-center justify-center mr-3">
                      <Ionicons name="time-outline" size={18} color={palette.inkSecondary} />
                    </View>
                    <View className="flex-1">
                      <Text className="text-base text-ink font-medium" numberOfLines={1}>{item.name}</Text>
                      <Text className="text-xs text-ink-secondary mt-0.5">{item.date}</Text>
                    </View>
                  </Pressable>
                ))}

                <Text className="text-xs font-bold text-ink-secondary tracking-wider mt-6 mb-3">ПОПУЛЯРНЫЕ НАПРАВЛЕНИЯ</Text>
                {[
                  { name: 'Москва', desc: 'Столица России' },
                  { name: 'Санкт-Петербург', desc: 'Культурная столица' },
                  { name: 'Казань', desc: 'Третья столица' },
                  { name: 'Сочи', desc: 'Курортный город' },
                  { name: 'Краснодар', desc: 'Южный мегаполис' },
                ].map((item, index) => (
                  <Pressable
                    key={index}
                    onPress={() => onSelect(item.name)}
                    className="flex-row items-center py-3.5 border-b border-line active:opacity-70"
                  >
                    <View className="h-9 w-9 rounded-pill bg-primary-light items-center justify-center mr-3">
                      <Ionicons name="trending-up" size={18} color={palette.primary} />
                    </View>
                    <View className="flex-1">
                      <Text className="text-base text-ink font-semibold">{item.name}</Text>
                      <Text className="text-xs text-ink-secondary mt-0.5">{item.desc}</Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}


