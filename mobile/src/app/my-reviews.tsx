import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ReviewListSkeleton } from '@/components/DomainListSkeletons';
import { PersonalListToolbar, type SortOption } from '@/components/PersonalListToolbar';
import { ReviewCard } from '@/components/reviews/ReviewCard';
import { AppHeader, BottomSheet, Button, CountedTabs, DialogActions, EmptyState, IconButton, LoadErrorState, TextArea } from '@/components/ui';
import { useCreateReviewReply, useMyWrittenReviews, useMyReceivedReviews } from '@/lib/api/reviews';
import { useAppTheme } from '@/theme/useAppTheme';
import type { UserReview } from '@/types/review';
import { useActivityScopeSeen } from '@/hooks/useActivityScopeSeen';
import { useKeyboardAwareListFocus } from '@/hooks/useKeyboardAwareListFocus';
import { CollapsibleHeader, useCollapsibleHeader } from '@/components/CollapsibleHeader';
import { ContentActionsSheet } from '@/components/safety/ContentActionsSheet';
import { ReportSheet } from '@/components/safety/ReportSheet';

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

export default function MyReviewsScreen() {
  const routeParams = useLocalSearchParams<{
    focusReviewId?: string;
    focusTab?: ReviewTab;
    notificationId?: string;
  }>();
  const requestedFocusReviewId = Number(routeParams.focusReviewId ?? 0);
  const requestedFocusTab: ReviewTab = routeParams.focusTab === 'received' ? 'received' : 'written';
  const collapsibleHeader = useCollapsibleHeader();
  const showCollapsibleHeader = collapsibleHeader.show;
  useActivityScopeSeen('reviews');
  const { palette, isDark } = useAppTheme();
  const screenBackground = isDark ? '#0D0F12' : '#F4F5F7';
  const headerBackground = isDark ? '#14161B' : '#FFFFFF';
  const [tab, setTab] = useState<ReviewTab>(requestedFocusTab);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<ReviewSort>('newest');
  const [sortVisible, setSortVisible] = useState(false);
  const pageWidth = Dimensions.get('window').width;
  const horizontalScrollRef = useRef<ScrollView>(null);
  const writtenListRef = useRef<FlatList<UserReview>>(null);
  const receivedListRef = useRef<FlatList<UserReview>>(null);
  const { handleFocus: handleReceivedReplyFocus } = useKeyboardAwareListFocus(receivedListRef);
  const handledFocusKeyRef = useRef('');
  const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [reviewHighlight] = useState(() => new Animated.Value(0));
  const [highlightedReviewId, setHighlightedReviewId] = useState<number | null>(null);
  const [actionReview, setActionReview] = useState<UserReview | null>(null);
  const [reportReview, setReportReview] = useState<UserReview | null>(null);

  const writtenQuery = useMyWrittenReviews({ limit: 100 });
  const receivedQuery = useMyReceivedReviews({ limit: 100 });

  const rawWrittenItems = useMemo(() => writtenQuery.data?.items ?? [], [writtenQuery.data?.items]);
  const rawReceivedItems = useMemo(() => receivedQuery.data?.items ?? [], [receivedQuery.data?.items]);
  const writtenItems = useMemo(() => filterReviews(rawWrittenItems, query, sort), [rawWrittenItems, query, sort]);
  const receivedItems = useMemo(() => filterReviews(rawReceivedItems, query, sort), [rawReceivedItems, query, sort]);

  const isLoading = writtenQuery.isLoading || receivedQuery.isLoading;
  const isError = writtenQuery.isError || receivedQuery.isError;

  const handleRefresh = () => {
    writtenQuery.refetch();
    receivedQuery.refetch();
  };

  useEffect(() => {
    return () => {
      if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
      reviewHighlight.stopAnimation();
    };
  }, [reviewHighlight]);

  useEffect(() => {
    if (!Number.isFinite(requestedFocusReviewId) || requestedFocusReviewId <= 0 || isLoading) return;

    const focusKey = `${routeParams.notificationId ?? 'direct'}:${requestedFocusReviewId}:${requestedFocusTab}`;
    if (handledFocusKeyRef.current === focusKey) return;

    const rawItems = requestedFocusTab === 'received' ? rawReceivedItems : rawWrittenItems;
    if (!rawItems.some((item) => item.id === requestedFocusReviewId)) return;

    if (query) {
      requestAnimationFrame(() => setQuery(''));
      return;
    }

    const visibleItems = requestedFocusTab === 'received' ? receivedItems : writtenItems;
    const targetIndex = visibleItems.findIndex((item) => item.id === requestedFocusReviewId);
    if (targetIndex < 0) return;

    handledFocusKeyRef.current = focusKey;
    requestAnimationFrame(() => {
      showCollapsibleHeader();
      setTab(requestedFocusTab);
      setHighlightedReviewId(requestedFocusReviewId);
      reviewHighlight.stopAnimation();
      reviewHighlight.setValue(0);
      horizontalScrollRef.current?.scrollTo({
        x: requestedFocusTab === 'received' ? pageWidth : 0,
        animated: false,
      });

      if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
      focusTimerRef.current = setTimeout(() => {
        const listRef = requestedFocusTab === 'received' ? receivedListRef : writtenListRef;
        listRef.current?.scrollToIndex({
          index: targetIndex,
          animated: true,
          viewPosition: 0.38,
        });
        Animated.sequence([
          Animated.timing(reviewHighlight, { toValue: 1, duration: 220, useNativeDriver: false }),
          Animated.timing(reviewHighlight, { toValue: 0.35, duration: 420, useNativeDriver: false }),
          Animated.timing(reviewHighlight, { toValue: 1, duration: 220, useNativeDriver: false }),
          Animated.timing(reviewHighlight, { toValue: 0, duration: 700, useNativeDriver: false }),
        ]).start(({ finished }) => {
          if (finished) setHighlightedReviewId(null);
        });
      }, 180);
    });
  }, [
    isLoading,
    pageWidth,
    query,
    rawReceivedItems,
    rawWrittenItems,
    receivedItems,
    requestedFocusReviewId,
    requestedFocusTab,
    reviewHighlight,
    routeParams.notificationId,
    showCollapsibleHeader,
    writtenItems,
  ]);

  const handleTabChange = (nextTab: ReviewTab) => {
    collapsibleHeader.show();
    setTab(nextTab);
    horizontalScrollRef.current?.scrollTo({
      x: nextTab === 'written' ? 0 : pageWidth,
      animated: true,
    });
  };

  const renderItem = ({ item, isWritten, index }: { item: UserReview; isWritten: boolean; index?: number }) => {
    const isHighlighted = highlightedReviewId === item.id;
    const highlightStyle = isHighlighted
      ? {
          borderColor: reviewHighlight.interpolate({
            inputRange: [0, 1],
            outputRange: ['rgba(255, 101, 53, 0)', palette.primary],
          }),
          transform: [
            {
              scale: reviewHighlight.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 1.012],
              }),
            },
          ],
        }
      : null;

    const card = !isWritten ? (
      <ReceivedReviewCard
        review={item}
        onActions={() => setActionReview(item)}
        onReplyFocus={() => handleReceivedReplyFocus(index ?? 0)}
      />
    ) : (
      <ReviewCard
        body={item.body}
        createdAt={item.created_at}
        header={{
          kind: 'listing',
          title: `${item.house_street}, ${item.house_number}`,
          subtitle: item.house_city,
          coverUrl: item.house_cover_url,
        }}
        rating={item.rating}
        rejectionReason={item.rejection_reason}
        reply={item.reply}
        status={item.status}>
        {item.request_id && (item.status === 'rejected' || item.status === 'moderation_review') ? (
          <View className="mt-2 self-end" style={{ width: 140 }}>
            <Button
              label="Изменить"
              size="md"
              onPress={() => router.push({ pathname: '/review/[id]', params: { id: String(item.request_id) } })}
            />
          </View>
        ) : null}
      </ReviewCard>
    );

    return (
      <Animated.View style={[screenStyles.reviewCardFrame, highlightStyle]}>
        {card}
      </Animated.View>
    );
  };

  return (
    <View className="flex-1" style={{ backgroundColor: headerBackground }}>
      <SafeAreaView edges={['top']} className="flex-1" style={{ backgroundColor: headerBackground }}>
        <KeyboardAvoidingView
          behavior="height"
          automaticOffset
          className="flex-1"
          style={{ backgroundColor: screenBackground }}>
        <AppHeader blurred fallback="/(tabs)/profile" title="Мои отзывы" />

        <View className="flex-1 overflow-hidden">
        <CollapsibleHeader controller={collapsibleHeader} style={{ backgroundColor: screenBackground }}>
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

        <CountedTabs
          items={[
            { value: 'written', label: 'Оставленные', count: rawWrittenItems.length },
            { value: 'received', label: 'Полученные', count: rawReceivedItems.length },
          ]}
          value={tab}
          onChange={handleTabChange}
        />

        </CollapsibleHeader>

        {/* Content list */}
        {isLoading ? (
          <ReviewListSkeleton />
        ) : isError ? (
          <LoadErrorState title="Не удалось загрузить отзывы" onRetry={handleRefresh} />
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
                collapsibleHeader.show();
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
                  ref={writtenListRef}
                  data={writtenItems}
                  renderItem={({ item }) => renderItem({ item, isWritten: true })}
                  keyExtractor={(item) => String(item.id)}
                  onScroll={collapsibleHeader.onScroll}
                  onScrollBeginDrag={collapsibleHeader.onScrollBeginDrag}
                  onScrollEndDrag={collapsibleHeader.onScrollEndDrag}
                  contentContainerStyle={{ paddingTop: collapsibleHeader.height + 4 }}
                  scrollEventThrottle={16}
                  contentContainerClassName="px-4 pb-6 pt-1"
                  showsVerticalScrollIndicator={false}
                  onScrollToIndexFailed={({ index, averageItemLength }) => {
                    writtenListRef.current?.scrollToOffset({
                      offset: Math.max(0, averageItemLength * index),
                      animated: false,
                    });
                    requestAnimationFrame(() => {
                      writtenListRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.38 });
                    });
                  }}
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
                  renderItem={({ item, index }) => renderItem({ item, isWritten: false, index })}
                  keyExtractor={(item) => String(item.id)}
                  onScroll={collapsibleHeader.onScroll}
                  onScrollBeginDrag={collapsibleHeader.onScrollBeginDrag}
                  onScrollEndDrag={collapsibleHeader.onScrollEndDrag}
                  contentContainerStyle={{ paddingTop: collapsibleHeader.height + 4 }}
                  scrollEventThrottle={16}
                  contentContainerClassName="px-4 pb-6 pt-1"
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  onScrollToIndexFailed={({ index, averageItemLength }) => {
                    receivedListRef.current?.scrollToOffset({
                      offset: Math.max(0, averageItemLength * index),
                      animated: false,
                    });
                    requestAnimationFrame(() => {
                      receivedListRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.38 });
                    });
                  }}
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
        </View>
        <ContentActionsSheet
          visible={actionReview != null}
          onClose={() => setActionReview(null)}
          title="Отзыв"
          subtitle={actionReview?.author_name || 'Действия с отзывом'}
          actions={[
            {
              key: 'report',
              title: 'Пожаловаться',
              subtitle: 'Сообщить о нарушении правил',
              icon: 'flag-outline',
              onPress: () => {
                const review = actionReview;
                setActionReview(null);
                if (review) setTimeout(() => setReportReview(review), 240);
              },
            },
          ]}
        />
        <ReportSheet
          visible={reportReview != null}
          targetType="review"
          targetID={reportReview?.id ?? 0}
          targetLabel={reportReview?.author_name}
          onClose={() => setReportReview(null)}
        />
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const screenStyles = StyleSheet.create({
  reviewCardFrame: {
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    borderRadius: 22,
  },
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
});

function ReceivedReviewCard({
  review,
  onActions,
  onReplyFocus,
}: {
  review: UserReview;
  onActions: () => void;
  onReplyFocus: () => void;
}) {
  const { palette } = useAppTheme();
  const [replying, setReplying] = useState(false);
  const [replyBody, setReplyBody] = useState('');
  const [emojiPickerVisible, setEmojiPickerVisible] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [animation] = useState(() => new Animated.Value(0));
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
    <ReviewCard
      body={review.body}
      createdAt={review.created_at}
      header={{
        kind: 'author',
        name: review.author_name,
        avatarUrl: review.author_avatar_url,
        listingLabel: `${review.house_street}, ${review.house_number}`,
      }}
      headerAction={(
        <IconButton
          icon="ellipsis-horizontal"
          size={36}
          iconSize={19}
          onPress={onActions}
          accessibilityLabel="Действия с отзывом"
        />
      )}
      rating={review.rating}
      reply={review.reply}>
      {review.reply?.status === 'active' ? null : submitted || review.reply?.status === 'pending_moderation' ? (
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
          <View className="flex-row items-end gap-2">
            <TextArea
              value={replyBody}
              onChangeText={setReplyBody}
              onFocus={onReplyFocus}
              maxLength={1500}
              minHeight={72}
              placeholder="Ответ гостю"
              containerStyle={{ flex: 1 }}
              style={{ fontSize: 14, lineHeight: 19 }}
            />
            <IconButton icon="happy-outline" size={38} iconSize={21} onPress={() => setEmojiPickerVisible(true)} accessibilityLabel="Выбрать смайлик" />
          </View>
          <DialogActions
            reset={<Button label="Отмена" mode="soft" tone="neutral" size="md" onPress={closeReply} />}
            primary={<Button label="Отправить" size="md" loading={createReply.isPending} disabled={!replyBody.trim()} onPress={() => createReply.mutate(replyBody.trim(), { onSuccess: () => { setSubmitted(true); setReplying(false); setReplyBody(''); } })} />}
          />
          <Text className="text-xs text-ink-muted">Ответ появится после проверки.</Text>
        </Animated.View>
      ) : null}

      <BottomSheet
        visible={emojiPickerVisible}
        onClose={() => setEmojiPickerVisible(false)}
        title="Добавить эмодзи"
        subtitle="Выберите символ для ответа"
        icon="happy-outline">
        <View className="py-2">
          <View className="flex-row flex-wrap justify-center gap-3 px-2 pb-2">
            {REVIEW_EMOJI_OPTIONS.map((emoji) => (
              <Pressable key={emoji} onPress={() => addEmoji(emoji)} className="h-12 w-12 items-center justify-center rounded-2xl bg-surface-muted" accessibilityLabel={`Добавить ${emoji}`}>
                <Text className="text-2xl">{emoji}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </BottomSheet>
    </ReviewCard>
  );
}
