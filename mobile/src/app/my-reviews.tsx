import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  FlatList,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui';
import { useMyWrittenReviews, useMyReceivedReviews } from '@/lib/api/reviews';
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
  const pageWidth = Dimensions.get('window').width;
  const [containerWidth, setContainerWidth] = useState(pageWidth - 32);
  const tabAnim = useRef(new Animated.Value(0)).current;
  const horizontalScrollRef = useRef<ScrollView>(null);

  const writtenQuery = useMyWrittenReviews({});
  const receivedQuery = useMyReceivedReviews({});

  const writtenItems = writtenQuery.data?.items ?? [];
  const receivedItems = receivedQuery.data?.items ?? [];

  const isLoading = writtenQuery.isLoading || receivedQuery.isLoading;
  const isError = writtenQuery.isError || receivedQuery.isError;

  const handleRefresh = () => {
    writtenQuery.refetch();
    receivedQuery.refetch();
  };

  useEffect(() => {
    Animated.timing(tabAnim, {
      toValue: tab === 'written' ? 0 : 1,
      duration: 200,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    }).start();
  }, [tab]);

  const handleTabChange = (nextTab: ReviewTab) => {
    setTab(nextTab);
    horizontalScrollRef.current?.scrollTo({
      x: nextTab === 'written' ? 0 : pageWidth,
      animated: true,
    });
  };

  const renderItem = ({ item, isWritten }: { item: UserReview; isWritten: boolean }) => {
    if (isWritten) {
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
        <View
          onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
          className="flex-row rounded-pill bg-surface-muted p-1 mx-4 mb-2 relative"
        >
          <Animated.View
            style={{
              position: 'absolute',
              top: 4,
              left: 4,
              bottom: 4,
              width: (containerWidth - 8) / 2,
              transform: [{
                translateX: tabAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, (containerWidth - 8) / 2],
                })
              }],
              backgroundColor: palette.surface,
              borderRadius: 9999,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.08,
              shadowRadius: 4,
              elevation: 2,
            }}
          />
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === 'written' }}
            onPress={() => handleTabChange('written')}
            className="h-10 flex-1 items-center justify-center rounded-pill relative z-10"
          >
            <Text className={`text-sm font-semibold transition-colors duration-200 ${tab === 'written' ? 'text-ink' : 'text-ink-secondary'}`}>
              Оставленные
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === 'received' }}
            onPress={() => handleTabChange('received')}
            className="h-10 flex-1 items-center justify-center rounded-pill relative z-10"
          >
            <Text className={`text-sm font-semibold transition-colors duration-200 ${tab === 'received' ? 'text-ink' : 'text-ink-secondary'}`}>
              Полученные
            </Text>
          </Pressable>
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
        ) : (
          <ScrollView
            ref={horizontalScrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={16}
            onMomentumScrollEnd={(e) => {
              const offsetX = e.nativeEvent.contentOffset.x;
              const page = Math.round(offsetX / pageWidth);
              const nextTab = page === 0 ? 'written' : 'received';
              if (tab !== nextTab) {
                setTab(nextTab);
              }
            }}
            className="flex-1"
          >
            {/* Written Reviews Page */}
            <View style={{ width: pageWidth }}>
              {writtenItems.length === 0 ? (
                <EmptyState
                  icon="star-outline"
                  title="Вы еще не оставляли отзывы"
                  subtitle="Ваши отзывы помогут другим пользователям сделать правильный выбор"
                />
              ) : (
                <FlatList
                  data={writtenItems}
                  renderItem={({ item }) => renderItem({ item, isWritten: true })}
                  keyExtractor={(item) => String(item.id)}
                  contentContainerClassName="px-4 pb-6 pt-1"
                  showsVerticalScrollIndicator={false}
                  ListFooterComponent={
                    writtenItems.length > 0 ? (
                      <View className="py-6 items-center">
                        <Text className="text-xs text-ink-muted">Это все отзывы</Text>
                      </View>
                    ) : null
                  }
                />
              )}
            </View>

            {/* Received Reviews Page */}
            <View style={{ width: pageWidth }}>
              {receivedItems.length === 0 ? (
                <EmptyState
                  icon="star-outline"
                  title="У вас еще нет полученных отзывов"
                  subtitle="Отзывы гостей о ваших объявлениях будут появляться здесь"
                />
              ) : (
                <FlatList
                  data={receivedItems}
                  renderItem={({ item }) => renderItem({ item, isWritten: false })}
                  keyExtractor={(item) => String(item.id)}
                  contentContainerClassName="px-4 pb-6 pt-1"
                  showsVerticalScrollIndicator={false}
                  ListFooterComponent={
                    receivedItems.length > 0 ? (
                      <View className="py-6 items-center">
                        <Text className="text-xs text-ink-muted">Это все отзывы</Text>
                      </View>
                    ) : null
                  }
                />
              )}
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}
