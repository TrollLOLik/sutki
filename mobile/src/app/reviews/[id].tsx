import { Ionicons } from '@expo/vector-icons';
import { parseISO } from 'date-fns';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/EmptyState';
import { Stars } from '@/components/Stars';
import { Button } from '@/components/ui';
import { useReviews } from '@/lib/api/reviews';
import { formatDateRu, formatRating, formatReviewsCount } from '@/lib/format';
import { palette } from '@/theme/tokens';
import type { Review, ReviewSummary } from '@/types/review';

export default function ReviewsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const numericId = Number(id);
  const { data, isLoading, isError, refetch, isRefetching } = useReviews(numericId, { limit: 50 });

  const summary = data?.summary;
  const items = data?.items ?? [];

  return (
    <View className="flex-1 bg-surface">
      <SafeAreaView edges={['top']} className="flex-1">
        <View className="flex-row items-center gap-3 px-4 py-2">
          <Pressable
            onPress={() => router.back()}
            accessibilityLabel="Назад"
            className="h-10 w-10 items-center justify-center rounded-full bg-surface-muted">
            <Ionicons name="chevron-back" size={22} color={palette.ink} />
          </Pressable>
          <Text className="text-lg font-semibold text-ink">Отзывы</Text>
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
        ) : (
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
        )}
      </SafeAreaView>
    </View>
  );
}

function SummaryHeader({ summary }: { summary: ReviewSummary }) {
  const max = Math.max(1, ...Object.values(summary.distribution));
  return (
    <View className="gap-4 py-4">
      <View className="flex-row items-center gap-4">
        <View className="items-center">
          <Text className="text-4xl font-bold text-ink">{formatRating(summary.average)}</Text>
          <Stars value={summary.average} size={16} />
          <Text className="mt-1 text-sm text-ink-muted">{formatReviewsCount(summary.total)}</Text>
        </View>
        <View className="flex-1 gap-1.5">
          {[5, 4, 3, 2, 1].map((star) => {
            const count = summary.distribution[String(star)] ?? 0;
            return (
              <View key={star} className="flex-row items-center gap-2">
                <Text className="w-3 text-xs text-ink-secondary">{star}</Text>
                <Ionicons name="star" size={11} color={palette.star} />
                <View className="h-2 flex-1 overflow-hidden rounded-pill bg-surface-skeleton">
                  <View
                    className="h-full rounded-pill bg-star"
                    style={{ width: `${(count / max) * 100}%` }}
                  />
                </View>
                <Text className="w-6 text-right text-xs text-ink-muted">{count}</Text>
              </View>
            );
          })}
        </View>
      </View>
      <View className="h-px bg-line" />
    </View>
  );
}

function ReviewRow({ review }: { review: Review }) {
  const date = review.created_at ? parseISO(review.created_at) : null;
  return (
    <View className="border-b border-line py-4">
      <View className="flex-row items-center justify-between">
        <View className="flex-1 flex-row items-center gap-3">
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
            <Text className="text-base font-semibold text-ink">{review.author_name}</Text>
            {date ? <Text className="text-xs text-ink-muted">{formatDateRu(date)}</Text> : null}
          </View>
        </View>
        <Stars value={review.rating} size={14} />
      </View>
      {review.body ? (
        <Text className="mt-2 text-base leading-6 text-ink-secondary">{review.body}</Text>
      ) : null}
    </View>
  );
}
