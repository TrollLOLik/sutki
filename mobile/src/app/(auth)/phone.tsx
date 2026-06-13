import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { z } from 'zod';

import { Button, Input, ScreenContainer } from '@/components/ui';

const schema = z.object({
  phone: z
    .string()
    .transform((v) => v.replace(/\D/g, ''))
    .refine((v) => v.length === 10 || v.length === 11, 'Введите корректный номер телефона'),
});

type FormValues = { phone: string };

export default function PhoneScreen() {
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { phone: '' } });

  const onSubmit = handleSubmit(({ phone }) => {
    router.push({ pathname: '/code', params: { phone } });
  });

  return (
    <ScreenContainer centered>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1">
        <View className="flex-1 gap-6 pt-6">
          <View className="gap-2">
            <Text className="text-2xl font-bold text-ink">Введите номер</Text>
            <Text className="text-base text-ink-secondary">
              Отправим SMS с кодом подтверждения.
            </Text>
          </View>

          <Controller
            control={control}
            name="phone"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                icon="call-outline"
                keyboardType="phone-pad"
                placeholder="+7 (___) ___-__-__"
                autoFocus
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.phone?.message}
              />
            )}
          />
        </View>

        <View className="pb-6">
          <Button label="Получить код" onPress={onSubmit} />
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}
