import { zodResolver } from '@hookform/resolvers/zod';
import { router, useLocalSearchParams } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

import { AuthStepScreen } from '@/components/auth/AuthStepScreen';
import { Button, Input } from '@/components/ui';
import { useRequestEmailCode } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';

const schema = z.object({
  email: z.string().trim().email('Введите корректный email'),
});

type FormValues = z.infer<typeof schema>;

export default function EmailScreen() {
  const { fromBooking } = useLocalSearchParams<{ fromBooking?: string }>();
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
      router.push({
        pathname: '/code',
        params: {
          email: normalized,
          devCode: res.dev_code ?? '',
          fromBooking: fromBooking ?? '',
        },
      });
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
    <AuthStepScreen
      icon="mail-outline"
      title="Введите email"
      description="Отправим одноразовый код для безопасного входа. Пароль создавать не понадобится."
      footer={(
        <Button
          label="Получить код"
          icon="arrow-forward"
          loading={requestCode.isPending}
          onPress={onSubmit}
        />
      )}>
      <Controller
        control={control}
        name="email"
        render={({ field: { onChange, onBlur, value } }) => (
          <Input
            icon="mail-outline"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            placeholder="name@example.com"
            autoFocus
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            error={errors.email?.message}
          />
        )}
      />
    </AuthStepScreen>
  );
}
