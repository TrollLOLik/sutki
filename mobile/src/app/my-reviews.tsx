import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/EmptyState';
import { PersonalListToolbar, type SortOption } from '@/components/PersonalListToolbar';
import { BottomSheet, Button, IconButton, MaterialSurface } from '@/components/ui';
import { useCreateReviewReply, useMyWrittenReviews, useMyReceivedReviews } from '@/lib/api/reviews';
import { NavigationBackButton } from '@/components/NavigationBackButton';
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
  const { palette, isDark } = useAppTheme();
  const screenBackground = isDark ? '#0D0F12' : '#F4F5F7';
  const headerBackground = isDark ? '#14161B' : '#FFFFFF';
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
    Animated.spring(tabAnim, {
      toValue: tab === 'written' ? 0 : 1,
      damping: 22,
      stiffness: 240,
      mass: 0.8,
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
        <MaterialSurface level="raised" radius={20} className="mb-3 gap-3 p-4">
          <View className="flex-row items-center gap-3">
            {item.house_cover_url ? (
              <Image
                source={{ uri: item.house_cover_url }}
                style={{ width: 68, height: 52, borderRadius: 13 }}
                contentFit="cover"
              />
            ) : (
              <View className="items-center justify-center rounded-xl bg-surface-muted" style={{ width: 68, height: 52 }}>
                <Ionicons name="image-outline" size={20} color={palette.inkMuted} />
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

          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-0.5 rounded-full bg-primary-light px-2.5 py-1.5">
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

          <Text className="text-[15px] font-normal leading-6 text-ink">
            {item.body}
          </Text>
          {item.status && item.status !== 'active' ? (
            <View className="self-start flex-row items-center gap-1.5 rounded-pill bg-primary-light px-3 py-1.5">
              <Ionicons name={item.status === 'rejected' ? 'close-circle-outline' : 'time-outline'} size={14} color={item.status === 'rejected' ? palette.danger : palette.primary} />
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
        </MaterialSurface>
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
    <View className="flex-1" style={{ backgroundColor: headerBackground }}>
      <SafeAreaView edges={['top']} className="flex-1" style={{ backgroundColor: headerBackground }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1"
          style={{ backgroundColor: screenBackground }}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
        >
        <View style={screenStyles.header}>
          <BlurView intensity={88} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? 'rgba(20,22,27,0.72)' : 'rgba(255,255,255,0.72)' }]} />
          <View style={screenStyles.headerContent}>
            <NavigationBackButton fallback="/(tabs)/profile" size={48} variant="material" />
            <Text className="text-xl font-extrabold text-ink" style={screenStyles.headerTitle}>Мои отзывы</Text>
            <View style={screenStyles.headerSpacer} />
          </View>
        </View>

        {/* Tab switch */}
        <MaterialSurface
          level="raised"
          radius={18}
          onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
          className="relative mx-4 mb-3 mt-3 h-12 flex-row p-1"
          style={screenStyles.tabs}
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
              backgroundColor: palette.primaryLight,
              borderRadius: 14,
            }}
          />
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === 'written' }}
            onPress={() => handleTabChange('written')}
            className="relative z-10 h-10 flex-1 items-center justify-center rounded-xl"
          >
            <Text className={`text-sm font-bold ${tab === 'written' ? 'text-primary' : 'text-ink-secondary'}`}>
              Оставленные
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === 'received' }}
            onPress={() => handleTabChange('received')}
            className="relative z-10 h-10 flex-1 items-center justify-center rounded-xl"
          >
            <Text className={`text-sm font-bold ${tab === 'received' ? 'text-primary' : 'text-ink-secondary'}`}>
              Полученные
            </Text>
          </Pressable>
        </MaterialSurface>

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

const screenStyles = StyleSheet.create({
  header: {
    height: 68,
    flexShrink: 0,
    overflow: 'hidden',
    position: 'relative',
  },
  headerContent: {
    height: 68,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    position: 'absolute',
    left: 80,
    right: 80,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 48,
    height: 48,
  },
  tabs: {
    height: 48,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 12,
    padding: 4,
    flexDirection: 'row',
    position: 'relative',
  },
});

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
    <MaterialSurface level="raised" radius={20} className="mb-3 gap-3 p-4">
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

      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-0.5 rounded-full bg-primary-light px-2.5 py-1.5">
          {Array.from({ length: 5 }).map((_, i) => <Ionicons key={i} name={i < review.rating ? 'star' : 'star-outline'} size={16} color={i < review.rating ? palette.star : palette.inkMuted} />)}
        </View>
        <View className="rounded-pill bg-surface-muted px-2.5 py-1" style={{ maxWidth: '60%' }}>
          <Text className="text-xs text-ink-secondary font-medium" numberOfLines={1}>{review.house_street}, {review.house_number}</Text>
        </View>
      </View>
      <Text className="text-[15px] font-normal leading-6 text-ink">{review.body}</Text>

      {review.reply?.status === 'active' ? (
        <View className="rounded-2xl bg-primary-light p-3.5">
          <View className="flex-row items-center gap-2">
            <Ionicons name="chatbubble-ellipses-outline" size={16} color={palette.primary} />
            <Text className="text-xs font-bold text-primary">Ответ владельца</Text>
          </View>
          <Text className="mt-2 text-sm leading-5 text-ink-secondary">{review.reply.body}</Text>
        </View>
      ) : submitted || review.reply?.status === 'pending_moderation' ? (
        <Text className="text-xs font-semibold text-primary">Ответ отправлен на проверку</Text>
      ) : review.reply?.status === 'moderation_review' ? (
        <Text className="text-xs font-semibold text-primary">Ответ проходит дополнительную проверку</Text>
      ) : review.reply?.status === 'rejected' ? (
        <Text className="text-xs font-semibold text-danger">Ответ отклонён</Text>
      ) : !replying ? (
        <Pressable onPress={openReply} className="self-start flex-row items-center gap-2 rounded-full bg-primary-light px-3 py-2" accessibilityRole="button">
          <Ionicons name="return-up-back-outline" size={17} color={palette.primary} />
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
            <IconButton icon="happy-outline" size={38} iconSize={21} onPress={() => setEmojiPickerVisible(true)} accessibilityLabel="Выбрать смайлик" />
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
    </MaterialSurface>
  );
}
