import { zodResolver } from '@hookform/resolvers/zod';
import { router, useLocalSearchParams } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { z } from 'zod';

import { Button, ScreenContainer } from '@/components/ui';
import { PhoneInput } from '@/components/PhoneInput';
import { useRequestPhoneCode } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';
import { toFullPhone } from '@/lib/phone';

const schema = z.object({
  phone: z.string().refine((value) => value.replace(/\D/g, '').length === 10, 'Укажите полный номер телефона (10 цифр)'),
});

type FormValues = z.infer<typeof schema>;

export default function PhoneScreen() {
  const { fromBooking } = useLocalSearchParams<{ fromBooking?: string }>();
  const { control, handleSubmit, setError, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { phone: '' },
  });
  const requestPhoneCode = useRequestPhoneCode();

  const onSubmit = handleSubmit(async ({ phone }) => {
    const fullPhone = toFullPhone(phone);
    try {
      const response = await requestPhoneCode.mutateAsync({ phone: fullPhone });
      router.push({
        pathname: '/code',
        params: {
          phone: fullPhone,
          challengeId: response.challenge_id ?? '',
          deliveryMode: response.delivery_mode ?? 'flash_call',
          codeLength: String(response.code_length ?? 4),
          devCode: response.dev_code ?? '',
          fromBooking: fromBooking ?? '',
        },
      });
    } catch (err) {
      setError('phone', {
        message: err instanceof ApiError && err.status === 429
          ? 'Слишком частый запрос. Подождите немного.'
          : err instanceof ApiError ? err.message : 'Не удалось отправить запрос. Проверьте соединение.',
      });
    }
  });

  return (
    <ScreenContainer centered>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <View className="flex-1 gap-6 pt-6">
          <View className="gap-2">
            <Text className="text-2xl font-bold text-ink">Введите номер телефона</Text>
            <Text className="text-base text-ink-secondary">
              Вам поступит звонок. Введите последние 4 цифры номера входящего вызова.
            </Text>
          </View>
          <Controller
            control={control}
            name="phone"
            render={({ field: { onChange, onBlur, value } }) => (
              <PhoneInput value={value} onChange={onChange} onBlur={onBlur} error={errors.phone?.message} />
            )}
          />
        </View>
        <View className="pb-6">
          <Button label="Получить звонок" loading={requestPhoneCode.isPending} onPress={onSubmit} />
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}
