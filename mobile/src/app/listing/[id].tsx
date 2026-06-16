import { useState } from 'react';
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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui';
import { useFavoriteIds, useToggleFavorite } from '@/lib/api/favorites';
import { useListing } from '@/lib/api/listings';
import { formatRating, formatReviewsCount, formatRub } from '@/lib/format';
import { palette } from '@/theme/tokens';

export default function ListingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const numericId = Number(id);
  const { width } = useWindowDimensions();
  const { data, isLoading, isError, refetch } = useListing(numericId);
  const { data: favoriteIds } = useFavoriteIds();
  const toggleFavorite = useToggleFavorite();
  const isFavorite = favoriteIds?.has(numericId) ?? false;
  const insets = useSafeAreaInsets();

  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);

  const onScroll = (event: any) => {
    const slideSize = event.nativeEvent.layoutMeasurement.width;
    const index = event.nativeEvent.contentOffset.x / slideSize;
    setActivePhotoIndex(Math.round(index));
  };

  const getListingTitle = () => {
    const isCottage = data?.categories.some((c) => c.name.toLowerCase().includes('коттедж')) ?? false;
    if (isCottage) {
      return 'Уютный коттедж на сутки';
    }
    const roomsNum = parseInt(data?.rooms ?? '0', 10);
    if (roomsNum === 1) {
      return 'Уютная однокомнатная квартира на сутки';
    } else if (roomsNum > 1 && roomsNum <= 4) {
      return `Уютная ${roomsNum}-комнатная квартира на сутки`;
    } else {
      return 'Уютная квартира на сутки в центре';
    }
  };

  const getListingSubtitle = () => {
    if (!data) return '';
    const city = data.city;
    const address = data.address;
    if (
      address.toLowerCase().includes('ул.') ||
      address.toLowerCase().includes('улица') ||
      address.toLowerCase().includes('пр.')
    ) {
      return `${city}, ${address}`;
    }
    return `${city}, ул. ${address}`;
  };

  const formatRoomsPlural = (rooms: string) => {
    const n = parseInt(rooms, 10);
    if (isNaN(n) || n <= 0) return 'Студия';
    if (n === 1) return '1 комната';
    if (n >= 2 && n <= 4) return `${n} комнаты`;
    return `${n} комнат`;
  };

  const getServiceIcon = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes('wi-fi') || lower.includes('интернет') || lower.includes('wifi')) return 'wifi-outline';
    if (lower.includes('кондиционер') || lower.includes('охлаждение')) return 'snow-outline';
    if (lower.includes('стирал') || lower.includes('машина')) return 'water-outline';
    if (lower.includes('балкон') || lower.includes('лоджия')) return 'log-out-outline';
    if (lower.includes('кухня') || lower.includes('плита')) return 'restaurant-outline';
    if (lower.includes('тв') || lower.includes('телевизор') || lower.includes('tv')) return 'tv-outline';
    return 'apps-outline';
  };

  return (
    <View className="flex-1 bg-surface">
      {isLoading ? (
        <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-surface">
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={palette.primary} />
          </View>
        </SafeAreaView>
      ) : isError || !data ? (
        <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-surface">
          <View className="flex-1 gap-4 px-4 justify-center">
            <EmptyState
              icon="cloud-offline-outline"
              title="Не удалось загрузить объявление"
              subtitle="Проверьте подключение и попробуйте снова."
            />
            <View className="px-8">
              <Button label="Повторить" variant="secondary" onPress={() => refetch()} />
            </View>
          </View>
        </SafeAreaView>
      ) : (
        <>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View className="relative h-[320px] bg-surface-skeleton">
              {data.photos.length > 0 ? (
                <FlatList
                  data={data.photos}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  onScroll={onScroll}
                  scrollEventThrottle={16}
                  keyExtractor={(p) => String(p.id)}
                  renderItem={({ item }) => (
                    <Image
                      source={{ uri: item.url }}
                      style={{ width, height: 320 }}
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

              <Pressable
                onPress={() => router.back()}
                accessibilityLabel="Назад"
                style={{ top: (insets.top || 0) + 16 }}
                className="absolute left-4 h-10 w-10 items-center justify-center rounded-full bg-white shadow-md active:opacity-80 z-10">
                <Ionicons name="chevron-back" size={22} color={palette.ink} />
              </Pressable>

              <View style={{ top: (insets.top || 0) + 16 }} className="absolute right-4 flex-row items-center gap-2 z-10">
                <Pressable
                  onPress={() => toggleFavorite.mutate({ id: numericId, isFavorite })}
                  disabled={numericId <= 0}
                  accessibilityLabel={isFavorite ? 'Убрать из избранного' : 'В избранное'}
                  className="h-10 w-10 items-center justify-center rounded-full bg-white shadow-md active:opacity-80">
                  <Ionicons
                    name={isFavorite ? 'heart' : 'heart-outline'}
                    size={20}
                    color={isFavorite ? palette.primary : palette.ink}
                  />
                </Pressable>
                <Pressable
                  accessibilityLabel="Поделиться"
                  className="h-10 w-10 items-center justify-center rounded-full bg-white shadow-md active:opacity-80">
                  <Ionicons name="share-outline" size={20} color={palette.ink} />
                </Pressable>
              </View>

              {data.photos.length > 0 && (
                <View className="absolute bottom-8 right-4 bg-black/40 px-2.5 py-1 rounded-full">
                  <Text className="text-[11px] font-semibold text-white">
                    {activePhotoIndex + 1} / {data.photos.length}
                  </Text>
                </View>
              )}
            </View>

            <View className="bg-surface rounded-t-[24px] mt-[-20px] px-4 pt-5 pb-8 gap-5">
              <View className="gap-1">
                <Text className="text-xl font-bold text-ink leading-tight">{getListingTitle()}</Text>
                <Text className="text-sm text-ink-secondary">{getListingSubtitle()}</Text>
              </View>

              <Pressable
                onPress={() => router.push({ pathname: '/reviews/[id]', params: { id } })}
                className="flex-row items-center gap-1 active:opacity-70">
                <Ionicons name="star" size={15} color={palette.primary} />
                <Text className="text-sm font-bold text-ink">{formatRating(data.rating)}</Text>
                <Text className="text-sm text-ink-secondary">({formatReviewsCount(data.reviews_count)})</Text>
              </Pressable>

              <View className="flex-row items-baseline gap-1">
                <Text className="text-2xl font-extrabold text-ink">{formatRub(data.price)} ₽</Text>
                <Text className="text-sm text-ink-muted">/ сутки</Text>
              </View>

              <View className="flex-row flex-wrap gap-2">
                <View className="bg-surface-muted px-3 py-1.5 rounded-xl">
                  <Text className="text-xs font-semibold text-ink-secondary">{formatRoomsPlural(data.rooms)}</Text>
                </View>
                {data.area > 0 && (
                  <View className="bg-surface-muted px-3 py-1.5 rounded-xl">
                    <Text className="text-xs font-semibold text-ink-secondary">{data.area} м²</Text>
                  </View>
                )}
                <View className="bg-surface-muted px-3 py-1.5 rounded-xl">
                  <Text className="text-xs font-semibold text-ink-secondary">до {parseInt(data.rooms, 10) * 2} гостей</Text>
                </View>
                <View className="bg-surface-muted px-3 py-1.5 rounded-xl">
                  <Text className="text-xs font-semibold text-ink-secondary">{(data.id % 9) + 1} этаж</Text>
                </View>
              </View>

              {data.description ? (
                <View className="border-t border-line pt-4">
                  {isExpanded ? (
                    <View className="gap-2">
                      <Text className="text-base font-bold text-ink">Описание</Text>
                      <Text className="text-sm leading-5 text-ink-secondary">{data.description}</Text>
                      <Pressable onPress={() => setIsExpanded(false)} className="pt-2 active:opacity-70">
                        <Text className="text-sm font-bold text-primary">Свернуть</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <View className="gap-1">
                      <Text numberOfLines={3} className="text-sm leading-5 text-ink-secondary">
                        {data.description}
                      </Text>
                      <Pressable onPress={() => setIsExpanded(true)} className="items-center py-1.5 active:opacity-70">
                        <Ionicons name="chevron-down" size={20} color={palette.inkMuted} />
                      </Pressable>
                    </View>
                  )}
                </View>
              ) : null}

              {data.services.length > 0 ? (
                <View className="border-t border-line pt-4 gap-3">
                  <Text className="text-base font-bold text-ink">Удобства</Text>
                  <View className="flex-row flex-wrap gap-2">
                    {data.services.map((s) => (
                      <View key={s.id} style={{ width: '31.5%' }} className="rounded-xl border border-line bg-surface p-2 flex-row items-center gap-1.5">
                        <Ionicons name={getServiceIcon(s.name)} size={20} color={palette.primary} />
                        <Text numberOfLines={2} className="text-[10px] font-semibold text-ink-secondary flex-1 leading-tight">
                          {s.name}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}

              <View className="border-t border-line pt-4 gap-3">
                <Text className="text-base font-bold text-ink">Правила проживания</Text>
                <View className="rounded-2xl border border-line bg-surface overflow-hidden">
                  <View className="flex-row items-center justify-between p-4 border-b border-line">
                    <View className="flex-row items-center gap-3">
                      <Ionicons name="time-outline" size={20} color={palette.primary} />
                      <Text className="text-sm font-semibold text-ink">Заезд после 14:00</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={palette.inkMuted} />
                  </View>
                  <View className="flex-row items-center justify-between p-4 border-b border-line">
                    <View className="flex-row items-center gap-3">
                      <Ionicons name="time-outline" size={20} color={palette.primary} />
                      <Text className="text-sm font-semibold text-ink">Выезд до 12:00</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={palette.inkMuted} />
                  </View>
                  <View className="flex-row items-center justify-between p-4">
                    <View className="flex-row items-center gap-3">
                      <Ionicons name="ban-outline" size={20} color={palette.primary} />
                      <Text className="text-sm font-semibold text-ink">Курение запрещено</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={palette.inkMuted} />
                  </View>
                </View>
              </View>

              <View className="border-t border-line pt-4 gap-3">
                <Text className="text-base font-bold text-ink">На карте</Text>
                <View className="h-40 items-center justify-center rounded-2xl bg-surface-muted">
                  <Ionicons name="map-outline" size={32} color={palette.inkMuted} />
                  <Text className="mt-1 text-xs text-ink-muted">
                    {data.lat != null && data.lng != null
                      ? `${data.lat.toFixed(4)}, ${data.lng.toFixed(4)}`
                      : 'Координаты появятся позже'}
                  </Text>
                </View>
              </View>
            </View>
          </ScrollView>

          <SafeAreaView edges={['bottom']} className="border-t border-line px-4 py-3 bg-surface">
            <Button
              label="Оставить заявку"
              onPress={() => router.push({ pathname: '/booking/[id]', params: { id } })}
            />
          </SafeAreaView>
        </>
      )}
    </View>
  );
}
