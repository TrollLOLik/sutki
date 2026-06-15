import { router } from 'expo-router';
import { ActivityIndicator, FlatList, RefreshControl, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/EmptyState';
import { ListingCard } from '@/components/ListingCard';
import { Button } from '@/components/ui';
import { useFavoriteIds, useFavorites, useToggleFavorite } from '@/lib/api/favorites';
import { palette } from '@/theme/tokens';

export default function FavoritesScreen() {
  const { data, isLoading, isError, refetch, isRefetching } = useFavorites({ limit: 50 });
  const { data: favoriteIds } = useFavoriteIds();
  const toggleFavorite = useToggleFavorite();
  const items = data?.items ?? [];

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-surface">
      <View className="px-4 py-2">
        <Text className="text-lg font-semibold text-ink">Избранное</Text>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={palette.primary} />
        </View>
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
      ) : items.length === 0 ? (
        <EmptyState
          icon="heart-outline"
          title="В избранном пока пусто"
          subtitle="Сохраняйте понравившиеся квартиры, чтобы вернуться к ним позже."
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          contentContainerClassName="px-4 pb-6 pt-1"
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
              isFavorite={favoriteIds?.has(item.id) ?? true}
              onToggleFavorite={() =>
                toggleFavorite.mutate({ id: item.id, isFavorite: favoriteIds?.has(item.id) ?? true })
              }
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}
