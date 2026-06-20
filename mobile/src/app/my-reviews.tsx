import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui';
import { useMyWrittenReviews, useMyReceivedReviews } from '@/lib/api/reviews';
import { cn } from '@/lib/cn';
import { palette } from '@/theme/tokens';
import type { UserReview } from '@/types/review';

type ReviewTab = 'written' | 'received';

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const months = [
      'января',
      'февраля',
      'марта',
      'апреля',
      'мая',
      'июня',
      'июля',
      'августа',
      'сентября',
      'октября',
      'ноября',
      'декабря',
    ];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  } catch {
    return dateStr;
  }
}

export default function MyReviewsScreen() {
  const [tab, setTab] = useState<ReviewTab>('written');

  const writtenQuery = useMyWrittenReviews({}, tab === 'written');
  const receivedQuery = useMyReceivedReviews({}, tab === 'received');

  const isLoading = tab === 'written' ? writtenQuery.isLoading : receivedQuery.isLoading;
  const isError = tab === 'written' ? writtenQuery.isError : receivedQuery.isError;
  const data = tab === 'written' ? writtenQuery.data : receivedQuery.data;

  const handleRefresh = () => {
    if (tab === 'written') {
      writtenQuery.refetch();
    } else {
      receivedQuery.refetch();
    }
  };

  const renderItem = ({ item }: { item: UserReview }) => {
    if (tab === 'written') {
      return (
        <View className="mb-3 rounded-card border border-line bg-surface p-3 gap-3">
          <View className="flex-row items-center gap-3">
            {item.house_cover_url ? (
              <Image
                source={{ uri: item.house_cover_url }}
                style={{ width: 60, height: 45, borderRadius: 8 }}
                contentFit="cover"
              />
            ) : (
              <View className="items-center justify-center rounded bg-surface-muted" style={{ width: 60, height: 45 }}>
                <Ionicons name="image-outline" size={16} color={palette.inkMuted} />
              </View>
            )}
            <View className="flex-1 gap-0.5">
              <Text className="text-sm font-bold text-ink" numberOfLines={1}>
                {item.house_street}, {item.house_number}
              </Text>
              <Text className="text-xs text-ink-secondary">
                {item.house_city}
              </Text>
            </View>
          </View>

          <View className="h-px bg-line" />

          <View className="flex-row items-center justify-between">
            <View className="flex-row gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Ionicons
                  key={i}
                  name={i < item.rating ? 'star' : 'star-outline'}
                  size={16}
                  color={i < item.rating ? palette.star : palette.inkMuted}
                />
              ))}
            </View>
            <Text className="text-xs text-ink-secondary">{formatDate(item.created_at)}</Text>
          </View>

          <Text className="text-base text-ink leading-5 font-normal">
            {item.body}
          </Text>
        </View>
      );
    }

    return (
      <View className="mb-3 rounded-card border border-line bg-surface p-3 gap-3">
        <View className="flex-row items-center gap-3">
          {item.author_avatar_url ? (
            <Image
              source={{ uri: item.author_avatar_url }}
              style={{ width: 40, height: 40, borderRadius: 20 }}
              contentFit="cover"
            />
          ) : (
            <View className="h-10 w-10 items-center justify-center rounded-full bg-primary-light">
              <Text className="text-sm font-bold text-primary">
                {item.author_name ? item.author_name[0].toUpperCase() : 'Г'}
              </Text>
            </View>
          )}
          <View className="flex-1 gap-0.5">
            <Text className="text-sm font-bold text-ink">
              {item.author_name || 'Гость'}
            </Text>
            <Text className="text-xs text-ink-secondary">{formatDate(item.created_at)}</Text>
          </View>
        </View>

        <View className="h-px bg-line" />

        <View className="flex-row items-center justify-between">
          <View className="flex-row gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Ionicons
                key={i}
                name={i < item.rating ? 'star' : 'star-outline'}
                size={16}
                color={i < item.rating ? palette.star : palette.inkMuted}
              />
            ))}
          </View>
          <View className="bg-surface-muted px-2.5 py-1 rounded-pill border border-line" style={{ maxWidth: '60%' }}>
            <Text className="text-xs text-ink-secondary font-medium" numberOfLines={1}>
              {item.house_street}, {item.house_number}
            </Text>
          </View>
        </View>

        <Text className="text-base text-ink leading-5 font-normal">
          {item.body}
        </Text>
      </View>
    );
  };

  return (
    <View className="flex-1 bg-surface">
      <SafeAreaView edges={['top']} className="flex-1">
        {/* Header */}
        <View className="flex-row items-center px-4 py-2">
          <Pressable
            onPress={() => router.back()}
            accessibilityLabel="Назад"
            className="h-10 w-10 items-center justify-center rounded-full bg-surface-muted active:opacity-70">
            <Ionicons name="chevron-back" size={22} color={palette.ink} />
          </Pressable>
          <Text className="flex-1 text-center text-lg font-semibold text-ink">Мои отзывы</Text>
          {/* Spacer to balance the back button */}
          <View className="h-10 w-10" />
        </View>

        {/* Tab switch */}
        <View className="flex-row gap-1 rounded-pill bg-surface-muted p-1 mx-4 mb-2">
          <Segment label="Оставленные" active={tab === 'written'} onPress={() => setTab('written')} />
          <Segment label="Полученные" active={tab === 'received'} onPress={() => setTab('received')} />
        </View>

        {/* Content list */}
        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color={palette.primary} />
          </View>
        ) : isError ? (
          <View className="flex-1 gap-4 px-4">
            <EmptyState
              icon="cloud-offline-outline"
              title="Не удалось загрузить"
              subtitle="Проверьте подключение и попробуйте снова."
            />
            <View className="px-8">
              <Button label="Повторить" variant="secondary" onPress={handleRefresh} />
            </View>
          </View>
        ) : !data || data.items.length === 0 ? (
          <EmptyState
            icon="star-outline"
            title={tab === 'written' ? 'Вы еще не оставляли отзывы' : 'У вас еще нет полученных отзывов'}
            subtitle={tab === 'written' ? 'Ваши отзывы помогут другим пользователям сделать правильный выбор' : 'Отзывы гостей о ваших объявлениях будут появляться здесь'}
          />
        ) : (
          <FlatList
            data={data.items}
            renderItem={renderItem}
            keyExtractor={(item) => String(item.id)}
            contentContainerClassName="px-4 pb-6 pt-1"
            showsVerticalScrollIndicator={false}
          />
        )}
      </SafeAreaView>
    </View>
  );
}

function Segment({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      className={cn(
        'flex-1 items-center justify-center rounded-pill py-2',
        active ? 'bg-surface' : 'bg-transparent',
      )}>
      <Text className={cn('text-sm font-semibold', active ? 'text-ink' : 'text-ink-secondary')}>
        {label}
      </Text>
    </Pressable>
  );
}
