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
import { palette } from '@/theme/tokens';

const MAX_BODY = 1500;

export default function LeaveReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const numericId = Number(id);
  const createReview = useCreateReview(numericId);

  const [rating, setRating] = useState(0);
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);

  const canSubmit = rating >= 1 && body.trim().length > 0 && !createReview.isPending;

  const onSubmit = () => {
    setError(null);
    if (rating < 1) {
      setError('Поставьте оценку от 1 до 5 звёзд.');
      return;
    }
    if (body.trim().length === 0) {
      setError('Напишите пару слов об объекте.');
      return;
    }
    createReview.mutate(
      { rating, body: body.trim() },
      {
        onSuccess: () => {
          if (router.canGoBack()) router.back();
          router.replace({ pathname: '/reviews/[id]', params: { id } });
        },
        onError: () => setError('Не удалось отправить отзыв. Попробуйте ещё раз.'),
      },
    );
  };

  return (
    <View className="flex-1 bg-surface">
      <SafeAreaView edges={['top']} className="flex-1">
        <View className="flex-row items-center gap-3 px-4 py-2">
          <Pressable
            onPress={() => router.back()}
            accessibilityLabel="Назад"
            className="h-10 w-10 items-center justify-center rounded-full bg-surface-muted">
            <Ionicons name="chevron-back" size={22} color={palette.ink} />
          </Pressable>
          <Text className="text-lg font-semibold text-ink">Оставить отзыв</Text>
        </View>

        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerClassName="gap-5 px-4 pt-4 pb-6"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <View className="gap-2">
              <Text className="text-base font-semibold text-ink">Ваша оценка</Text>
              <View className="flex-row gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Pressable
                    key={star}
                    accessibilityRole="button"
                    accessibilityLabel={`${star} звёзд`}
                    hitSlop={6}
                    onPress={() => setRating(star)}>
                    <Ionicons
                      name={star <= rating ? 'star' : 'star-outline'}
                      size={40}
                      color={palette.star}
                    />
                  </Pressable>
                ))}
              </View>
            </View>

            <View className="gap-2">
              <Text className="text-base font-semibold text-ink">Комментарий</Text>
              <TextInput
                value={body}
                onChangeText={setBody}
                multiline
                maxLength={MAX_BODY}
                placeholder="Расскажите, как прошло проживание"
                placeholderTextColor={palette.inkMuted}
                className="min-h-32 rounded-field border border-line bg-surface p-4 text-base text-ink"
                style={{ textAlignVertical: 'top' }}
              />
              <Text className="text-right text-xs text-ink-muted">
                {body.length}/{MAX_BODY}
              </Text>
            </View>

            {error ? <Text className="text-sm font-medium text-danger">{error}</Text> : null}
          </ScrollView>

          <View className="border-t border-line px-4 py-3">
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
