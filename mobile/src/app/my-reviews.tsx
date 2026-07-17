import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/EmptyState';
import { PersonalListToolbar, type SortOption } from '@/components/PersonalListToolbar';
import { BottomSheet, Button } from '@/components/ui';
import { useCreateReviewReply, useMyWrittenReviews, useMyReceivedReviews } from '@/lib/api/reviews';
import { goBackOrReplace } from '@/lib/navigation';
import { useAppTheme } from '@/theme/useAppTheme';
import type { UserReview } from '@/types/review';
import { useActivityScopeSeen } from '@/hooks/useActivityScopeSeen';

type ReviewTab = 'written' | 'received';
type ReviewSort = 'newest' | 'oldest' | 'rating_desc' | 'rating_asc';
const SORT_OPTIONS: SortOption<ReviewSort>[] = [
  { value: 'newest', label: 'Сначала новые', icon: 'arrow-down-outline' },
  { value: 'oldest', label: 'Сначала старые', icon: 'arrow-up-outline' },
  { value: 'rating_desc', label: 'Сначала с высокой оценкой', icon: 'star-outline' },
  { value: 'rating_asc', label: 'Сначала с низкой оценкой', icon: 'star-half-outline' },
];

function filterReviews(items: UserReview[], query: string, sort: ReviewSort): UserReview[] {
  const needle = query.trim().toLocaleLowerCase('ru');
  return items.filter((item) => {
    const searchable = `${item.body} ${item.author_name ?? ''} ${item.house_city} ${item.house_street} ${item.house_number}`.toLocaleLowerCase('ru');
    return !needle || searchable.includes(needle);
  }).sort((a, b) => {
    if (sort === 'oldest') return Date.parse(a.created_at) - Date.parse(b.created_at) || a.id - b.id;
    if (sort === 'rating_desc') return b.rating - a.rating || Date.parse(b.created_at) - Date.parse(a.created_at);
    if (sort === 'rating_asc') return a.rating - b.rating || Date.parse(b.created_at) - Date.parse(a.created_at);
    return Date.parse(b.created_at) - Date.parse(a.created_at) || b.id - a.id;
  });
}

const REVIEW_EMOJI_OPTIONS = [
  '\u{1F600}', '\u{1F60A}', '\u{1F642}', '\u{1F60D}',
  '\u{1F602}', '\u{1F44D}', '\u{1F64F}', '\u{1F44C}',
  '\u{1F525}', '\u{2764}\u{FE0F}', '\u{1F389}', '\u{1F3E0}',
  '\u{1F4CD}', '\u{2705}', '\u{1F64C}', '\u{2600}\u{FE0F}',
];

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
  useActivityScopeSeen('reviews');
  const { palette } = useAppTheme();
  const [tab, setTab] = useState<ReviewTab>('written');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<ReviewSort>('newest');
  const [sortVisible, setSortVisible] = useState(false);
  const pageWidth = Dimensions.get('window').width;
  const [containerWidth, setContainerWidth] = useState(pageWidth - 32);
  const tabAnim = useRef(new Animated.Value(0)).current;
  const horizontalScrollRef = useRef<ScrollView>(null);
  const receivedListRef = useRef<FlatList<UserReview>>(null);

  const writtenQuery = useMyWrittenReviews({ limit: 100 });
  const receivedQuery = useMyReceivedReviews({ limit: 100 });

  const rawWrittenItems = writtenQuery.data?.items ?? [];
  const rawReceivedItems = receivedQuery.data?.items ?? [];
  const writtenItems = useMemo(() => filterReviews(rawWrittenItems, query, sort), [rawWrittenItems, query, sort]);
  const receivedItems = useMemo(() => filterReviews(rawReceivedItems, query, sort), [rawReceivedItems, query, sort]);

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

  const scrollReplyAboveKeyboard = (inputHandle: number) => {
    setTimeout(() => {
      const responder = receivedListRef.current?.getScrollResponder() as unknown as
        | { scrollResponderScrollNativeHandleToKeyboard: (handle: number, offset: number, preventNegativeScrollOffset: boolean) => void }
        | undefined;
      responder?.scrollResponderScrollNativeHandleToKeyboard(inputHandle, 128, true);
    }, 300);
  };

  const renderItem = ({ item, isWritten }: { item: UserReview; isWritten: boolean }) => {
    if (!isWritten) {
      return (
        <ReceivedReviewCard
          review={item}
          onReplyFocus={scrollReplyAboveKeyboard}
        />
      );
    }
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
          {item.status && item.status !== 'active' ? (
            <View className="self-start rounded-pill bg-primary-light px-3 py-1.5">
              <Text className="text-xs font-bold text-primary">
                {item.status === 'rejected' ? 'Отклонён' : item.status === 'moderation_review' ? 'Дополнительная проверка' : 'На проверке'}
              </Text>
            </View>
          ) : null}
          {item.status === 'rejected' && item.rejection_reason ? <Text className="text-xs leading-4 text-danger">{item.rejection_reason}</Text> : null}
          {item.request_id && (item.status === 'rejected' || item.status === 'moderation_review') ? (
            <View className="mt-2 self-end" style={{ width: 140 }}>
              <Button
                label="Изменить"
                size="md"
                onPress={() => router.push({ pathname: '/review/[id]', params: { id: String(item.request_id) } })}
              />
            </View>
          ) : null}
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
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1"
          keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
        >
        {/* Header */}
        <View className="flex-row items-center px-4 py-2">
          <Pressable
            onPress={() => goBackOrReplace('/(tabs)/profile')}
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

        <PersonalListToolbar
          query={query}
          onQueryChange={setQuery}
          placeholder="Текст, адрес или пользователь"
          sort={sort}
          sortOptions={SORT_OPTIONS}
          sortVisible={sortVisible}
          onSortVisibleChange={setSortVisible}
          onSortChange={setSort}
        />

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
                  icon={rawWrittenItems.length > 0 ? 'search-outline' : 'star-outline'}
                  title={rawWrittenItems.length > 0 ? 'Ничего не найдено' : 'Вы еще не оставляли отзывы'}
                  subtitle={rawWrittenItems.length > 0 ? 'Попробуйте изменить поисковый запрос.' : 'Ваши отзывы помогут другим пользователям сделать правильный выбор'}
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
                  icon={rawReceivedItems.length > 0 ? 'search-outline' : 'star-outline'}
                  title={rawReceivedItems.length > 0 ? 'Ничего не найдено' : 'У вас еще нет полученных отзывов'}
                  subtitle={rawReceivedItems.length > 0 ? 'Попробуйте изменить поисковый запрос.' : 'Отзывы гостей о ваших объявлениях будут появляться здесь'}
                />
              ) : (
                <FlatList
                  ref={receivedListRef}
                  data={receivedItems}
                  renderItem={({ item }) => renderItem({ item, isWritten: false })}
                  keyExtractor={(item) => String(item.id)}
                  contentContainerClassName="px-4 pb-6 pt-1"
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
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
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

function ReceivedReviewCard({ review, onReplyFocus }: { review: UserReview; onReplyFocus: (inputHandle: number) => void }) {
  const { palette } = useAppTheme();
  const [replying, setReplying] = useState(false);
  const [replyBody, setReplyBody] = useState('');
  const [emojiPickerVisible, setEmojiPickerVisible] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const animation = useRef(new Animated.Value(0)).current;
  const createReply = useCreateReviewReply(review.id);

  const openReply = () => {
    setReplying(true);
    Animated.spring(animation, { toValue: 1, useNativeDriver: true, tension: 110, friction: 12 }).start();
  };
  const closeReply = () => {
    Animated.timing(animation, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
      setReplying(false);
      setReplyBody('');
    });
  };
  const addEmoji = (emoji: string) => {
    setReplyBody((body) => `${body}${emoji}`);
    setEmojiPickerVisible(false);
  };

  return (
    <View className="mb-3 rounded-card border border-line bg-surface p-3 gap-3">
      <View className="flex-row items-center gap-3">
        {review.author_avatar_url ? (
          <Image source={{ uri: review.author_avatar_url }} style={{ width: 40, height: 40, borderRadius: 20 }} contentFit="cover" />
        ) : (
          <View className="h-10 w-10 items-center justify-center rounded-full bg-primary-light">
            <Text className="text-sm font-bold text-primary">{review.author_name ? review.author_name[0].toUpperCase() : 'Г'}</Text>
          </View>
        )}
        <View className="flex-1 gap-0.5">
          <Text className="text-sm font-bold text-ink">{review.author_name || 'Гость'}</Text>
          <Text className="text-xs text-ink-secondary">{formatDate(review.created_at)}</Text>
        </View>
      </View>

      <View className="h-px bg-line" />
      <View className="flex-row items-center justify-between">
        <View className="flex-row gap-0.5">
          {Array.from({ length: 5 }).map((_, i) => <Ionicons key={i} name={i < review.rating ? 'star' : 'star-outline'} size={16} color={i < review.rating ? palette.star : palette.inkMuted} />)}
        </View>
        <View className="bg-surface-muted px-2.5 py-1 rounded-pill border border-line" style={{ maxWidth: '60%' }}>
          <Text className="text-xs text-ink-secondary font-medium" numberOfLines={1}>{review.house_street}, {review.house_number}</Text>
        </View>
      </View>
      <Text className="text-base text-ink leading-5 font-normal">{review.body}</Text>

      {review.reply?.status === 'active' ? (
        <View className="ml-3 border-l-2 border-primary pl-3">
          <Text className="text-xs font-bold text-primary">Ответ владельца</Text>
          <Text className="mt-1 text-sm leading-5 text-ink-secondary">{review.reply.body}</Text>
        </View>
      ) : submitted || review.reply?.status === 'pending_moderation' ? (
        <Text className="text-xs font-semibold text-primary">Ответ отправлен на проверку</Text>
      ) : review.reply?.status === 'moderation_review' ? (
        <Text className="text-xs font-semibold text-primary">Ответ проходит дополнительную проверку</Text>
      ) : review.reply?.status === 'rejected' ? (
        <Text className="text-xs font-semibold text-danger">Ответ отклонён</Text>
      ) : !replying ? (
        <Pressable onPress={openReply} className="self-start py-1" accessibilityRole="button">
          <Text className="text-sm font-bold text-primary">Ответить</Text>
        </Pressable>
      ) : null}

      {replying ? (
        <Animated.View style={{ opacity: animation, transform: [{ translateY: animation.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) }] }} className="gap-2 overflow-hidden">
          <View className="flex-row items-end gap-2 rounded-field border border-line bg-surface-muted px-3 py-2">
            <TextInput
              value={replyBody}
              onChangeText={setReplyBody}
              onFocus={(event) => onReplyFocus(event.nativeEvent.target)}
              multiline
              maxLength={1500}
              placeholder="Ответ гостю"
              placeholderTextColor={palette.inkMuted}
              className="min-h-16 flex-1 text-sm text-ink"
              textAlignVertical="top"
            />
            <Pressable onPress={() => setEmojiPickerVisible(true)} className="h-9 w-9 items-center justify-center rounded-full" accessibilityLabel="Выбрать смайлик">
              <Ionicons name="happy-outline" size={22} color={palette.inkSecondary} />
            </Pressable>
          </View>
          <View className="flex-row gap-2">
            <View className="flex-1"><Button label="Отмена" variant="secondary" size="md" onPress={closeReply} /></View>
            <View className="flex-1"><Button label="Отправить" size="md" loading={createReply.isPending} disabled={!replyBody.trim()} onPress={() => createReply.mutate(replyBody.trim(), { onSuccess: () => { setSubmitted(true); setReplying(false); setReplyBody(''); } })} /></View>
          </View>
          <Text className="text-xs text-ink-muted">Ответ появится после проверки.</Text>
        </Animated.View>
      ) : null}

      <BottomSheet visible={emojiPickerVisible} onClose={() => setEmojiPickerVisible(false)}>
        <View className="py-2">
          <Text className="mb-5 text-center text-lg font-bold text-ink">Смайлик</Text>
          <View className="flex-row flex-wrap justify-center gap-3 px-2 pb-2">
            {REVIEW_EMOJI_OPTIONS.map((emoji) => (
              <Pressable key={emoji} onPress={() => addEmoji(emoji)} className="h-12 w-12 items-center justify-center rounded-2xl bg-surface-muted" accessibilityLabel={`Добавить ${emoji}`}>
                <Text className="text-2xl">{emoji}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </BottomSheet>
    </View>
  );
}
