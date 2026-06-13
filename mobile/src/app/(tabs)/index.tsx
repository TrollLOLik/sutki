import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/EmptyState';
import { ListingCard } from '@/components/ListingCard';
import { ListingCardSkeleton } from '@/components/ListingCardSkeleton';
import { Button, Chip } from '@/components/ui';
import { useListings } from '@/lib/api/listings';
import { filterListings } from '@/lib/listing-filters';
import { useFiltersStore, type RoomFilter } from '@/store/filters';
import { palette } from '@/theme/tokens';

const QUICK_ROOMS: { label: string; value: RoomFilter }[] = [
  { label: 'Студия', value: 'studio' },
  { label: '1-комн.', value: '1' },
  { label: '2-комн.', value: '2' },
  { label: '3-комн.+', value: '3plus' },
];

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const filters = useFiltersStore();
  const { data, isLoading, isError, refetch, isRefetching } = useListings({ limit: 50 });

  const visible = useMemo(
    () => filterListings(data?.items ?? [], filters, query),
    [data?.items, filters, query],
  );

  const headerCity = data?.items[0]?.city ?? 'Магнитогорск';
  const activeFilters =
    filters.rooms.length +
    filters.amenities.length +
    (filters.priceMin != null || filters.priceMax != null ? 1 : 0);

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-surface">
      <View className="gap-3 px-4 pb-3">
        <View className="flex-row items-center justify-between">
          <Pressable className="flex-row items-center gap-1">
            <Ionicons name="location-outline" size={18} color={palette.primary} />
            <Text className="text-base font-semibold text-ink">{headerCity}</Text>
            <Ionicons name="chevron-down" size={16} color={palette.inkSecondary} />
          </Pressable>
        </View>

        <View className="flex-row items-center gap-2">
          <View className="h-12 flex-1 flex-row items-center rounded-field border border-line bg-surface px-3">
            <Ionicons name="search" size={20} color={palette.inkMuted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Поиск по адресу или названию"
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
            className="h-12 w-12 items-center justify-center rounded-field bg-primary active:bg-primary-pressed">
            <Ionicons name="options-outline" size={22} color={palette.surface} />
            {activeFilters > 0 ? (
              <View className="absolute -right-1 -top-1 h-5 min-w-5 items-center justify-center rounded-pill bg-ink px-1">
                <Text className="text-xs font-bold text-white">{activeFilters}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>

        <FlatList
          data={QUICK_ROOMS}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.value}
          contentContainerClassName="gap-2"
          renderItem={({ item }) => (
            <Chip
              label={item.label}
              selected={filters.rooms.includes(item.value)}
              onPress={() => filters.toggleRoom(item.value)}
            />
          )}
        />
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
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}
