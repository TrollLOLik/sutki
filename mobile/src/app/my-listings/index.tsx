import { addDays, format, parseISO } from 'date-fns';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, RefreshControl, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/EmptyState';
import { ListingCard } from '@/components/ListingCard';
import { PersonalListToolbar, type SortOption } from '@/components/PersonalListToolbar';
import { Button } from '@/components/ui';
import { useListingPublication, useMyListings } from '@/lib/api/create-listing';
import { useIncomingBookings } from '@/lib/api/bookings';
import { ApiError } from '@/lib/api/client';
import { useFavoriteIds } from '@/lib/api/favorites';
import { useAppTheme } from '@/theme/useAppTheme';
import { useActivityScopeSeen } from '@/hooks/useActivityScopeSeen';
import type { ListingCard as ListingCardType } from '@/types/listing';
import { NavigationBackButton } from '@/components/NavigationBackButton';
import {
  countActiveFilters,
  useMyListingFiltersStore,
  type ListingSort,
  type MyListingStatus,
  type RoomFilter,
} from '@/store/filters';

const SORT_OPTIONS: SortOption<ListingSort>[] = [
  { value: 'newest', label: 'Сначала новые', icon: 'arrow-down-outline' },
  { value: 'oldest', label: 'Сначала старые', icon: 'arrow-up-outline' },
  { value: 'popular', label: 'Сначала популярные', icon: 'eye-outline' },
];

function normalizedRooms(value: string): number {
  if (value === 'studio' || value === '0') return 0;
  if (value === '5+') return 5;
  return Number.parseInt(value, 10) || 0;
}

function matchesRoom(listing: ListingCardType, filters: RoomFilter[]): boolean {
  if (filters.length === 0) return true;
  const rooms = normalizedRooms(listing.rooms);
  return filters.some((filter) => filter === '5plus' ? rooms >= 5 : rooms === normalizedRooms(filter));
}

export default function MyListingsScreen() {
  useActivityScopeSeen('listings');
  const { palette } = useAppTheme();
  const { data, isLoading, isError, refetch, isRefetching } = useMyListings({ limit: 100 });
  const incoming = useIncomingBookings({ limit: 100 });
  const { data: favoriteIds } = useFavoriteIds();
  const [query, setQuery] = useState('');
  const [sortVisible, setSortVisible] = useState(false);
  const filters = useMyListingFiltersStore();
  const sort = filters.sort;
  const unavailableHouseIds = useMemo(() => {
    if (!filters.checkIn || !filters.checkOut) return new Set<number>();
    const ids = new Set<number>();
    for (const booking of incoming.data?.items ?? []) {
      if (booking.status !== 'confirmed') continue;
      const end = booking.end_date ?? format(addDays(parseISO(booking.start_date), 1), 'yyyy-MM-dd');
      if (booking.start_date < filters.checkOut && end > filters.checkIn) ids.add(booking.house_id);
    }
    return ids;
  }, [filters.checkIn, filters.checkOut, incoming.data?.items]);
  const items = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('ru');
    const { priceMin, priceMax, areaMin, areaMax } = filters;
    const result = (data?.items ?? []).filter((item) => {
      const searchable = `${item.address} ${item.city} ${item.description}`.toLocaleLowerCase('ru');
      return (!needle || searchable.includes(needle))
        && (filters.statuses.length === 0 || filters.statuses.includes((item.status ?? 'active') as MyListingStatus))
        && (filters.city == null || item.city === filters.city)
        && !unavailableHouseIds.has(item.id)
        && matchesRoom(item, filters.rooms)
        && (filters.categoryId == null || item.category_ids?.includes(filters.categoryId) === true)
        && (filters.serviceIds.length === 0 || filters.serviceIds.every((id) => item.service_ids?.includes(id) === true))
        && (priceMin == null || item.price >= priceMin)
        && (priceMax == null || item.price <= priceMax)
        && (areaMin == null || item.area >= areaMin)
        && (areaMax == null || item.area <= areaMax)
        && (item.max_guests == null || item.max_guests >= filters.guests)
        && (!filters.smokingAllowed || item.smoking_allowed === 'allowed' || item.smoking_allowed === 'on_balcony')
        && (!filters.petsAllowed || item.pets_allowed === 'allowed' || item.pets_allowed === 'on_request')
        && (!filters.childrenAllowed || item.children_allowed === 'allowed' || item.children_allowed === 'on_request')
        && (!filters.eventsAllowed || item.events_allowed === 'allowed' || item.events_allowed === 'on_request')
        && (!filters.favoritesOnly || favoriteIds?.has(item.id) === true);
    });
    return result.sort((a, b) => {
      if (sort === 'oldest') return Date.parse(a.created_at) - Date.parse(b.created_at) || a.id - b.id;
      if (sort === 'popular') return (b.views_30d ?? b.views) - (a.views_30d ?? a.views) || b.id - a.id;
      return Date.parse(b.created_at) - Date.parse(a.created_at) || b.id - a.id;
    });
  }, [data?.items, favoriteIds, filters, query, sort, unavailableHouseIds]);
  const filterCount = countActiveFilters(filters) + filters.statuses.length + Number(filters.favoritesOnly);
  const insets = useSafeAreaInsets();
  const publication = useListingPublication();

  const changePublication = (id: number, published: boolean) => {
    const title = published ? 'Опубликовать объявление снова?' : 'Снять объявление с публикации?';
    const message = published
      ? 'Объявление снова появится в поиске.'
      : 'Объявление исчезнет из поиска. Активное продвижение будет приостановлено.';
    Alert.alert(title, message, [
      { text: 'Отмена', style: 'cancel' },
      {
        text: published ? 'Опубликовать' : 'Снять',
        style: published ? 'default' : 'destructive',
        onPress: async () => {
          try {
            await publication.mutateAsync({ id, published });
          } catch (error) {
            Alert.alert('Не удалось изменить статус', error instanceof ApiError ? error.message : 'Попробуйте ещё раз.');
          }
        },
      },
    ]);
  };

  return (
    <View className="flex-1 bg-surface">
      <SafeAreaView edges={['top']} className="flex-1">
        <View className="flex-row items-center px-4 py-2">
          <NavigationBackButton
            fallback="/(tabs)/profile"
            className="h-10 w-10 items-center justify-center rounded-full bg-surface-muted"
          />
          <Text className="flex-1 text-center text-lg font-semibold text-ink">Мои объявления</Text>
          <View className="h-10 w-10" />
        </View>

        <PersonalListToolbar
          query={query}
          onQueryChange={setQuery}
          placeholder="Адрес, город или описание"
          sort={sort}
          sortOptions={SORT_OPTIONS}
          sortVisible={sortVisible}
          onSortVisibleChange={setSortVisible}
          onSortChange={(value) => filters.setFilters({ sort: value })}
          filterCount={filterCount}
          onFilterPress={() => router.push({ pathname: '/filters', params: { scope: 'mine' } })}
        />

        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={palette.primary} />
          </View>
        ) : isError ? (
          <View 
            style={{ paddingBottom: insets.bottom > 0 ? insets.bottom : 16 }}
            className="flex-1 justify-center gap-4 px-4"
          >
            <EmptyState
              icon="cloud-offline-outline"
              title="Не удалось загрузить"
              subtitle="Проверьте подключение и попробуйте снова."
            />
            <Button label="Повторить" variant="secondary" onPress={() => refetch()} />
          </View>
        ) : (data?.items.length ?? 0) === 0 ? (
          <View 
            style={{ paddingBottom: insets.bottom > 0 ? insets.bottom : 16 }}
            className="flex-1 justify-center gap-4 px-4"
          >
            <EmptyState
              icon="home-outline"
              title="Пока нет объявлений"
              subtitle="Разместите своё первое жильё — это займёт пару минут."
            />
            <Button label="Разместить объявление" onPress={() => router.push('/create')} />
          </View>
        ) : items.length === 0 ? (
          <EmptyState icon="search-outline" title="Ничего не найдено" subtitle="Измените запрос или сбросьте фильтры." />
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={{ padding: 16, gap: 12 }}
            refreshControl={
              <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={palette.primary} />
            }
            renderItem={({ item }) => (
              <ListingCard
                listing={item}
                showOwnerStats
                onPress={() =>
                  router.push({ pathname: '/listing/[id]', params: { id: String(item.id) } })
                }
                onPromote={item.status !== 'rejected' && item.status !== 'unpublished'
                  ? () => router.push({pathname:'/listing/[id]/promote' as any,params:{id:String(item.id)}})
                  : undefined}
                onUnpublish={item.status === 'active' ? () => changePublication(item.id, false) : undefined}
                onPublish={item.status === 'unpublished' ? () => changePublication(item.id, true) : undefined}
              />
            )}
          />
        )}
      </SafeAreaView>

    </View>
  );
}
