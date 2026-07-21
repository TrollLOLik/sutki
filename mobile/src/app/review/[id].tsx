import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useLocalSearchParams } from 'expo-router';
import { useState, useEffect } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, MaterialSurface } from '@/components/ui';
import { useCreateReview, useMyReviewEligibility } from '@/lib/api/reviews';
import { ApiError } from '@/lib/api/client';
import { useAppTheme } from '@/theme/useAppTheme';
import { goBackOrReplace } from '@/lib/navigation';
import { NavigationBackButton } from '@/components/NavigationBackButton';

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
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const numericId = Number(id);
  const createReview = useCreateReview(numericId);
  const eligibility = useMyReviewEligibility();
  const elig = eligibility.data?.items?.find((item) => item.request_id === numericId);

  const [rating, setRating] = useState(0);
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (elig && elig.review_body && body === '' && rating === 0) {
      setRating(elig.review_rating ?? 0);
      setBody(elig.review_body);
    }
  }, [elig]);

  const onSubmit = () => {
    setError(null);
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
          const msg = err instanceof ApiError ? err.message : '';
          if (msg === 'review unchanged') {
            setError('Текст отзыва не изменился.');
          } else if (msg === 'review attempts exceeded') {
            setError('Вы исчерпали лимит редактирования (максимум 3 раза).');
          } else if (msg === 'review not allowed in current status') {
            setError('Отзыв в текущем статусе нельзя редактировать.');
          } else {
            setError('Не удалось отправить отзыв. Пожалуйста, попробуйте еще раз.');
          }
        },
      },
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: headerBackground }}>
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: headerBackground }}>
        <View style={styles.header}>
          <BlurView intensity={88} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? 'rgba(20,22,27,0.72)' : 'rgba(255,255,255,0.72)' }]} />
          <NavigationBackButton fallback="/bookings" size={48} variant="material" />
          <Text className="text-xl font-extrabold text-ink" style={styles.headerTitle}>
            {elig?.review_status === 'rejected' || elig?.review_status === 'moderation_review'
              ? 'Изменить отзыв'
              : 'Оставить отзыв'}
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1, backgroundColor: screenBackground }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView
            style={{ backgroundColor: screenBackground }}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>

            {elig?.rejection_reason ? (
              <MaterialSurface level="raised" radius={18} style={[styles.notice, { backgroundColor: isDark ? 'rgba(255,77,79,0.10)' : 'rgba(255,77,79,0.07)' }]}>
                <Text className="text-sm font-extrabold text-danger">Причина отклонения предыдущего отзыва:</Text>
                <Text className="text-xs text-danger/90 leading-relaxed">{elig.rejection_reason}</Text>
              </MaterialSurface>
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

              <View className="gap-2">
                <TextInput
                  value={body}
                  onChangeText={(value) => {
                    setBody(value);
                    setError(null);
                  }}
                  multiline
                  maxLength={MAX_BODY}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  placeholder="Напишите ваш отзыв..."
                  placeholderTextColor={palette.inkMuted}
                  className="text-base text-ink"
                  style={[styles.input, { backgroundColor: palette.surface, borderColor: isFocused ? palette.primary : palette.line, borderWidth: isFocused ? 2 : 1 }]}
                />
                <Text className="text-right text-xs text-ink-muted">
                  {body.length} / {MAX_BODY}
                </Text>
              </View>
            </MaterialSurface>

          </ScrollView>

          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12), backgroundColor: isDark ? 'rgba(20,22,27,0.97)' : 'rgba(255,255,255,0.97)', borderColor: palette.line }]}>
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
              disabled={createReview.isPending}
              onPress={onSubmit}
            />
          </View>
        </KeyboardAvoidingView>
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
  input: {
    minHeight: 150,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    textAlignVertical: 'top',
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

