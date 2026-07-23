import { addDays, format, parseISO } from 'date-fns';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/EmptyState';
import { ListingCard } from '@/components/ListingCard';
import { ListingCardSkeleton } from '@/components/ListingCardSkeleton';
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
import { CollapsibleHeader, useCollapsibleHeader } from '@/components/CollapsibleHeader';
import {
  countActiveFilters,
  useMyListingFiltersStore,
  type ListingSort,
  type MyListingStatus,
  type RoomFilter,
} from '@/store/filters';
import { appAlert as Alert } from '@/components/AppAlert';
import { useListingLayoutStore } from '@/store/listing-layout';

const SORT_OPTIONS: SortOption<ListingSort>[] = [
  { value: 'newest', label: 'Сначала новые', icon: 'arrow-down-outline' },
  { value: 'oldest', label: 'Сначала старые', icon: 'arrow-up-outline' },
  { value: 'popular', label: 'Сначала популярные', icon: 'eye-outline' },
];

const QUICK_STATUSES: Array<{
  key: string;
  label: string;
  statuses: MyListingStatus[];
}> = [
  { key: 'all', label: 'Все', statuses: [] },
  { key: 'active', label: 'В поиске', statuses: ['active'] },
  { key: 'pending', label: 'На проверке', statuses: ['pending_moderation', 'moderation_review'] },
  { key: 'unpublished', label: 'Снятые', statuses: ['unpublished'] },
  { key: 'rejected', label: 'Отклонённые', statuses: ['rejected'] },
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
  const collapsibleHeader = useCollapsibleHeader();
  useActivityScopeSeen('listings');
  const { palette, isDark } = useAppTheme();
  const screenBackground = isDark ? '#0D0F12' : '#F4F5F7';
  const headerBackground = isDark ? '#14161B' : '#FFFFFF';
  const { data, isLoading, isError, refetch, isRefetching } = useMyListings({ limit: 100 });
  const incoming = useIncomingBookings({ limit: 100 });
  const { data: favoriteIds } = useFavoriteIds();
  const [query, setQuery] = useState('');
  const [sortVisible, setSortVisible] = useState(false);
  const layoutMode = useListingLayoutStore((state) => state.mine);
  const toggleLayoutMode = useListingLayoutStore((state) => state.toggleMode);
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
  const statusCounts = useMemo(() => {
    const counts: Record<MyListingStatus, number> = {
      active: 0,
      unpublished: 0,
      pending_moderation: 0,
      moderation_review: 0,
      rejected: 0,
    };
    for (const item of data?.items ?? []) {
      const status = (item.status ?? 'active') as MyListingStatus;
      if (status in counts) counts[status] += 1;
    }
    return counts;
  }, [data?.items]);

  const isQuickStatusSelected = (statuses: MyListingStatus[]) => {
    if (statuses.length === 0) return filters.statuses.length === 0;
    return statuses.length === filters.statuses.length
      && statuses.every((status) => filters.statuses.includes(status));
  };

  const selectQuickStatus = (statuses: MyListingStatus[]) => {
    filters.setFilters({ statuses: isQuickStatusSelected(statuses) ? [] : statuses });
  };

  const quickStatusCount = (statuses: MyListingStatus[]) => {
    if (statuses.length === 0) return data?.items.length ?? 0;
    return statuses.reduce((total, status) => total + statusCounts[status], 0);
  };

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
    <View style={{ flex: 1, backgroundColor: screenBackground }}>
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: headerBackground }}>
        <View
          style={{
            minHeight: 68,
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingVertical: 10,
            overflow: 'hidden',
          }}
        >
          <BlurView
            intensity={88}
            tint={isDark ? 'dark' : 'light'}
            style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
          />
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
              backgroundColor: isDark ? 'rgba(20,22,27,0.72)' : 'rgba(255,255,255,0.72)',
            }}
          />
          <NavigationBackButton
            fallback="/(tabs)/profile"
            size={48}
            variant="material"
          />
          <Text className="flex-1 text-center text-xl font-extrabold text-ink">Мои объявления</Text>
          <Pressable
            accessibilityLabel="Разместить объявление"
            onPress={() => router.push('/create')}
            className="h-12 w-12 items-center justify-center rounded-full border border-line bg-surface active:opacity-70"
          >
            <Ionicons name="add" size={24} color={palette.primary} />
          </Pressable>
        </View>

        <View style={{ flex: 1, paddingTop: 8, backgroundColor: screenBackground }}>
          <CollapsibleHeader controller={collapsibleHeader} style={{ top: 8, backgroundColor: screenBackground }}>
          <PersonalListToolbar
            query={query}
            onQueryChange={setQuery}
            placeholder="Адрес, город или описание"
            sort={sort}
            sortOptions={SORT_OPTIONS}
            sortVisible={sortVisible}
            onSortVisibleChange={setSortVisible}
            onSortChange={(value) => filters.setFilters({ sort: value })}
            showSort={false}
            filterCount={filterCount}
            onFilterPress={() => router.push({ pathname: '/filters', params: { scope: 'mine' } })}
            layoutMode={layoutMode}
            onLayoutToggle={() => toggleLayoutMode('mine')}
          />

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ height: 54, flexGrow: 0, flexShrink: 0 }}
            contentContainerStyle={{ alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingBottom: 12 }}
          >
            {QUICK_STATUSES.map((option) => {
              const selected = isQuickStatusSelected(option.statuses);
              return (
                <Pressable
                  key={option.key}
                  onPress={() => selectQuickStatus(option.statuses)}
                  className="active:opacity-80"
                  style={{
                    minHeight: 38,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 7,
                    borderRadius: 19,
                    borderWidth: 1,
                    borderColor: selected ? palette.primary : palette.line,
                    backgroundColor: selected ? palette.primaryLight : palette.surface,
                    paddingHorizontal: 13,
                  }}
                >
                  <Text style={{ color: selected ? palette.primary : palette.inkSecondary, fontSize: 13, fontWeight: '700' }}>
                    {option.label}
                  </Text>
                  <View
                    style={{
                      minWidth: 22,
                      height: 22,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 11,
                      backgroundColor: selected ? palette.primary : palette.surfaceMuted,
                      paddingHorizontal: 5,
                    }}
                  >
                    <Text style={{ color: selected ? '#FFFFFF' : palette.inkMuted, fontSize: 11, fontWeight: '800' }}>
                      {quickStatusCount(option.statuses)}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
          </CollapsibleHeader>

        {isLoading ? (
          <View
            className="flex-1 px-4 pt-1"
            style={layoutMode === 'grid' ? { flexDirection: 'row', gap: 12 } : undefined}
          >
            <View style={layoutMode === 'grid' ? { width: '48%' } : undefined}>
              <ListingCardSkeleton layout={layoutMode} />
            </View>
            <View style={layoutMode === 'grid' ? { width: '48%' } : undefined}>
              <ListingCardSkeleton layout={layoutMode} />
            </View>
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
            key={`my-listings-${layoutMode}`}
            data={items}
            numColumns={layoutMode === 'grid' ? 2 : 1}
            columnWrapperStyle={layoutMode === 'grid' ? { gap: 12 } : undefined}
            keyExtractor={(item) => String(item.id)}
            onScroll={collapsibleHeader.onScroll}
            onScrollBeginDrag={collapsibleHeader.onScrollBeginDrag}
            onScrollEndDrag={collapsibleHeader.onScrollEndDrag}
            scrollEventThrottle={16}
            contentContainerStyle={{ paddingHorizontal: 16, paddingTop: collapsibleHeader.height + 10, paddingBottom: Math.max(insets.bottom, 16) + 12 }}
            refreshControl={
              <RefreshControl
                refreshing={isRefetching}
                onRefresh={refetch}
                tintColor={palette.primary}
                colors={[palette.primary]}
                progressViewOffset={collapsibleHeader.height}
              />
            }
            renderItem={({ item }) => (
              <View style={layoutMode === 'grid' ? { width: '48%' } : undefined}>
                <ListingCard
                  listing={item}
                  layout={layoutMode}
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
              </View>
            )}
          />
        )}
        </View>
      </SafeAreaView>

    </View>
  );
}
