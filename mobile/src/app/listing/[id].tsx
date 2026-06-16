import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/EmptyState';
import { Badge, Button, Chip } from '@/components/ui';
import { useFavoriteIds, useToggleFavorite } from '@/lib/api/favorites';
import { useListing } from '@/lib/api/listings';
import { formatPricePerNight, formatRating, formatReviewsCount, formatRooms } from '@/lib/format';
import { palette } from '@/theme/tokens';

export default function ListingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const numericId = Number(id);
  const { width } = useWindowDimensions();
  const { data, isLoading, isError, refetch } = useListing(numericId);
  const { data: favoriteIds } = useFavoriteIds();
  const toggleFavorite = useToggleFavorite();
  const isFavorite = favoriteIds?.has(numericId) ?? false;

  return (
    <View className="flex-1 bg-surface">
      <SafeAreaView edges={['top', 'bottom']} className="flex-1">
        <View className="flex-row items-center justify-between px-4 py-2">
          <Pressable
            onPress={() => router.back()}
            accessibilityLabel="Назад"
            className="h-10 w-10 items-center justify-center rounded-full bg-surface-muted">
            <Ionicons name="chevron-back" size={22} color={palette.ink} />
          </Pressable>
          <Pressable
            onPress={() => toggleFavorite.mutate({ id: numericId, isFavorite })}
            disabled={numericId <= 0}
            accessibilityLabel={isFavorite ? 'Убрать из избранного' : 'В избранное'}
            className="h-10 w-10 items-center justify-center rounded-full bg-surface-muted active:opacity-80">
            <Ionicons
              name={isFavorite ? 'heart' : 'heart-outline'}
              size={20}
              color={isFavorite ? palette.primary : palette.ink}
            />
          </Pressable>
        </View>

        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={palette.primary} />
          </View>
        ) : isError || !data ? (
          <View className="flex-1 gap-4 px-4">
            <EmptyState
              icon="cloud-offline-outline"
              title="Не удалось загрузить объявление"
              subtitle="Проверьте подключение и попробуйте снова."
            />
            <View className="px-8">
              <Button label="Повторить" variant="secondary" onPress={() => refetch()} />
            </View>
          </View>
        ) : (
          <>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-6">
              <View style={{ height: 240 }} className="bg-surface-skeleton">
                {data.photos.length > 0 ? (
                  <FlatList
                    data={data.photos}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    keyExtractor={(p) => String(p.id)}
                    renderItem={({ item }) => (
                      <Image
                        source={{ uri: item.url }}
                        style={{ width, height: 240 }}
                        contentFit="cover"
                        transition={150}
                      />
                    )}
                  />
                ) : (
                  <View className="flex-1 items-center justify-center">
                    <Ionicons name="image-outline" size={48} color={palette.inkMuted} />
                  </View>
                )}
              </View>

              <View className="gap-3 px-4 pt-4">
                <Text className="text-xl font-bold text-ink">{data.address}</Text>
                <View className="flex-row flex-wrap items-center gap-x-2">
                  <Text className="text-base text-ink-secondary">{data.city}</Text>
                  <Text className="text-base text-ink-muted">· {formatRooms(data.rooms)}</Text>
                  {data.area > 0 ? (
                    <Text className="text-base text-ink-muted">· {data.area} м²</Text>
                  ) : null}
                </View>
                <Text className="text-2xl font-bold text-primary">
                  {formatPricePerNight(data.price)}
                </Text>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Открыть отзывы"
                  onPress={() => router.push({ pathname: '/reviews/[id]', params: { id } })}
                  className="flex-row items-center justify-between rounded-card border border-line bg-surface px-3 py-3 active:opacity-80">
                  <View className="flex-row items-center gap-2">
                    <Ionicons name="star" size={18} color={palette.star} />
                    {data.reviews_count > 0 ? (
                      <>
                        <Text className="text-base font-semibold text-ink">
                          {formatRating(data.rating)}
                        </Text>
                        <Text className="text-base text-ink-secondary">
                          · {formatReviewsCount(data.reviews_count)}
                        </Text>
                      </>
                    ) : (
                      <Text className="text-base text-ink-secondary">Пока нет отзывов</Text>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={palette.inkMuted} />
                </Pressable>

                {data.categories.length > 0 ? (
                  <View className="flex-row flex-wrap gap-2">
                    {data.categories.map((c) => (
                      <Badge key={c.id} label={c.name} tone="info" />
                    ))}
                  </View>
                ) : null}

                {data.description ? (
                  <View className="gap-1">
                    <Text className="text-base font-semibold text-ink">Описание</Text>
                    <Text className="text-base leading-6 text-ink-secondary">
                      {data.description}
                    </Text>
                  </View>
                ) : null}

                {data.services.length > 0 ? (
                  <View className="gap-2">
                    <Text className="text-base font-semibold text-ink">Удобства</Text>
                    <View className="flex-row flex-wrap gap-2">
                      {data.services.map((s) => (
                        <Chip key={s.id} label={s.name} />
                      ))}
                    </View>
                  </View>
                ) : null}

                <View className="gap-2">
                  <Text className="text-base font-semibold text-ink">На карте</Text>
                  <View className="h-40 items-center justify-center rounded-card bg-surface-muted">
                    <Ionicons name="map-outline" size={32} color={palette.inkMuted} />
                    <Text className="mt-1 text-sm text-ink-muted">
                      {data.lat != null && data.lng != null
                        ? `${data.lat.toFixed(4)}, ${data.lng.toFixed(4)}`
                        : 'Координаты появятся позже'}
                    </Text>
                  </View>
                </View>
              </View>
            </ScrollView>

            <View className="border-t border-line px-4 py-3">
              <Button
                label="Оставить заявку"
                onPress={() => router.push({ pathname: '/booking/[id]', params: { id } })}
              />
            </View>
          </>
        )}
      </SafeAreaView>
    </View>
  );
}
