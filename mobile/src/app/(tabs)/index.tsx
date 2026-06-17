import { Ionicons } from '@expo/vector-icons';
import { parseISO, format, addDays } from 'date-fns';
import { ru } from 'date-fns/locale';
import { router } from 'expo-router';
import { useMemo, useState, useRef } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CalendarRange, type DateRange } from '@/components/CalendarRange';
import { EmptyState } from '@/components/EmptyState';
import { ListingCard } from '@/components/ListingCard';
import { ListingCardSkeleton } from '@/components/ListingCardSkeleton';
import { Button, Chip } from '@/components/ui';
import { useFavoriteIds, useToggleFavorite } from '@/lib/api/favorites';
import { useListings } from '@/lib/api/listings';
import { formatGuests } from '@/lib/format';
import { filterListings } from '@/lib/listing-filters';
import { useFiltersStore } from '@/store/filters';
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
  const { data, isLoading, isError, refetch, isRefetching } = useListings({ limit: 50 });
  const { data: favoriteIds } = useFavoriteIds();
  const toggleFavorite = useToggleFavorite();

  const visible = useMemo(() => {
    const list = filterListings(data?.items ?? [], filters, query);
    if (filters.favoritesOnly) {
      return list.filter((item) => favoriteIds?.has(item.id) ?? false);
    }
    return list;
  }, [data?.items, filters, query, favoriteIds]);

  const activeFilters =
    filters.rooms.length +
    filters.amenities.length +
    (filters.priceMin != null || filters.priceMax != null ? 1 : 0);

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
    <SafeAreaView edges={['top']} className="flex-1 bg-surface">
      <View className="gap-3 px-4 pb-3 pt-2">
        <View className="flex-row items-center gap-2">
          <View className="h-12 flex-1 flex-row items-center rounded-field border border-line bg-surface px-3">
            <Ionicons name="search" size={20} color={palette.inkMuted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Город, адрес или metro"
              placeholderTextColor={palette.inkMuted}
              returnKeyType="search"
              className="ml-2 flex-1 text-base text-ink"
            />
            {query.length > 0 ? (
              <Pressable accessibilityLabel="Очистить" onPress={() => setQuery('')}>
                <Ionicons name="close-circle" size={18} color={palette.inkMuted} />
              </Pressable>
            ) : null}
          </View>
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

        <FlatList
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

        <View className="flex-row items-center gap-2">
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
      </View>

      {isLoading ? (
        <FlatList
          data={[0, 1, 2, 3]}
          keyExtractor={(i) => String(i)}
          contentContainerClassName="px-4 pb-6"
          showsVerticalScrollIndicator={false}
          renderItem={() => <ListingCardSkeleton />}
        />
      ) : isError ? (
        <View className="flex-1 gap-4 px-4">
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
        <EmptyState
          icon="search-outline"
          title="Ничего не найдено"
          subtitle="Измените запрос или сбросьте фильтры."
        />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(item) => String(item.id)}
          contentContainerClassName="px-4 pb-6"
          showsVerticalScrollIndicator={false}
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
    </SafeAreaView>
  );
}

