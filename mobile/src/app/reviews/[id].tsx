import { Ionicons } from '@expo/vector-icons';
import { parseISO } from 'date-fns';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useMemo, useRef, useState } from 'react';
import { EmptyState } from '@/components/EmptyState';
import { Stars } from '@/components/Stars';
import { BottomSheet, Button } from '@/components/ui';
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
  const { palette } = useAppTheme();
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
    <View className="flex-1 bg-surface">
      <SafeAreaView edges={['top', 'bottom']} className="flex-1">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1"
          keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
        >
        {/* Header with centered title */}
        <View className="flex-row items-center justify-between px-4 py-2 relative h-14 bg-surface border-b border-line">
          <NavigationBackButton
            fallback={{ pathname: '/listing/[id]', params: { id } }}
            className="h-10 w-10 items-center justify-center rounded-full bg-surface-muted z-10"
          />
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
              ref={reviewsListRef}
              data={items}
              keyExtractor={(item) => String(item.id)}
              contentContainerClassName="px-4 pb-6"
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

function ReviewRow({ review, canReply, onReplyFocus }: { review: Review; canReply: boolean; onReplyFocus: (inputHandle: number) => void }) {
  const { palette } = useAppTheme();
  const [replying,setReplying]=useState(false);
  const [replyBody,setReplyBody]=useState('');
  const [submitted,setSubmitted]=useState(false);
  const createReply=useCreateReviewReply(review.id);
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
      {review.reply?.status === 'active' ? (
        <View className="ml-5 mt-3 border-l-2 border-primary pl-3">
          <Text className="text-xs font-bold text-primary">Ответ владельца</Text>
          <Text className="mt-1 text-sm leading-5 text-ink-secondary">{review.reply.body}</Text>
        </View>
      ) : submitted || (canReply && review.reply?.status === 'pending_moderation') ? (
        <Text className="mt-3 text-xs font-semibold text-primary">Ответ отправлен на проверку</Text>
      ) : canReply && review.reply?.status === 'moderation_review' ? (
        <Text className="mt-3 text-xs font-semibold text-primary">Ответ проходит дополнительную проверку</Text>
      ) : canReply && review.reply?.status === 'rejected' ? (
        <Text className="mt-3 text-xs font-semibold text-danger">Ответ отклонён</Text>
      ) : canReply && !replying ? (
        <Pressable onPress={()=>setReplying(true)} className="mt-3 self-start"><Text className="text-sm font-bold text-primary">Ответить</Text></Pressable>
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
      {false && canReply && replying && !review.reply && !submitted ? (
        <View className="mt-3 gap-2">
          <TextInput value={replyBody} onChangeText={setReplyBody} multiline maxLength={1500} placeholder="Ответ гостю" placeholderTextColor={palette.inkMuted} className="min-h-20 rounded-field border border-line bg-surface-muted p-3 text-sm text-ink" />
          <View className="flex-row gap-2"><View className="flex-1"><Button label="Отмена" variant="secondary" size="md" onPress={()=>{setReplying(false);setReplyBody('')}} /></View><View className="flex-1"><Button label="Отправить" size="md" loading={createReply.isPending} disabled={!replyBody.trim()} onPress={()=>createReply.mutate(replyBody.trim(),{onSuccess:()=>{setReplying(false);setReplyBody('');setSubmitted(true)}})} /></View></View>
          <Text className="text-xs text-ink-muted">Ответ появится после проверки.</Text>
        </View>
      ) : null}
    </View>
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
        <Pressable onPress={() => setEmojiPickerVisible(true)} className="h-9 w-9 items-center justify-center rounded-full" accessibilityLabel="Выбрать смайлик">
          <Ionicons name="happy-outline" size={22} color={palette.inkSecondary} />
        </Pressable>
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
