import { zodResolver } from '@hookform/resolvers/zod';
import { router, useLocalSearchParams } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

import { AuthStepScreen } from '@/components/auth/AuthStepScreen';
import { Button } from '@/components/ui';
import { PhoneInput } from '@/components/PhoneInput';
import { useRequestPhoneCode } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';
import { formatPhoneMask, normalizePhoneDigits, toFullPhone } from '@/lib/phone';
import type { RequestCodeResponse } from '@/types/auth';

const schema = z.object({
  phone: z.string().refine((value) => value.replace(/\D/g, '').length === 10, 'Укажите полный номер телефона (10 цифр)'),
});

type FormValues = z.infer<typeof schema>;

export default function PhoneScreen() {
  const { fromBooking, phone: initialPhone } = useLocalSearchParams<{ fromBooking?: string; phone?: string }>();
  const { control, handleSubmit, setError, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { phone: formatPhoneMask(normalizePhoneDigits(initialPhone ?? '')) },
  });
  const requestPhoneCode = useRequestPhoneCode();

  const onSubmit = handleSubmit(async ({ phone }) => {
    const fullPhone = toFullPhone(phone);
    let response: RequestCodeResponse;

    try {
      response = await requestPhoneCode.mutateAsync({ phone: fullPhone });
    } catch (err) {
      console.error('[phone-auth] Failed to request phone challenge', err);
      setError('phone', {
        message: err instanceof ApiError && err.status === 429
          ? 'Слишком частый запрос. Подождите немного.'
          : err instanceof ApiError ? err.message : 'Не удалось отправить запрос. Проверьте соединение.',
      });
      return;
    }

    if (!response.challenge_id) {
      console.error('[phone-auth] Challenge response has no challenge_id', response);
      setError('phone', { message: 'Сервер не вернул данные звонка. Попробуйте ещё раз.' });
      return;
    }

    router.push({
      pathname: '/code',
      params: {
        phone: fullPhone,
        challengeId: response.challenge_id,
        deliveryMode: response.delivery_mode ?? 'flash_call',
        codeLength: String(response.code_length ?? 4),
        devCode: response.dev_code ?? '',
        fromBooking: fromBooking ?? '',
      },
    });
  });

  return (
    <AuthStepScreen
      icon="call-outline"
      title="Введите номер телефона"
      description="Мы позвоним на указанный номер. Отвечать не нужно — для входа понадобятся последние 4 цифры номера звонящего."
      footer={(
        <Button
          label="Получить звонок"
          icon="call-outline"
          loading={requestPhoneCode.isPending}
          onPress={onSubmit}
        />
      )}>
      <Controller
        control={control}
        name="phone"
        render={({ field: { onChange, onBlur, value } }) => (
          <PhoneInput
            autoFocus
            value={value}
            onChange={onChange}
            onBlur={onBlur}
            error={errors.phone?.message}
          />
        )}
      />
    </AuthStepScreen>
  );
}
