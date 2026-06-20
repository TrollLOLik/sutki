import { Ionicons } from '@expo/vector-icons';
import { parseISO } from 'date-fns';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useMemo } from 'react';
import { EmptyState } from '@/components/EmptyState';
import { Stars } from '@/components/Stars';
import { Button } from '@/components/ui';
import { useMyListings } from '@/lib/api/create-listing';
import { useReviews } from '@/lib/api/reviews';
import { formatDateRu, formatRating, formatReviewsCount } from '@/lib/format';
import { useSessionStore } from '@/store/session';
import { palette } from '@/theme/tokens';
import type { Review, ReviewSummary } from '@/types/review';

export default function ReviewsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const numericId = Number(id);
  const { data, isLoading, isError, refetch, isRefetching } = useReviews(numericId, { limit: 50 });

  const { status: authStatus } = useSessionStore();
  const isAuthenticated = authStatus === 'authenticated';
  const { data: myListingsData } = useMyListings({ limit: 100 }, { enabled: isAuthenticated });

  const isOwnListing = useMemo(() => {
    if (!myListingsData || !numericId) return false;
    return myListingsData.items.some((item) => item.id === numericId);
  }, [myListingsData, numericId]);

  const summary = data?.summary;
  const items = data?.items ?? [];

  return (
    <View className="flex-1 bg-surface">
      <SafeAreaView edges={['top', 'bottom']} className="flex-1">
        {/* Header with centered title */}
        <View className="flex-row items-center justify-between px-4 py-2 relative h-14 bg-surface border-b border-line">
          <Pressable
            onPress={() => router.back()}
            accessibilityLabel="Назад"
            className="h-10 w-10 items-center justify-center rounded-full bg-surface-muted z-10">
            <Ionicons name="chevron-back" size={22} color={palette.ink} />
          </Pressable>
          <View className="absolute left-0 right-0 top-0 bottom-0 items-center justify-center">
            <Text className="text-lg font-semibold text-ink">Отзывы</Text>
          </View>
          <View className="w-10 h-10" />
        </View>

        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={palette.primary} />
          </View>
        ) : isError ? (
          <View className="flex-1 gap-4 px-4 justify-center">
            <EmptyState
              icon="cloud-offline-outline"
              title="Не удалось загрузить"
              subtitle="Проверьте подключение и попробуйте снова."
            />
            <View className="px-8">
              <Button label="Повторить" variant="secondary" onPress={() => refetch()} />
            </View>
          </View>
        ) : (
          <>
            <FlatList
              data={items}
              keyExtractor={(item) => String(item.id)}
              contentContainerClassName="px-4 pb-6"
              showsVerticalScrollIndicator={false}
              onRefresh={() => refetch()}
              refreshing={isRefetching}
              ListHeaderComponent={summary ? <SummaryHeader summary={summary} /> : null}
              ListEmptyComponent={
                <EmptyState
                  icon="chatbubble-ellipses-outline"
                  title="Отзывов пока нет"
                  subtitle="Будьте первым, кто оставит отзыв об этом объекте."
                />
              }
              renderItem={({ item }) => <ReviewRow review={item} />}
            />

            <View className="border-t border-line px-4 py-3 bg-surface">
              {isOwnListing ? (
                <Button
                  label="Редактировать"
                  onPress={() => router.push({ pathname: '/create', params: { editId: id } } as any)}
                />
              ) : (
                <Button
                  label="Оставить заявку"
                  onPress={() => router.push({ pathname: '/booking/[id]', params: { id } })}
                />
              )}
            </View>
          </>
        )}
      </SafeAreaView>
    </View>
  );
}

function SummaryHeader({ summary }: { summary: ReviewSummary }) {
  const max = Math.max(1, ...Object.values(summary.distribution));
  return (
    <View className="flex-row gap-3 py-4">
      {/* Left Card: Average Rating */}
      <View className="w-[38%] rounded-2xl border border-line bg-surface p-4 items-center justify-center">
        <Text className="text-4xl font-extrabold text-ink leading-tight">{formatRating(summary.average)}</Text>
        <View className="my-1.5">
          <Stars value={summary.average} size={14} />
        </View>
        <Text className="text-xs text-ink-muted text-center leading-none">
          {formatReviewsCount(summary.total)}
        </Text>
      </View>

      {/* Right Card: Distribution */}
      <View className="flex-1 rounded-2xl border border-line bg-surface p-4 justify-between">
        {[5, 4, 3, 2, 1].map((star) => {
          const count = summary.distribution[String(star)] ?? 0;
          return (
            <View key={star} className="flex-row items-center gap-2 h-4">
              <Text className="w-2 text-[11px] font-semibold text-ink-secondary">{star}</Text>
              <Ionicons name="star" size={9} color={palette.inkMuted} />
              <View className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-skeleton">
                <View
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${(count / max) * 100}%` }}
                />
              </View>
              <Text className="w-6 text-right text-[11px] font-medium text-ink-muted">{count}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function ReviewRow({ review }: { review: Review }) {
  const date = review.created_at ? parseISO(review.created_at) : null;
  return (
    <View className="mb-3 rounded-2xl border border-line bg-surface p-4">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-3">
          <View className="h-10 w-10 overflow-hidden rounded-full bg-surface-skeleton">
            {review.author_avatar_url ? (
              <Image source={{ uri: review.author_avatar_url }} style={{ flex: 1 }} contentFit="cover" />
            ) : (
              <View className="flex-1 items-center justify-center">
                <Ionicons name="person" size={18} color={palette.inkMuted} />
              </View>
            )}
          </View>
          <View>
            <Text className="text-sm font-semibold text-ink">{review.author_name}</Text>
            {date ? <Text className="text-xs text-ink-muted mt-0.5">{formatDateRu(date)}</Text> : null}
          </View>
        </View>
        <View className="flex-row items-center gap-1">
          <Ionicons name="star" size={14} color={palette.primary} />
          <Text className="text-sm font-bold text-ink">{formatRating(review.rating)}</Text>
        </View>
      </View>
      {review.body ? (
        <Text className="mt-3 text-[14px] leading-5 text-ink-secondary">{review.body}</Text>
      ) : null}
    </View>
  );
}
