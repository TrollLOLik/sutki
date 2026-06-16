import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { z } from 'zod';

import { Button, Input, ScreenContainer } from '@/components/ui';
import { useRequestEmailCode } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';

const schema = z.object({
  email: z.string().trim().email('Введите корректный email'),
});

type FormValues = z.infer<typeof schema>;

export default function EmailScreen() {
  const {
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { email: '' } });
  const requestCode = useRequestEmailCode();

  const onSubmit = handleSubmit(async ({ email }) => {
    const normalized = email.trim().toLowerCase();
    try {
      const res = await requestCode.mutateAsync(normalized);
      router.push({ pathname: '/code', params: { email: normalized, devCode: res.dev_code ?? '' } });
    } catch (err) {
      const message =
        err instanceof ApiError && err.status === 429
          ? 'Слишком частый запрос. Подождите минуту и попробуйте снова.'
          : err instanceof ApiError
            ? err.message
            : 'Не удалось отправить код. Проверьте соединение.';
      setError('email', { message });
    }
  });

  return (
    <ScreenContainer centered>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1">
        <View className="flex-1 gap-6 pt-6">
          <View className="gap-2">
            <Text className="text-2xl font-bold text-ink">Введите email</Text>
            <Text className="text-base text-ink-secondary">
              Отправим письмо с кодом подтверждения.
            </Text>
          </View>

          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                icon="mail-outline"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                placeholder="you@example.com"
                autoFocus
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.email?.message}
              />
            )}
          />
        </View>

        <View className="pb-6">
          <Button label="Получить код" loading={requestCode.isPending} onPress={onSubmit} />
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}
