import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui';
import { useCreateReview } from '@/lib/api/reviews';
import { cn } from '@/lib/cn';
import { palette } from '@/theme/tokens';

const MAX_BODY = 1500;

const RATING_LABELS: Record<number, string> = {
  1: 'Ужасно',
  2: 'Плохо',
  3: 'Нормально',
  4: 'Хорошо',
  5: 'Отлично!',
};

export default function LeaveReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const numericId = Number(id);
  const createReview = useCreateReview(numericId);

  const [rating, setRating] = useState(0);
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState(false);

  const canSubmit = rating >= 1 && body.trim().length > 0 && !createReview.isPending;

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
          if (router.canGoBack()) router.back();
          router.replace({ pathname: '/reviews/[id]', params: { id } });
        },
        onError: () => setError('Не удалось отправить отзыв. Пожалуйста, попробуйте еще раз.'),
      },
    );
  };

  return (
    <View className="flex-1 bg-surface-muted">
      <SafeAreaView edges={['top']} className="flex-1">
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-3 bg-surface border-b border-line">
          <Pressable
            onPress={() => router.back()}
            accessibilityLabel="Назад"
            className="h-10 w-10 items-center justify-center rounded-full bg-surface-muted active:opacity-70">
            <Ionicons name="chevron-back" size={22} color={palette.ink} />
          </Pressable>
          <Text className="text-lg font-extrabold text-ink">Оставить отзыв</Text>
          <View className="h-10 w-10" />
        </View>

        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerClassName="gap-4 px-4 pt-5 pb-8"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            
            {/* Rating Card */}
            <View className="bg-surface p-5 rounded-card border border-line gap-4" style={{ shadowColor: palette.ink, shadowOpacity: 0.02, shadowRadius: 10 }}>
              <View className="items-center gap-1">
                <Text className="text-base font-extrabold text-ink">Как прошло ваше проживание?</Text>
                <Text className="text-sm text-ink-secondary text-center leading-5">
                  Пожалуйста, оцените жилье по шкале от 1 до 5
                </Text>
              </View>

              <View className="flex-row justify-center gap-3 py-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Pressable
                    key={star}
                    accessibilityRole="button"
                    accessibilityLabel={`${star} звёзд`}
                    hitSlop={8}
                    onPress={() => setRating(star)}
                    className="active:scale-90"
                  >
                    <Ionicons
                      name={star <= rating ? 'star' : 'star-outline'}
                      size={44}
                      color={star <= rating ? palette.star : palette.inkMuted}
                    />
                  </Pressable>
                ))}
              </View>

              {rating > 0 ? (
                <View className="items-center">
                  <Text className="text-base font-extrabold text-primary">
                    {RATING_LABELS[rating]}
                  </Text>
                </View>
              ) : null}
            </View>

            {/* Comment Card */}
            <View className="bg-surface p-5 rounded-card border border-line gap-4" style={{ shadowColor: palette.ink, shadowOpacity: 0.02, shadowRadius: 10 }}>
              <View className="gap-1">
                <Text className="text-base font-extrabold text-ink">Расскажите подробнее</Text>
                <Text className="text-sm text-ink-secondary leading-5">
                  Поделитесь вашими впечатлениями о чистоте, удобстве и общении с хозяином
                </Text>
              </View>

              <View className="gap-2">
                <TextInput
                  value={body}
                  onChangeText={setBody}
                  multiline
                  maxLength={MAX_BODY}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  placeholder="Напишите ваш отзыв..."
                  placeholderTextColor={palette.inkMuted}
                  className={cn(
                    "min-h-36 rounded-field border bg-surface p-4 text-base text-ink",
                    isFocused ? "border-primary border-[2px]" : "border-line"
                  )}
                  style={{ textAlignVertical: 'top' }}
                />
                <Text className="text-right text-xs text-ink-muted">
                  {body.length} / {MAX_BODY}
                </Text>
              </View>
            </View>

            {error ? (
              <Text className="text-sm font-semibold text-danger text-center px-4">
                {error}
              </Text>
            ) : null}
          </ScrollView>

          {/* Footer */}
          <View className="bg-surface border-t border-line px-4 py-4">
            <Button
              label="Отправить отзыв"
              loading={createReview.isPending}
              disabled={!canSubmit}
              onPress={onSubmit}
            />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

