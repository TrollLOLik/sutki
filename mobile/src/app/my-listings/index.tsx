import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/EmptyState';
import { ListingCard } from '@/components/ListingCard';
import { PersonalListToolbar, type SortOption } from '@/components/PersonalListToolbar';
import { BottomSheet, Button } from '@/components/ui';
import { useListingPublication, useMyListings } from '@/lib/api/create-listing';
import { ApiError } from '@/lib/api/client';
import { useFavoriteIds } from '@/lib/api/favorites';
import { useAppTheme } from '@/theme/useAppTheme';
import { useActivityScopeSeen } from '@/hooks/useActivityScopeSeen';
import type { ListingCard as ListingCardType } from '@/types/listing';
import { goBackOrReplace } from '@/lib/navigation';

type ListingSort = 'newest' | 'oldest' | 'popular' | 'price_asc' | 'price_desc';
type ListingStatus = 'active' | 'unpublished' | 'pending_moderation' | 'moderation_review' | 'rejected';

interface MineFilters {
  statuses: ListingStatus[];
  rooms: string[];
  priceMin: string;
  priceMax: string;
  areaMin: string;
  areaMax: string;
  guests: string;
  smokingAllowed: boolean;
  petsAllowed: boolean;
  childrenAllowed: boolean;
  eventsAllowed: boolean;
  favoritesOnly: boolean;
}

const EMPTY_FILTERS: MineFilters = {
  statuses: [], rooms: [], priceMin: '', priceMax: '', areaMin: '', areaMax: '', guests: '',
  smokingAllowed: false, petsAllowed: false, childrenAllowed: false, eventsAllowed: false, favoritesOnly: false,
};
const SORT_OPTIONS: SortOption<ListingSort>[] = [
  { value: 'newest', label: 'Сначала новые', icon: 'arrow-down-outline' },
  { value: 'oldest', label: 'Сначала старые', icon: 'arrow-up-outline' },
  { value: 'popular', label: 'Сначала популярные', icon: 'eye-outline' },
  { value: 'price_asc', label: 'Сначала дешевле', icon: 'trending-down-outline' },
  { value: 'price_desc', label: 'Сначала дороже', icon: 'trending-up-outline' },
];
const STATUS_OPTIONS: { value: ListingStatus; label: string }[] = [
  { value: 'active', label: 'Опубликовано' },
  { value: 'unpublished', label: 'Снято' },
  { value: 'pending_moderation', label: 'На проверке' },
  { value: 'moderation_review', label: 'Доп. проверка' },
  { value: 'rejected', label: 'Отклонено' },
];
const ROOM_OPTIONS = [
  { value: 'studio', label: 'Студия' }, { value: '1', label: '1' }, { value: '2', label: '2' },
  { value: '3', label: '3' }, { value: '4', label: '4' }, { value: '5plus', label: '5+' },
];

function numeric(value: string): number | null {
  const parsed = Number(value.replace(/\s/g, ''));
  return value.trim() && Number.isFinite(parsed) ? parsed : null;
}

function normalizedRooms(value: string): number {
  if (value === 'studio' || value === '0') return 0;
  if (value === '5+') return 5;
  return Number.parseInt(value, 10) || 0;
}

function matchesRoom(listing: ListingCardType, filters: string[]): boolean {
  if (filters.length === 0) return true;
  const rooms = normalizedRooms(listing.rooms);
  return filters.some((filter) => filter === '5plus' ? rooms >= 5 : rooms === normalizedRooms(filter));
}

export default function MyListingsScreen() {
  useActivityScopeSeen('listings');
  const { palette } = useAppTheme();
  const { data, isLoading, isError, refetch, isRefetching } = useMyListings({ limit: 100 });
  const { data: favoriteIds } = useFavoriteIds();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<ListingSort>('newest');
  const [sortVisible, setSortVisible] = useState(false);
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [filters, setFilters] = useState<MineFilters>(EMPTY_FILTERS);
  const items = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('ru');
    const priceMin = numeric(filters.priceMin);
    const priceMax = numeric(filters.priceMax);
    const areaMin = numeric(filters.areaMin);
    const areaMax = numeric(filters.areaMax);
    const guests = numeric(filters.guests);
    const result = (data?.items ?? []).filter((item) => {
      const searchable = `${item.address} ${item.city} ${item.description}`.toLocaleLowerCase('ru');
      return (!needle || searchable.includes(needle))
        && (filters.statuses.length === 0 || filters.statuses.includes((item.status ?? 'active') as ListingStatus))
        && matchesRoom(item, filters.rooms)
        && (priceMin == null || item.price >= priceMin)
        && (priceMax == null || item.price <= priceMax)
        && (areaMin == null || item.area >= areaMin)
        && (areaMax == null || item.area <= areaMax)
        && (guests == null || item.max_guests == null || item.max_guests >= guests)
        && (!filters.smokingAllowed || item.smoking_allowed === 'allowed' || item.smoking_allowed === 'on_balcony')
        && (!filters.petsAllowed || item.pets_allowed === 'allowed' || item.pets_allowed === 'on_request')
        && (!filters.childrenAllowed || item.children_allowed === 'allowed' || item.children_allowed === 'on_request')
        && (!filters.eventsAllowed || item.events_allowed === 'allowed' || item.events_allowed === 'on_request')
        && (!filters.favoritesOnly || favoriteIds?.has(item.id) === true);
    });
    return result.sort((a, b) => {
      if (sort === 'oldest') return Date.parse(a.created_at) - Date.parse(b.created_at) || a.id - b.id;
      if (sort === 'popular') return (b.views_30d ?? b.views) - (a.views_30d ?? a.views) || b.id - a.id;
      if (sort === 'price_asc') return a.price - b.price || b.id - a.id;
      if (sort === 'price_desc') return b.price - a.price || b.id - a.id;
      return Date.parse(b.created_at) - Date.parse(a.created_at) || b.id - a.id;
    });
  }, [data?.items, favoriteIds, filters, query, sort]);
  const filterCount = filters.statuses.length + filters.rooms.length
    + (filters.priceMin || filters.priceMax ? 1 : 0) + (filters.areaMin || filters.areaMax ? 1 : 0) + (filters.guests ? 1 : 0)
    + Number(filters.smokingAllowed) + Number(filters.petsAllowed) + Number(filters.childrenAllowed) + Number(filters.eventsAllowed)
    + Number(filters.favoritesOnly);
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
          <Pressable
            onPress={() => goBackOrReplace('/(tabs)/profile')}
            accessibilityLabel="Назад"
            className="h-10 w-10 items-center justify-center rounded-full bg-surface-muted">
            <Ionicons name="chevron-back" size={22} color={palette.ink} />
          </Pressable>
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
          onSortChange={setSort}
          filterCount={filterCount}
          onFilterPress={() => setFiltersVisible(true)}
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

      <BottomSheet visible={filtersVisible} onClose={() => setFiltersVisible(false)} height="86%">
        <View className="flex-1">
          <View className="mb-4 flex-row items-center justify-between">
            <Text className="text-lg font-bold text-ink">Фильтры объявлений</Text>
            {filterCount > 0 ? (
              <Pressable onPress={() => setFilters(EMPTY_FILTERS)}><Text className="text-sm font-bold text-primary">Сбросить</Text></Pressable>
            ) : null}
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 20, paddingBottom: 24 }}>
            <Pressable
              onPress={() => setFilters((current) => ({ ...current, favoritesOnly: !current.favoritesOnly }))}
              className={`h-12 flex-row items-center rounded-pill border px-4 ${filters.favoritesOnly ? 'border-primary bg-primary-light' : 'border-line bg-surface'}`}>
              <Ionicons name={filters.favoritesOnly ? 'heart' : 'heart-outline'} size={21} color={palette.primary} />
              <Text className={`ml-3 flex-1 text-base font-bold ${filters.favoritesOnly ? 'text-primary' : 'text-ink'}`}>Только избранные</Text>
              <Ionicons name={filters.favoritesOnly ? 'checkmark-circle' : 'ellipse-outline'} size={21} color={filters.favoritesOnly ? palette.primary : palette.inkMuted} />
            </Pressable>
            <FilterSection title="Статус">
              <View className="flex-row flex-wrap gap-2">
                {STATUS_OPTIONS.map((option) => <FilterChip key={option.value} label={option.label} selected={filters.statuses.includes(option.value)} onPress={() => setFilters((current) => ({ ...current, statuses: toggle(current.statuses, option.value) }))} />)}
              </View>
            </FilterSection>
            <FilterSection title="Количество комнат">
              <View className="flex-row flex-wrap gap-2">
                {ROOM_OPTIONS.map((option) => <FilterChip key={option.value} label={option.label} selected={filters.rooms.includes(option.value)} onPress={() => setFilters((current) => ({ ...current, rooms: toggle(current.rooms, option.value) }))} />)}
              </View>
            </FilterSection>
            <RangeInputs title="Цена за ночь" left={filters.priceMin} right={filters.priceMax} onLeft={(value) => setFilters((current) => ({ ...current, priceMin: value }))} onRight={(value) => setFilters((current) => ({ ...current, priceMax: value }))} />
            <RangeInputs title="Площадь, м²" left={filters.areaMin} right={filters.areaMax} onLeft={(value) => setFilters((current) => ({ ...current, areaMin: value }))} onRight={(value) => setFilters((current) => ({ ...current, areaMax: value }))} />
            <FilterSection title="Минимум гостей">
              <TextInput value={filters.guests} onChangeText={(value) => setFilters((current) => ({ ...current, guests: value.replace(/\D/g, '') }))} keyboardType="number-pad" placeholder="Например, 2" placeholderTextColor={palette.inkMuted} className="h-12 rounded-field border border-line bg-surface px-4 text-base text-ink" />
            </FilterSection>
            <FilterSection title="Правила проживания">
              <View className="flex-row flex-wrap gap-2">
                <FilterChip label="Можно курить" selected={filters.smokingAllowed} onPress={() => setFilters((current) => ({ ...current, smokingAllowed: !current.smokingAllowed }))} />
                <FilterChip label="Можно с животными" selected={filters.petsAllowed} onPress={() => setFilters((current) => ({ ...current, petsAllowed: !current.petsAllowed }))} />
                <FilterChip label="Можно с детьми" selected={filters.childrenAllowed} onPress={() => setFilters((current) => ({ ...current, childrenAllowed: !current.childrenAllowed }))} />
                <FilterChip label="Можно мероприятия" selected={filters.eventsAllowed} onPress={() => setFilters((current) => ({ ...current, eventsAllowed: !current.eventsAllowed }))} />
              </View>
            </FilterSection>
          </ScrollView>
          <Button label={`Показать ${items.length}`} onPress={() => setFiltersVisible(false)} />
        </View>
      </BottomSheet>
    </View>
  );
}

function toggle<T>(items: T[], value: T): T[] { return items.includes(value) ? items.filter((item) => item !== value) : [...items, value]; }

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <View className="gap-3"><Text className="text-base font-bold text-ink">{title}</Text>{children}</View>;
}

function FilterChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} className={`h-10 items-center justify-center rounded-pill border px-4 ${selected ? 'border-primary bg-primary-light' : 'border-line bg-surface'}`}><Text className={`text-sm font-semibold ${selected ? 'text-primary' : 'text-ink'}`}>{label}</Text></Pressable>;
}

function RangeInputs({ title, left, right, onLeft, onRight }: { title: string; left: string; right: string; onLeft: (value: string) => void; onRight: (value: string) => void }) {
  const { palette } = useAppTheme();
  return <FilterSection title={title}><View className="flex-row gap-2"><TextInput value={left} onChangeText={(value) => onLeft(value.replace(/\D/g, ''))} keyboardType="number-pad" placeholder="От" placeholderTextColor={palette.inkMuted} className="h-12 flex-1 rounded-field border border-line bg-surface px-4 text-base text-ink" /><TextInput value={right} onChangeText={(value) => onRight(value.replace(/\D/g, ''))} keyboardType="number-pad" placeholder="До" placeholderTextColor={palette.inkMuted} className="h-12 flex-1 rounded-field border border-line bg-surface px-4 text-base text-ink" /></View></FilterSection>;
}
