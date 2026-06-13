import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { Text, View } from 'react-native';
import { z } from 'zod';

import { Button, Input, ScreenContainer } from '@/components/ui';
import { useUpdateMe } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';
import { useSessionStore } from '@/store/session';

const schema = z.object({
  name: z.string().min(2, 'Введите имя'),
  city: z.string().min(2, 'Укажите город'),
});

type FormValues = z.infer<typeof schema>;

export default function ProfileSetupScreen() {
  const completeOnboarding = useSessionStore((s) => s.completeOnboarding);
  const updateMe = useUpdateMe();

  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { name: '', city: '' } });

  const onSubmit = handleSubmit(async ({ name, city }) => {
    try {
      const user = await updateMe.mutateAsync({ name, city });
      completeOnboarding(user);
    } catch (err) {
      setError('name', {
        message: err instanceof ApiError ? err.message : 'Не удалось сохранить профиль.',
      });
    }
  });

  return (
    <ScreenContainer centered>
      <View className="flex-1 gap-4 pt-6">
        <Text className="text-base text-ink-secondary">Расскажите немного о себе.</Text>

        <Controller
          control={control}
          name="name"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              icon="person-outline"
              placeholder="Имя"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.name?.message}
            />
          )}
        />

        <Controller
          control={control}
          name="city"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              icon="location-outline"
              placeholder="Город"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.city?.message}
            />
          )}
        />
      </View>

      <View className="pb-6">
        <Button label="Создать профиль" loading={isSubmitting} onPress={onSubmit} />
      </View>
    </ScreenContainer>
  );
}
