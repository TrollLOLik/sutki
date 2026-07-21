import { Ionicons } from '@expo/vector-icons';
import { parseISO } from 'date-fns';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useMemo, useRef, useState } from 'react';
import { EmptyState } from '@/components/EmptyState';
import { Stars } from '@/components/Stars';
import { BottomSheet, Button, IconButton, MaterialSurface } from '@/components/ui';
import { useMyListings } from '@/lib/api/create-listing';
import { useReviews, useHostReviews, useCreateReviewReply } from '@/lib/api/reviews';
import { formatDateRu, formatRating, formatReviewsCount } from '@/lib/format';
import { useSessionStore } from '@/store/session';
import { useAppTheme } from '@/theme/useAppTheme';
import type { Review, ReviewSummary } from '@/types/review';
import { NavigationBackButton } from '@/components/NavigationBackButton';

const REVIEW_EMOJI_OPTIONS = [
  '\u{1F600}', '\u{1F60A}', '\u{1F642}', '\u{1F60D}',
  '\u{1F602}', '\u{1F44D}', '\u{1F64F}', '\u{1F44C}',
  '\u{1F525}', '\u{2764}\u{FE0F}', '\u{1F389}', '\u{1F3E0}',
  '\u{1F4CD}', '\u{2705}', '\u{1F64C}', '\u{2600}\u{FE0F}',
];

export default function ReviewsScreen() {
  const { palette, isDark } = useAppTheme();
  const screenBackground = isDark ? '#0D0F12' : '#F4F5F7';
  const headerBackground = isDark ? '#14161B' : '#FFFFFF';
  const { id, isHost } = useLocalSearchParams<{ id: string; isHost?: string }>();
  const numericId = Number(id);
  const reviewsListRef = useRef<FlatList<Review>>(null);
  const { data, isLoading, isError, refetch, isRefetching } = isHost === 'true'
    ? useHostReviews(numericId, { limit: 50 })
    : useReviews(numericId, { limit: 50 });

  const { status: authStatus } = useSessionStore();
  const isAuthenticated = authStatus === 'authenticated';
  const { data: myListingsData } = useMyListings({ limit: 100 }, { enabled: isAuthenticated && isHost !== 'true' });

  const isOwnListing = useMemo(() => {
    if (isHost === 'true' || !myListingsData || !numericId) return false;
    return myListingsData.items.some((item) => item.id === numericId);
  }, [myListingsData, numericId, isHost]);

  const summary = data?.summary;
  const items = data?.items ?? [];

  const scrollReplyAboveKeyboard = (inputHandle: number) => {
    setTimeout(() => {
      const responder = reviewsListRef.current?.getScrollResponder() as unknown as
        | { scrollResponderScrollNativeHandleToKeyboard: (handle: number, offset: number, preventNegativeScrollOffset: boolean) => void }
        | undefined;
      responder?.scrollResponderScrollNativeHandleToKeyboard(inputHandle, 128, true);
    }, 300);
  };


  return (
    <View className="flex-1" style={{ backgroundColor: headerBackground }}>
      <SafeAreaView edges={['top', 'bottom']} className="flex-1" style={{ backgroundColor: headerBackground }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1"
          style={{ backgroundColor: screenBackground }}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
        >
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
              renderItem={({ item }) => (
                <ReviewRow
                  review={item}
                  canReply={isOwnListing}
                  onReplyFocus={scrollReplyAboveKeyboard}
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
                    label="Оставить заявку"
                    onPress={() => router.push({ pathname: '/booking/[id]', params: { id } })}
                  />
                )}
              </View>
            ) : null}

          </>
        )}
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

function ReviewRow({ review, canReply, onReplyFocus }: { review: Review; canReply: boolean; onReplyFocus: (inputHandle: number) => void }) {
  const { palette } = useAppTheme();
  const [replying,setReplying]=useState(false);
  const [replyBody,setReplyBody]=useState('');
  const [submitted,setSubmitted]=useState(false);
  const createReply=useCreateReviewReply(review.id);
  const date = review.created_at ? parseISO(review.created_at) : null;
  return (
    <MaterialSurface level="raised" radius={20} className="mb-3 p-4">
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
        <View className="flex-row items-center gap-1 rounded-full bg-primary-light px-2.5 py-1.5">
          <Ionicons name="star" size={14} color={palette.primary} />
          <Text className="text-sm font-bold text-ink">{formatRating(review.rating)}</Text>
        </View>
      </View>
      {review.body ? (
        <Text className="mt-3 text-[15px] leading-6 text-ink">{review.body}</Text>
      ) : null}
      {review.reply?.status === 'active' ? (
        <View className="mt-3 rounded-2xl bg-primary-light p-3.5">
          <View className="flex-row items-center gap-2">
            <Ionicons name="chatbubble-ellipses-outline" size={16} color={palette.primary} />
            <Text className="text-xs font-bold text-primary">Ответ владельца</Text>
          </View>
          <Text className="mt-2 text-sm leading-5 text-ink-secondary">{review.reply.body}</Text>
        </View>
      ) : submitted || (canReply && review.reply?.status === 'pending_moderation') ? (
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
    </MaterialSurface>
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
  onFocus: (inputHandle: number) => void;
  onCancel: () => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  disabled: boolean;
}) {
  const { palette } = useAppTheme();
  const [emojiPickerVisible, setEmojiPickerVisible] = useState(false);

  return (
    <View className="mt-3 gap-2">
      <View className="flex-row items-end gap-2 rounded-field border border-line bg-surface-muted px-3 py-2">
        <TextInput
          autoFocus
          value={value}
          onChangeText={onChange}
          onFocus={(event) => onFocus(event.nativeEvent.target)}
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
        <View className="flex-1"><Button label="Отмена" variant="secondary" size="md" onPress={onCancel} /></View>
        <View className="flex-1"><Button label="Отправить" size="md" loading={isSubmitting} disabled={disabled} onPress={onSubmit} /></View>
      </View>
      <Text className="text-xs text-ink-muted">Ответ появится после проверки.</Text>

      <BottomSheet visible={emojiPickerVisible} onClose={() => setEmojiPickerVisible(false)}>
        <View className="py-2">
          <Text className="mb-5 text-center text-lg font-bold text-ink">Смайлик</Text>
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
