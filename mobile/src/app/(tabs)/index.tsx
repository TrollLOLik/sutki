import { Ionicons } from '@expo/vector-icons';
import { parseISO, format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { router } from 'expo-router';
import { useCallback, useMemo, useState, useRef, useEffect } from 'react';
import {
  Animated,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';

import { DatePickerSheet } from '@/components/DatePickerSheet';
import { EmptyState } from '@/components/EmptyState';
import { ListingCard } from '@/components/ListingCard';
import { ListingCardSkeleton } from '@/components/ListingCardSkeleton';
import { SearchOverlayHeader } from '@/components/SearchOverlayHeader';
import { SearchResultItem } from '@/components/SearchResultItem';
import { Button, Chip, BottomSheet } from '@/components/ui';
import { suggestCities } from '@/lib/api/cities';
import { useMyListings } from '@/lib/api/create-listing';
import { useFavoriteIds, useToggleFavorite } from '@/lib/api/favorites';
import { useViewedListingIds } from '@/lib/api/viewed-listings';
import { filtersToListParams, similarFiltersToListParams, useListings } from '@/lib/api/listings';
import { formatGuests } from '@/lib/format';
import { addRecentSearch, clearRecentSearches, getRecentSearches } from '@/lib/recent-searches';
import { requireAuth } from '@/lib/requireAuth';
import { countActiveFilters, useFiltersStore, type RoomFilter } from '@/store/filters';
import { useSessionStore } from '@/store/session';
import { useTabBarStore } from '@/store/tabbar';
import { radii } from '@/theme/tokens';
import { useAppTheme } from '@/theme/useAppTheme';

const QUICK_FILTERS: { label: string; value: 'all' | RoomFilter }[] = [
  { label: 'Все', value: 'all' },
  { label: 'Студия', value: 'studio' },
  { label: '1-комн.', value: '1' },
  { label: '2-комн.', value: '2' },
  { label: '3-комн.', value: '3' },
  { label: '4-комн.', value: '4' },
  { label: '5+ комнат', value: '5plus' },
];

export default function SearchScreen() {
  const { palette, isDark } = useAppTheme();
  const screenBackground = isDark ? '#0D0F12' : '#F4F5F7';
  const [query, setQuery] = useState('');
  const filters = useFiltersStore();
  const insets = useSafeAreaInsets();

  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const quickFiltersRef = useRef<ScrollView>(null);
  const quickFilterOffsets = useRef<Record<string, number>>({});

  const scrollToActiveQuickFilter = useCallback(() => {
    const activeValue = filters.rooms.at(-1) ?? 'all';
    const offset = quickFilterOffsets.current[activeValue];
    if (offset != null) {
      quickFiltersRef.current?.scrollTo({ x: Math.max(0, offset - 12), animated: true });
    }
  }, [filters.rooms]);

  useEffect(() => {
    const timer = setTimeout(scrollToActiveQuickFilter, 0);
    return () => clearTimeout(timer);
  }, [scrollToActiveQuickFilter]);

  // The pill reflects either an exact city filter (picked from the overlay) or a
  // free-text query (typed + submitted). Clearing resets both.
  const searchLabel = filters.city ?? (query.trim().length > 0 ? query : '');
  const clearSearch = () => {
    setQuery('');
    filters.setFilters({ city: null });
  };

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
    outputRange: [0, 114],
  });
  const headerOpacity = headerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const listPaddingTop = insets.top + 182;

  const { data: favoriteIds } = useFavoriteIds();
  const { data: viewedListingIds } = useViewedListingIds();
  const toggleFavorite = useToggleFavorite();

  const { status: authStatus, user } = useSessionStore();
  const isAuthenticated = authStatus === 'authenticated';
  const isGuest = authStatus === 'guest';

  const isFavoritesOnlyEmpty = filters.favoritesOnly && (!favoriteIds || favoriteIds.size === 0);
  const searchConstraintCount = countActiveFilters(filters);
  const activeFilters = searchConstraintCount + Number(filters.showOwnListings);
  const hasSearchConstraints = searchConstraintCount > 0 || query.trim().length > 0;

  const listParams = useMemo(() => {
    const params = filtersToListParams(filters, query, { limit: 50 });
    if (filters.favoritesOnly && favoriteIds) {
      params.houseIds = Array.from(favoriteIds);
    }
    return params;
  }, [filters, query, filters.favoritesOnly, favoriteIds]);

  const { data, isLoading, isError, isFetching, refetch, isRefetching } = useListings(listParams, {
    enabled: !isFavoritesOnlyEmpty,
  });

  const { data: myListingsData } = useMyListings(
    { limit: 50 },
    { enabled: isAuthenticated && !filters.showOwnListings },
  );

  const myListingsIds = useMemo(() => {
    return new Set(myListingsData?.items.map((item) => item.id) ?? []);
  }, [myListingsData]);

  const visible = useMemo(() => {
    if (isFavoritesOnlyEmpty) return [];
    // Filtering (text, city, price, rooms, amenities, guests, dates) is done
    // server-side; only the favorites toggle and hiding the user's own
    // listings remain client-side.
    let list = data?.items ?? [];
    if (filters.favoritesOnly) {
      list = list.filter((item) => favoriteIds?.has(item.id) ?? false);
    }
    if (isAuthenticated && !filters.showOwnListings && myListingsIds.size > 0) {
      list = list.filter((item) => !myListingsIds.has(item.id));
    }
    return list;
  }, [data?.items, filters.favoritesOnly, filters.showOwnListings, favoriteIds, isAuthenticated, myListingsIds, isFavoritesOnlyEmpty]);

  const similarParams = useMemo(
    () => similarFiltersToListParams(filters, query, { limit: 12 }),
    [filters, query],
  );
  const shouldLoadSimilar =
    !filters.favoritesOnly &&
    !isFavoritesOnlyEmpty &&
    !isLoading &&
    !isFetching &&
    !isError &&
    visible.length === 0 &&
    hasSearchConstraints;
  const {
    data: similarData,
    isLoading: similarLoading,
    isFetching: similarFetching,
    isPlaceholderData: similarPlaceholder,
    refetch: refetchSimilar,
  } = useListings(similarParams, { enabled: shouldLoadSimilar });
  const similarVisible = useMemo(() => {
    if (!shouldLoadSimilar) return [];
    let list = similarData?.items ?? [];
    if (isAuthenticated && !filters.showOwnListings && myListingsIds.size > 0) {
      list = list.filter((item) => !myListingsIds.has(item.id));
    }
    return list;
  }, [filters.showOwnListings, isAuthenticated, myListingsIds, shouldLoadSimilar, similarData?.items]);
  const similarPending = shouldLoadSimilar && (similarLoading || similarFetching || similarPlaceholder);
  const showingSimilar = shouldLoadSimilar && !similarPending && similarVisible.length > 0;
  const feedItems = showingSimilar ? similarVisible : visible;

  const renderListHeader = () => {
    if (isGuest && filters.favoritesOnly) {
      return (
        <Pressable
          onPress={() => requireAuth('favorites_cloud')}
          className="mb-4 flex-row items-center gap-3 rounded-card bg-primary-light border border-primary/20 p-4 active:opacity-90"
        >
          <View className="h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <Ionicons name="cloud-upload-outline" size={20} color={palette.primary} />
          </View>
          <View className="flex-1">
            <Text className="text-sm font-bold text-ink">Синхронизируйте избранное</Text>
            <Text className="text-xs text-ink-secondary mt-0.5">
              Войдите в аккаунт, чтобы сохранить избранное в облаке и видеть его на других устройствах.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={palette.primary} />
        </Pressable>
      );
    }
    return null;
  };

  // Picker States
  const [dateModalVisible, setDateModalVisible] = useState(false);
  const [guestModalVisible, setGuestModalVisible] = useState(false);

  const [tempGuests, setTempGuests] = useState(filters.guests);

  const openGuestModal = () => {
    setTempGuests(filters.guests);
    setGuestModalVisible(true);
  };

  const closeGuestModal = () => {
    setGuestModalVisible(false);
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
        return 'Любые даты';
      }
    }
    return 'Любые даты';
  }, [filters.checkIn, filters.checkOut]);

  return (
    <View style={{ flex: 1, backgroundColor: screenBackground }}>
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
            intensity={88}
            tint={isDark ? 'dark' : 'light'}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          />
          <View
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
              backgroundColor: isDark ? 'rgba(13,15,18,0.72)' : 'rgba(244,245,247,0.7)',
            }}
          />
        </Animated.View>
        <View style={{ width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Pressable
            onPress={() => {
              setSearchModalVisible(true);
            }}
            style={{
              flex: 1,
              height: 48,
              marginRight: 10,
              paddingHorizontal: 12,
              flexDirection: 'row',
              alignItems: 'center',
              borderRadius: 24,
              borderWidth: 1,
              borderColor: palette.line,
              backgroundColor: palette.surface,
              shadowColor: '#1A1A1A',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 6,
              elevation: 3,
            }}
          >
            <Ionicons name="search" size={20} color={palette.inkMuted} />
            <Text
              numberOfLines={1}
              style={{ flex: 1, marginLeft: 8, marginRight: 8, fontSize: 14, fontWeight: '500', color: searchLabel ? palette.ink : palette.inkMuted }}
            >
              {searchLabel || 'Город, адрес или название'}
            </Text>
            {searchLabel.length > 0 ? (
              <Pressable
                accessibilityLabel="Очистить"
                onPress={(e) => {
                  e.stopPropagation();
                  clearSearch();
                }}
              >
                <Ionicons name="close-circle" size={18} color={palette.inkMuted} />
              </Pressable>
            ) : null}
          </Pressable>
          <Pressable
            accessibilityLabel="Фильтры"
            onPress={() =>
              router.push({
                pathname: '/filters',
                params: query.trim() ? { q: query.trim() } : undefined,
              })
            }
            style={{
              width: 48,
              height: 48,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 24,
              borderWidth: 1,
              borderColor: palette.line,
              backgroundColor: palette.surface,
              shadowColor: '#1A1A1A',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 6,
              elevation: 3,
            }}>
            <Ionicons name="options-outline" size={22} color={palette.primary} />
            {activeFilters > 0 ? (
              <View style={{ position: 'absolute', top: -4, right: -4, minWidth: 20, height: 20, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: palette.primary }}>
                <Text style={{ color: 'white', fontSize: 11, fontWeight: 'bold' }}>{activeFilters}</Text>
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
          <ScrollView
            ref={quickFiltersRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mt-3 h-11"
            contentContainerStyle={{ gap: 8, alignItems: 'center', paddingRight: 4 }}
            onContentSizeChange={scrollToActiveQuickFilter}
          >
            {QUICK_FILTERS.map((item) => {
              const roomValue = item.value === 'all' ? null : item.value;
              const selected = roomValue == null
                ? filters.rooms.length === 0
                : filters.rooms.includes(roomValue);
              return (
                <Pressable
                  key={item.value}
                  onLayout={(event) => {
                    quickFilterOffsets.current[item.value] = event.nativeEvent.layout.x;
                    if (selected) scrollToActiveQuickFilter();
                  }}
                  accessibilityRole="tab"
                  accessibilityState={{ selected }}
                  onPress={() => {
                    if (roomValue == null) {
                      filters.setFilters({ rooms: [] });
                    } else {
                      filters.toggleRoom(roomValue);
                    }
                  }}
                  style={{ borderRadius: 18 }}
                  className={`h-9 items-center justify-center border px-4 active:opacity-80 ${
                    selected ? 'border-primary bg-primary' : 'border-line bg-surface-muted'
                  }`}
                >
                  <Text className={`text-sm font-semibold ${selected ? 'text-white' : 'text-ink-secondary'}`}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={{ marginTop: 10 }} className="flex-row items-center gap-2">
            {/* Dates Button */}
            <Pressable
              onPress={() => setDateModalVisible(true)}
              style={{ borderRadius: 16 }}
              className="flex-1 h-12 flex-row items-center justify-between border border-line bg-surface px-3 active:bg-surface-muted">
              <View className="flex-row items-center gap-2 flex-1 mr-1">
                <Ionicons name="calendar-outline" size={18} color={palette.primary} />
                <Text className="text-xs font-medium text-ink" numberOfLines={1}>{dateLabel}</Text>
              </View>
              <Ionicons name="chevron-down" size={16} color={palette.inkMuted} />
            </Pressable>

            {/* Guests Button */}
            <Pressable
              onPress={openGuestModal}
              style={{ borderRadius: 16 }}
              className="flex-1 h-12 flex-row items-center justify-between border border-line bg-surface px-3 active:bg-surface-muted">
              <View className="flex-row items-center gap-2 flex-1 mr-1">
                <Ionicons name="person-outline" size={18} color={palette.primary} />
                <Text className="text-xs font-medium text-ink" numberOfLines={1}>{formatGuests(filters.guests)}</Text>
              </View>
              <Ionicons name="chevron-down" size={16} color={palette.inkMuted} />
            </Pressable>

            {/* Favorites filter (replaces the old Избранное tab) */}
            <Pressable
              accessibilityLabel="Только избранное"
              accessibilityState={{ selected: filters.favoritesOnly }}
              onPress={filters.toggleFavoritesOnly}
              style={{ borderRadius: 16 }}
              className={`h-12 w-12 items-center justify-center border active:opacity-80 ${
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
      ) : similarPending ? (
        <FlatList
          data={[0, 1, 2]}
          keyExtractor={(i) => String(i)}
          contentContainerClassName="px-4"
          contentContainerStyle={{ paddingTop: listPaddingTop, paddingBottom: 112 }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View className="mb-3">
              <Text className="text-lg font-extrabold text-ink">Ищем похожие варианты</Text>
              <Text className="mt-1 text-sm leading-5 text-ink-secondary">
                Точных совпадений нет — подбираем объявления с близкими параметрами.
              </Text>
            </View>
          }
          renderItem={() => <ListingCardSkeleton />}
        />
      ) : feedItems.length === 0 ? (
        <View style={{ paddingTop: listPaddingTop }} className="flex-1 px-4">
          {renderListHeader()}
          <EmptyState
            icon="search-outline"
            title="Ничего не найдено"
            subtitle={hasSearchConstraints ? 'По точным и близким параметрам объявлений пока нет.' : 'Измените запрос или сбросьте фильтры.'}
          />
        </View>
      ) : (
        <FlatList
          data={feedItems}
          keyExtractor={(item) => String(item.id)}
          contentContainerClassName="px-4"
          contentContainerStyle={{ paddingTop: listPaddingTop, paddingBottom: 112 }}
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          ListHeaderComponent={
            showingSimilar ? (
              <View style={{ borderRadius: 18 }} className="mb-3 border border-line bg-surface-muted p-4">
                <View className="flex-row items-center">
                  <View className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-primary-light">
                    <Ionicons name="sparkles-outline" size={20} color={palette.primary} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-base font-extrabold text-ink">Похожие варианты</Text>
                    <Text className="mt-0.5 text-xs leading-5 text-ink-secondary">
                      Точных совпадений нет. Некоторые параметры в этих объявлениях отличаются.
                    </Text>
                  </View>
                </View>
              </View>
            ) : renderListHeader()
          }
          refreshControl={
            <RefreshControl
              refreshing={isRefetching || (showingSimilar && similarFetching)}
              progressViewOffset={listPaddingTop}
              colors={[palette.primary]}
              onRefresh={async () => {
                await refetch();
                if (showingSimilar) await refetchSimilar();
              }}
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
              isOwn={user?.id === item.owner_id}
              isViewed={user?.id !== item.owner_id && (viewedListingIds?.has(item.id) ?? false)}
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
      <DatePickerSheet
        visible={dateModalVisible}
        onClose={() => setDateModalVisible(false)}
        onApply={(checkIn, checkOut) => {
          filters.setFilters({ checkIn, checkOut });
        }}
        checkIn={filters.checkIn}
        checkOut={filters.checkOut}
      />

      {/* Guest Picker Bottom Sheet Modal */}
      <BottomSheet visible={guestModalVisible} onClose={closeGuestModal}>
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
            disabled={tempGuests >= 100}
            onPress={() => setTempGuests((g) => Math.min(100, g + 1))}
            className="h-12 w-12 items-center justify-center rounded-full border border-line active:bg-surface-muted disabled:opacity-40"
          >
            <Ionicons name="add" size={24} color={palette.ink} />
          </TouchableOpacity>
        </View>

        {/* Apply Button */}
        <Button label="Применить" onPress={handleApplyGuests} />
      </BottomSheet>

      {/* City / free-text Search Overlay Modal */}
      <SearchModal
        visible={searchModalVisible}
        onSelectCity={(city) => {
          // Exact city filter (backend matches h.country = city). Remembered.
          filters.setFilters({ city });
          setQuery('');
          void addRecentSearch(city).catch(() => undefined);
          setSearchModalVisible(false);
        }}
        onSubmitQuery={(text) => {
          // Free-text address/name search (backend q ILIKE). Not remembered.
          setQuery(text);
          filters.setFilters({ city: null });
          setSearchModalVisible(false);
        }}
        onClose={() => setSearchModalVisible(false)}
        initialValue={searchLabel}
      />
    </View>
  );
}

interface SearchModalProps {
  visible: boolean;
  onClose: () => void;
  /** A city was picked (suggestion/popular/recent) → exact city filter. */
  onSelectCity: (city: string) => void;
  /** Free text was submitted from the keyboard → fuzzy `q` search. */
  onSubmitQuery: (text: string) => void;
  initialValue: string;
}

const POPULAR_DESTINATIONS = [
  { name: 'Москва', desc: 'Столица России' },
  { name: 'Санкт-Петербург', desc: 'Культурная столица' },
  { name: 'Казань', desc: 'Третья столица' },
  { name: 'Сочи', desc: 'Курортный город' },
  { name: 'Краснодар', desc: 'Южный мегаполис' },
];

function SearchModal({ visible, onClose, onSelectCity, onSubmitQuery, initialValue }: SearchModalProps) {
  const { palette } = useAppTheme();
  const [searchVal, setSearchVal] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const insets = useSafeAreaInsets();
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
    if (visible) {
      setSearchVal(initialValue);
      setSuggestions([]);
      getRecentSearches().then(setRecent).catch(() => setRecent([]));
    } else {
      setSearchVal('');
      setSuggestions([]);
      setIsLoadingSuggestions(false);
    }
  }, [visible, initialValue]);

  // Debounced city suggestions (suggestCities = city-bounded, clean names).
  useEffect(() => {
    if (!visible) return;

    if (searchVal.trim().length === 0) {
      setSuggestions([]);
      setIsLoadingSuggestions(false);
      return;
    }

    setIsLoadingSuggestions(true);
    const controller = new AbortController();
    const delayDebounceFn = setTimeout(async () => {
      const results = await suggestCities(searchVal, controller.signal);
      if (!controller.signal.aborted) {
        setSuggestions(results);
        setIsLoadingSuggestions(false);
      }
    }, 300);

    return () => {
      controller.abort();
      clearTimeout(delayDebounceFn);
    };
  }, [searchVal, visible]);

  const handleClearRecent = () => {
    setRecent([]);
    void clearRecentSearches().catch(() => undefined);
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      statusBarTranslucent
      navigationBarTranslucent
      hardwareAccelerated
      onShow={focusSearchInput}
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
          <SearchOverlayHeader
            inputRef={searchInputRef}
            query={searchVal}
            onChangeText={setSearchVal}
            onClose={onClose}
            onSubmit={() => {
              if (searchVal.trim()) onSubmitQuery(searchVal.trim());
            }}
            placeholder="Город, адрес или название"
          />

          {/* Suggestions & Popular */}
          <ScrollView
            className="flex-1"
            contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 32 }}
            keyboardShouldPersistTaps="handled">
            {isLoadingSuggestions ? (
              <View className="py-8 items-center justify-center">
                <ActivityIndicator color={palette.primary} size="small" />
              </View>
            ) : searchVal.trim().length > 0 ? (
              <View>
                <Text className="text-xs font-bold text-ink-secondary tracking-wider mt-3 mb-3">ГОРОДА</Text>
                <View style={{ gap: 8 }}>
                  {suggestions.map((item) => (
                    <SearchResultItem key={item} icon="location-outline" title={item} onPress={() => onSelectCity(item)} />
                  ))}
                </View>
                {suggestions.length === 0 && (
                  <View className="py-8 items-center">
                    <Text className="text-sm text-ink-secondary">Город не найден. Нажмите «ввод», чтобы искать по адресу.</Text>
                  </View>
                )}
              </View>
            ) : (
              <View>
                {recent.length > 0 ? (
                  <>
                    <View className="flex-row items-center justify-between mt-3 mb-3">
                      <Text className="text-xs font-bold text-ink-secondary tracking-wider">НЕДАВНИЕ ЗАПРОСЫ</Text>
                      <Pressable onPress={handleClearRecent} className="active:opacity-60">
                        <Text className="text-xs font-semibold text-primary">Очистить</Text>
                      </Pressable>
                    </View>
                    <View style={{ gap: 8 }}>
                      {recent.map((item) => (
                        <SearchResultItem
                          key={item}
                          icon="time-outline"
                          title={item}
                          tone="neutral"
                          onPress={() => onSelectCity(item)}
                        />
                      ))}
                    </View>
                  </>
                ) : null}

                <Text className="text-xs font-bold text-ink-secondary tracking-wider mt-6 mb-3">ПОПУЛЯРНЫЕ НАПРАВЛЕНИЯ</Text>
                <View style={{ gap: 8 }}>
                  {POPULAR_DESTINATIONS.map((item) => (
                    <SearchResultItem
                      key={item.name}
                      icon="trending-up"
                      title={item.name}
                      subtitle={item.desc}
                      onPress={() => onSelectCity(item.name)}
                    />
                  ))}
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}


