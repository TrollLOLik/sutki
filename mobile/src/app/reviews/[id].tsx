import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { router, useLocalSearchParams } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useMemo, useRef, useState } from 'react';
import { ReviewListSkeleton } from '@/components/DomainListSkeletons';
import { ReviewCard } from '@/components/reviews/ReviewCard';
import { Stars } from '@/components/Stars';
import { BottomSheet, Button, DialogActions, EmptyState, IconButton, LoadErrorState, MaterialSurface, TextArea } from '@/components/ui';
import { useKeyboardAwareListFocus } from '@/hooks/useKeyboardAwareListFocus';
import { useMyListings } from '@/lib/api/create-listing';
import { useListing } from '@/lib/api/listings';
import { useUserBlockState } from '@/lib/api/abuse';
import { useReviews, useHostReviews, useCreateReviewReply } from '@/lib/api/reviews';
import { formatRating, formatReviewsCount } from '@/lib/format';
import { useSessionStore } from '@/store/session';
import { useAppTheme } from '@/theme/useAppTheme';
import type { Review, ReviewSummary } from '@/types/review';
import { NavigationBackButton } from '@/components/NavigationBackButton';
import { ContentActionsSheet } from '@/components/safety/ContentActionsSheet';
import { ReportSheet } from '@/components/safety/ReportSheet';
import { requireAuth } from '@/lib/requireAuth';

const REVIEW_EMOJI_OPTIONS = [
  '\u{1F600}', '\u{1F60A}', '\u{1F642}', '\u{1F60D}',
  '\u{1F602}', '\u{1F44D}', '\u{1F64F}', '\u{1F44C}',
  '\u{1F525}', '\u{2764}\u{FE0F}', '\u{1F389}', '\u{1F3E0}',
  '\u{1F4CD}', '\u{2705}', '\u{1F64C}', '\u{2600}\u{FE0F}',
];

export default function ReviewsScreen() {
  const { isDark } = useAppTheme();
  const screenBackground = isDark ? '#0D0F12' : '#F4F5F7';
  const headerBackground = isDark ? '#14161B' : '#FFFFFF';
  const { id, isHost } = useLocalSearchParams<{ id: string; isHost?: string }>();
  const numericId = Number(id);
  const reviewsListRef = useRef<FlatList<Review>>(null);
  const { handleFocus: handleReplyFocus } = useKeyboardAwareListFocus(reviewsListRef);
  const hostMode = isHost === 'true';
  const listing = useListing(numericId, !hostMode);
  const listingReviews = useReviews(numericId, { limit: 50 }, !hostMode);
  const hostReviews = useHostReviews(numericId, { limit: 50 }, hostMode);
  const { data, isLoading, isError, refetch, isRefetching } = hostMode
    ? hostReviews
    : listingReviews;

  const { status: authStatus, user } = useSessionStore();
  const isAuthenticated = authStatus === 'authenticated';
  const blockState = useUserBlockState(
    listing.data?.owner_id,
    Boolean(
      isAuthenticated &&
      listing.data &&
      listing.data.owner_id !== user?.id
    ),
  );
  const bookingBlocked = Boolean(blockState.data?.blocked);
  const [actionReview, setActionReview] = useState<Review | null>(null);
  const [reportReview, setReportReview] = useState<Review | null>(null);
  const { data: myListingsData } = useMyListings({ limit: 100 }, { enabled: isAuthenticated && isHost !== 'true' });

  const isOwnListing = useMemo(() => {
    if (isHost === 'true' || !myListingsData || !numericId) return false;
    return myListingsData.items.some((item) => item.id === numericId);
  }, [myListingsData, numericId, isHost]);

  const summary = data?.summary;
  const items = data?.items ?? [];

  return (
    <View className="flex-1" style={{ backgroundColor: headerBackground }}>
      <SafeAreaView edges={['top', 'bottom']} className="flex-1" style={{ backgroundColor: headerBackground }}>
        <KeyboardAvoidingView
          behavior="height"
          automaticOffset
          className="flex-1"
          style={{ backgroundColor: screenBackground }}>
        <View style={styles.header}>
          <BlurView intensity={88} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? 'rgba(20,22,27,0.72)' : 'rgba(255,255,255,0.72)' }]} />
          <View style={styles.headerContent}>
            <NavigationBackButton fallback={{ pathname: '/listing/[id]', params: { id } }} size={48} variant="material" />
            <Text className="text-xl font-extrabold text-ink" style={styles.headerTitle}>Отзывы</Text>
            <View style={styles.headerSpacer} />
          </View>
        </View>

        {isLoading ? (
          <ReviewListSkeleton />
        ) : isError ? (
          <LoadErrorState title="Не удалось загрузить отзывы" onRetry={() => refetch()} />
        ) : (
          <>
            <FlatList
              ref={reviewsListRef}
              style={styles.list}
              data={items}
              keyExtractor={(item) => String(item.id)}
              contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24 }}
              showsVerticalScrollIndicator={false}
              onRefresh={() => refetch()}
              refreshing={isRefetching}
              ListHeaderComponent={summary && summary.total > 0 ? <SummaryHeader summary={summary} /> : null}
              ListEmptyComponent={
                <EmptyState
                  icon="chatbubble-ellipses-outline"
                  title="Отзывов пока нет"
                  subtitle="Будьте первым, кто оставит отзыв об этом объекте."
                />
              }
              keyboardShouldPersistTaps="handled"
              onScrollToIndexFailed={({ index, averageItemLength }) => {
                reviewsListRef.current?.scrollToOffset({
                  offset: Math.max(0, averageItemLength * index),
                  animated: false,
                });
                requestAnimationFrame(() => {
                  reviewsListRef.current?.scrollToIndex({
                    index,
                    animated: true,
                    viewPosition: 0.12,
                    viewOffset: 8,
                  });
                });
              }}
              renderItem={({ item, index }) => (
                <ReviewRow
                  review={item}
                  canReply={isOwnListing}
                  canReport={item.author_id !== user?.id}
                  onActions={() => setActionReview(item)}
                  onReplyFocus={() => handleReplyFocus(index)}
                />
              )}
            />

            {isHost !== 'true' ? (
              <View className="px-4 py-3" style={{ backgroundColor: isDark ? '#14161B' : '#FFFFFF' }}>
                {isOwnListing ? (
                  <Button
                    label="Редактировать"
                    onPress={() => router.push({ pathname: '/create', params: { editId: id } } as any)}
                  />
                ) : (
                  <Button
                    label={
                      bookingBlocked
                        ? blockState.data?.blocked_by_me
                          ? 'Пользователь заблокирован'
                          : 'Заявка недоступна'
                        : 'Оставить заявку'
                    }
                    disabled={bookingBlocked}
                    onPress={() => router.push({ pathname: '/booking/[id]', params: { id } })}
                  />
                )}
              </View>
            ) : null}

          </>
        )}
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
                if (!requireAuth('generic')) return;
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

function SummaryHeader({ summary }: { summary: ReviewSummary }) {
  const { palette } = useAppTheme();
  const max = Math.max(1, ...Object.values(summary.distribution));
  return (
    <MaterialSurface level="raised" radius={22} className="mb-4 flex-row p-4">
      <View className="w-[38%] items-center justify-center border-r border-line pr-4">
        <Text className="text-[40px] font-extrabold leading-[44px] text-ink">{formatRating(summary.average)}</Text>
        <View className="my-1.5 rounded-full bg-primary-light px-2.5 py-1">
          <Stars value={summary.average} size={14} />
        </View>
        <Text className="text-center text-xs leading-4 text-ink-muted">
          {formatReviewsCount(summary.total)}
        </Text>
      </View>

      <View className="flex-1 justify-between py-1 pl-4">
        {[5, 4, 3, 2, 1].map((star) => {
          const count = summary.distribution[String(star)] ?? 0;
          return (
            <View key={star} className="h-4 flex-row items-center gap-2">
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
    </MaterialSurface>
  );
}

const styles = StyleSheet.create({
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
  list: {
    flex: 1,
  },
});

function ReviewRow({
  review,
  canReply,
  canReport,
  onActions,
  onReplyFocus,
}: {
  review: Review;
  canReply: boolean;
  canReport: boolean;
  onActions: () => void;
  onReplyFocus: () => void;
}) {
  const { palette } = useAppTheme();
  const [replying,setReplying]=useState(false);
  const [replyBody,setReplyBody]=useState('');
  const [submitted,setSubmitted]=useState(false);
  const createReply=useCreateReviewReply(review.id);
  return (
    <ReviewCard
      body={review.body}
      className="mb-3"
      createdAt={review.created_at}
      header={{ kind: 'author', name: review.author_name, avatarUrl: review.author_avatar_url }}
      headerAction={canReport ? (
        <IconButton
          icon="ellipsis-horizontal"
          size={36}
          iconSize={19}
          onPress={onActions}
          accessibilityLabel="Действия с отзывом"
        />
      ) : null}
      rating={review.rating}
      ratingMode="score"
      reply={review.reply}>
      {review.reply?.status === 'active' ? null : submitted || (canReply && review.reply?.status === 'pending_moderation') ? (
        <Text className="mt-3 text-xs font-semibold text-primary">Ответ отправлен на проверку</Text>
      ) : canReply && review.reply?.status === 'moderation_review' ? (
        <Text className="mt-3 text-xs font-semibold text-primary">Ответ проходит дополнительную проверку</Text>
      ) : canReply && review.reply?.status === 'rejected' ? (
        <Text className="mt-3 text-xs font-semibold text-danger">Ответ отклонён</Text>
      ) : canReply && !replying ? (
        <Pressable onPress={()=>setReplying(true)} className="mt-3 self-start flex-row items-center gap-2 rounded-full bg-primary-light px-3 py-2">
          <Ionicons name="return-up-back-outline" size={17} color={palette.primary} />
          <Text className="text-sm font-bold text-primary">Ответить</Text>
        </Pressable>
      ) : null}
      {canReply && replying && !review.reply && !submitted ? (
        <ListingReviewReplyEditor
          value={replyBody}
          onChange={setReplyBody}
          onFocus={onReplyFocus}
          onCancel={() => { setReplying(false); setReplyBody(''); }}
          onSubmit={() => createReply.mutate(replyBody.trim(), { onSuccess: () => { setReplying(false); setReplyBody(''); setSubmitted(true); } })}
          isSubmitting={createReply.isPending}
          disabled={!replyBody.trim()}
        />
      ) : null}
    </ReviewCard>
  );
}

function ListingReviewReplyEditor({
  value,
  onChange,
  onFocus,
  onCancel,
  onSubmit,
  isSubmitting,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  onFocus: () => void;
  onCancel: () => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  disabled: boolean;
}) {
  const [emojiPickerVisible, setEmojiPickerVisible] = useState(false);

  return (
    <View className="mt-3 gap-2">
      <View className="flex-row items-end gap-2">
        <TextArea
          autoFocus
          value={value}
          onChangeText={onChange}
          onFocus={onFocus}
          maxLength={1500}
          minHeight={72}
          placeholder="Ответ гостю"
          containerStyle={{ flex: 1 }}
          style={{ fontSize: 14, lineHeight: 19 }}
        />
        <IconButton icon="happy-outline" size={38} iconSize={21} onPress={() => setEmojiPickerVisible(true)} accessibilityLabel="Выбрать смайлик" />
      </View>
      <DialogActions
        reset={<Button label="Отмена" mode="soft" tone="neutral" size="md" onPress={onCancel} />}
        primary={<Button label="Отправить" size="md" loading={isSubmitting} disabled={disabled} onPress={onSubmit} />}
      />
      <Text className="text-xs text-ink-muted">Ответ появится после проверки.</Text>

      <BottomSheet
        visible={emojiPickerVisible}
        onClose={() => setEmojiPickerVisible(false)}
        title="Добавить эмодзи"
        subtitle="Выберите символ для ответа"
        icon="happy-outline">
        <View className="py-2">
          <View className="flex-row flex-wrap justify-center gap-3 px-2 pb-2">
            {REVIEW_EMOJI_OPTIONS.map((emoji) => (
              <Pressable key={emoji} onPress={() => { onChange(`${value}${emoji}`); setEmojiPickerVisible(false); }} className="h-12 w-12 items-center justify-center rounded-2xl bg-surface-muted" accessibilityLabel={`Добавить ${emoji}`}>
                <Text className="text-2xl">{emoji}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </BottomSheet>
    </View>
  );
}
