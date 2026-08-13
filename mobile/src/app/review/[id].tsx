import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useState, useEffect, useRef } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { KeyboardAwareForm } from '@/components/KeyboardAwareForm';
import { AppHeader, Button, InlineAlert, MaterialSurface, StickyActionBar, TextArea } from '@/components/ui';
import { useCreateReview, useReviewEligibility } from '@/lib/api/reviews';
import { ApiError } from '@/lib/api/client';
import { useAppTheme } from '@/theme/useAppTheme';
import { goBackOrReplace } from '@/lib/navigation';
import { reportInvariant } from '@/lib/observability';

const MAX_BODY = 1500;

const RATING_LABELS: Record<number, string> = {
  1: 'Ужасно',
  2: 'Плохо',
  3: 'Нормально',
  4: 'Хорошо',
  5: 'Отлично!',
};

export default function LeaveReviewScreen() {
  const { palette, isDark } = useAppTheme();
  const screenBackground = isDark ? '#0D0F12' : '#F4F5F7';
  const headerBackground = isDark ? '#14161B' : '#FFFFFF';
  const { id } = useLocalSearchParams<{ id: string }>();
  const numericId = Number(id);
  const createReview = useCreateReview(numericId);
  const eligibility = useReviewEligibility(numericId);
  const elig = eligibility.data;

  const [rating, setRating] = useState(0);
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const reportedRequestMismatch = useRef<string | null>(null);

  useEffect(() => {
    const canEditExisting =
      elig?.request_id === numericId &&
      elig?.can_review === true &&
      (elig.review_status === 'rejected' || elig.review_status === 'moderation_review');

    setRating(canEditExisting ? (elig.review_rating ?? 0) : 0);
    setBody(canEditExisting ? (elig.review_body ?? '') : '');
    setError(null);
  }, [numericId, elig?.request_id, elig?.review_id, elig?.review_status, elig?.can_review]);

  useEffect(() => {
    if (!elig || elig.request_id === numericId) return;
    const reportKey = `${numericId}:${elig.request_id}`;
    if (reportedRequestMismatch.current === reportKey) return;
    reportedRequestMismatch.current = reportKey;
    reportInvariant('Review eligibility returned a different request', {
      component: 'leave-review',
      operation: 'request-mismatch',
    });
  }, [elig, numericId]);

  const onSubmit = () => {
    setError(null);
    if (!elig || elig.request_id !== numericId || !elig.can_review) {
      setError('Для этой заявки сейчас нельзя оставить отзыв.');
      return;
    }
    if (rating < 1) {
      setError('Пожалуйста, поставьте оценку.');
      return;
    }
    if (body.trim().length === 0) {
      setError('Напишите комментарий о вашем проживании.');
      return;
    }
    createReview.mutate(
      { rating, body: body.trim() },
      {
        onSuccess: () => {
          goBackOrReplace('/bookings');
        },
        onError: (err) => {
          setError(
            err instanceof ApiError
              ? err.message
              : 'Не удалось отправить отзыв. Пожалуйста, попробуйте еще раз.',
          );
        },
      },
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: headerBackground }}>
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: headerBackground }}>
        <AppHeader
          blurred
          fallback="/bookings"
          title={elig?.review_status === 'rejected' || elig?.review_status === 'moderation_review'
            ? 'Изменить отзыв'
            : 'Оставить отзыв'}
        />

        <KeyboardAwareForm
          rootStyle={{ backgroundColor: screenBackground }}
          contentContainerStyle={styles.scrollContent}
          footer={(
            <StickyActionBar>
              <Text
                className={error ? 'text-danger' : 'text-ink-muted'}
                style={styles.footerHint}
                numberOfLines={2}>
                {error ?? (rating < 1 ? 'Поставьте оценку жилью' : body.trim().length === 0 ? 'Добавьте несколько слов о проживании' : 'Отзыв появится после проверки')}
              </Text>
              <Button
                label={
                  elig?.review_status === 'rejected' || elig?.review_status === 'moderation_review'
                    ? 'Сохранить изменения'
                    : 'Отправить отзыв'
                }
                loading={createReview.isPending}
                disabled={
                  createReview.isPending ||
                  eligibility.isLoading ||
                  elig?.can_review !== true ||
                  elig.request_id !== numericId
                }
                onPress={onSubmit}
              />
            </StickyActionBar>
          )}>

            {elig?.review_status === 'rejected' && elig.rejection_reason ? (
              <InlineAlert tone="danger" title="Причина отклонения предыдущего отзыва">
                {elig.rejection_reason}
              </InlineAlert>
            ) : null}

            {elig?.review_status === 'rejected' || elig?.review_status === 'moderation_review' ? (
              <View style={[styles.attemptsBadge, { backgroundColor: palette.primaryLight }]}>
                <Text className="text-xs text-primary font-semibold">
                  Осталось попыток редактирования: {3 - (elig.edit_attempts ?? 0)} из 3
                </Text>
              </View>
            ) : null}
            
            <MaterialSurface level="raised" radius={22} style={styles.ratingCard}>
              <View style={styles.sectionHeading}>
                <View style={[styles.sectionIcon, { backgroundColor: palette.primaryLight }]}>
                  <Ionicons name="sparkles" size={21} color={palette.primary} />
                </View>
                <View style={styles.sectionHeadingText}>
                  <Text className="text-base font-extrabold text-ink">Как прошло проживание?</Text>
                  <Text className="text-sm leading-5 text-ink-secondary">Поставьте общую оценку жилью</Text>
                </View>
                <Text style={[styles.stepLabel, { color: palette.inkMuted }]}>1 из 2</Text>
              </View>

              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <Pressable
                    key={star}
                    accessibilityRole="button"
                    accessibilityLabel={`${star} звёзд`}
                    hitSlop={8}
                    onPress={() => {
                      setRating(star);
                      setError(null);
                    }}
                    style={({ pressed }) => [styles.starButton, star <= rating ? { backgroundColor: palette.primaryLight } : null, pressed ? styles.pressed : null]}
                  >
                    <Ionicons
                      name={star <= rating ? 'star' : 'star-outline'}
                      size={34}
                      color={star <= rating ? palette.star : palette.inkMuted}
                    />
                  </Pressable>
                ))}
              </View>

              <View className="items-center">
                <Text className={rating > 0 ? 'text-base font-extrabold text-primary' : 'text-sm font-semibold text-ink-muted'}>
                  {rating > 0 ? RATING_LABELS[rating] : 'Нажмите на звезду'}
                </Text>
              </View>
            </MaterialSurface>

            <MaterialSurface level="raised" radius={22} style={styles.commentCard}>
              <View style={styles.sectionHeading}>
                <View style={[styles.sectionIcon, { backgroundColor: palette.primaryLight }]}>
                  <Ionicons name="chatbubble-ellipses" size={20} color={palette.primary} />
                </View>
                <View style={styles.sectionHeadingText}>
                  <Text className="text-base font-extrabold text-ink">Расскажите подробнее</Text>
                  <Text className="text-sm leading-5 text-ink-secondary">Что особенно запомнилось?</Text>
                </View>
                <Text style={[styles.stepLabel, { color: palette.inkMuted }]}>2 из 2</Text>
              </View>

              <View style={styles.aspectRow}>
                {['Чистота', 'Удобство', 'Общение'].map((aspect) => (
                  <View key={aspect} style={[styles.aspectChip, { backgroundColor: palette.surfaceMuted }]}>
                    <Text className="text-xs font-semibold text-ink-secondary">{aspect}</Text>
                  </View>
                ))}
              </View>

              <TextArea
                value={body}
                onChangeText={(value) => {
                  setBody(value);
                  setError(null);
                }}
                maxLength={MAX_BODY}
                minHeight={190}
                showCount
                placeholder="Напишите ваш отзыв..."
              />
            </MaterialSurface>

        </KeyboardAwareForm>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    overflow: 'hidden',
  },
  headerTitle: {
    position: 'absolute',
    left: 84,
    right: 84,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 48,
    height: 48,
  },
  scrollContent: {
    gap: 16,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 28,
  },
  notice: {
    gap: 5,
    padding: 16,
  },
  attemptsBadge: {
    alignSelf: 'center',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  ratingCard: {
    gap: 18,
    paddingHorizontal: 18,
    paddingVertical: 20,
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sectionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeadingText: {
    flex: 1,
    gap: 2,
  },
  stepLabel: {
    alignSelf: 'flex-start',
    paddingTop: 2,
    fontSize: 11,
    fontWeight: '700',
  },
  starsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
  },
  starButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ scale: 1 }],
  },
  pressed: {
    transform: [{ scale: 0.9 }],
  },
  commentCard: {
    gap: 16,
    padding: 18,
  },
  aspectRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  aspectChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 9,
  },
  footerHint: {
    minHeight: 18,
    paddingHorizontal: 4,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
  },
});

