import { Ionicons } from '@expo/vector-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
	Image,
	Text,
	TouchableOpacity,
	View,
} from 'react-native';
import { z } from 'zod';
import * as ImagePicker from 'expo-image-picker';

import { Button, Input, PickerField, ScreenContainer } from '@/components/ui';
import { BirthdayPickerSheet, formatBirthday } from '@/components/BirthdayPickerSheet';
import { CityPickerSheet } from '@/components/CityPickerSheet';
import { KeyboardAwareForm } from '@/components/KeyboardAwareForm';
import { useDeleteMe, useUpdateMe } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';
import { presignMediaUpload, uploadToS3 } from '@/lib/api/media';
import { env } from '@/lib/env';
import { useSessionStore } from '@/store/session';
import { useAppTheme } from '@/theme/useAppTheme';
import type { User } from '@/types/user';
import { getGlobalFromBooking, setGlobalFromBooking } from '@/lib/requireAuth';
import { appAlert as Alert } from '@/components/AppAlert';

const detectCityByIP = async (): Promise<string | null> => {
  try {
    const response = await fetch(`${env.apiUrl}/api/v1/cities/iplocate`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });
    if (response.ok) {
      const data = await response.json();
      if (data && data.location && data.location.data && data.location.data.city) {
        return data.location.data.city;
      }
    }
  } catch (err) {
    console.error('Failed to detect city by IP:', err);
  }
  return null;
};

const schema = z.object({
  name: z.string().trim().min(2, 'Введите имя'),
  surname: z.string().trim().optional(),
  city: z.string().trim().min(2, 'Выберите город'),
  birthday: z.string().trim().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function ProfileSetupScreen() {
  const { palette } = useAppTheme();
  const completeOnboarding = useSessionStore((s) => s.completeOnboarding);
  const signOut = useSessionStore((s) => s.signOut);
  const updateMe = useUpdateMe();
  const deleteMe = useDeleteMe();

  const handleBack = async () => {
    try {
      await deleteMe.mutateAsync();
    } catch (err) {
      console.error('Failed to delete incomplete user record:', err);
    }
    await signOut();
  };

  const [createdUser, setCreatedUser] = useState<User | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Modal States
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [cityPickerVisible, setCityPickerVisible] = useState(false);



  const {
    control,
    handleSubmit,
    setValue,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', surname: '', city: '', birthday: '' },
  });

  const nameVal = watch('name');
  const cityVal = watch('city');
  const birthdayVal = watch('birthday');

  const openDatePicker = () => {
    setDatePickerVisible(true);
  };

  const closeDatePicker = () => {
    setDatePickerVisible(false);
  };

  const openCityPicker = () => {
    setCityPickerVisible(true);
  };

  const closeCityPicker = () => {
    setCityPickerVisible(false);
  };

  // Auto-detect city by IP on first load
  useEffect(() => {
    const autoDetect = async () => {
      const detected = await detectCityByIP();
      if (detected) {
        setValue('city', detected);
      }
    };
    autoDetect();
  }, []);


  const pickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Разрешение отклонено', 'Нам нужен доступ к галерее для выбора фото.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setAvatarUri(result.assets[0].uri);
    }
  };

  const handleAvatarPress = async () => {
    if (avatarUri) {
      Alert.alert('Фото профиля', 'Что вы хотите сделать?', [
        { text: 'Выбрать из галереи', onPress: pickAvatar },
        { text: 'Удалить фото', style: 'destructive', onPress: () => setAvatarUri(null) },
        { text: 'Отмена', style: 'cancel' },
      ]);
    } else {
      await pickAvatar();
    }
  };

  const onSubmit = handleSubmit(async ({ name, surname, city, birthday }) => {
    setUploading(true);
    try {
      let finalAvatarUrl = '';
      if (avatarUri) {
        if (avatarUri.startsWith('file://') || avatarUri.startsWith('content://')) {
          const fileName = avatarUri.split('/').pop() || 'avatar.jpg';
          const ext = fileName.split('.').pop() || 'jpg';
          const mimeType = `image/${ext === 'png' ? 'png' : ext === 'webp' ? 'webp' : 'jpeg'}`;
          const size = 1024 * 1024; // fallback size

          const target = await presignMediaUpload(fileName, size, mimeType, 'avatar');
          await uploadToS3(avatarUri, target, fileName, mimeType);
          finalAvatarUrl = target.key;
        } else {
          finalAvatarUrl = avatarUri;
        }
      }

      const user = await updateMe.mutateAsync({
        name,
        surname: surname || undefined,
        city,
        birthday: birthday || undefined,
        avatar_url: finalAvatarUrl || '',
      });

      setCreatedUser(user);
      setIsCompleted(true);
    } catch (err) {
      console.error('[Onboarding] Error submitting profile:', err);
      setError('name', {
        message: err instanceof ApiError ? err.message : 'Не удалось сохранить профиль.',
      });
    } finally {
      setUploading(false);
    }
  });

  const handleSelectCity = (city: string) => {
    setValue('city', city);
    closeCityPicker();
  };

  // 1. Redirection / Completion view
  if (isCompleted && createdUser) {
    return (
      <ScreenContainer centered>
        <View className="flex-1 items-center justify-center gap-6 px-4">
          <View className="relative items-center justify-center">
            {/* Visual Confetti / Circles background */}
            <View
              className="absolute h-32 w-32 rounded-full opacity-10"
              style={{ backgroundColor: palette.primary }}
            />
            <View
              className="absolute h-24 w-24 rounded-full opacity-20"
              style={{ backgroundColor: palette.primary }}
            />
            <Ionicons name="checkmark-circle" size={80} color={palette.primary} />
          </View>

          <View className="items-center gap-2">
            <Text className="text-2xl font-bold text-ink">Профиль создан</Text>
            <Text className="text-center text-base text-ink-secondary">
              Добро пожаловать в «ВИГАЖ»
            </Text>
          </View>
        </View>

        <View className="w-full pb-6 px-4">
          <Button
            label="Начать"
            onPress={() => {
              completeOnboarding(createdUser);
              if (getGlobalFromBooking()) {
                setGlobalFromBooking(false);
                setTimeout(() => {
                  router.replace('/bookings');
                }, 100);
              }
            }}
          />
        </View>
      </ScreenContainer>
    );
  }

  // 2. Form view
  return (
    <ScreenContainer centered>
      {/* Header with back arrow */}
      <View className="w-full flex-row items-center pt-2 px-4">
        <TouchableOpacity
          onPress={handleBack}
          className="h-10 w-10 items-center justify-center rounded-full bg-surface-muted"
        >
          <Ionicons name="arrow-back" size={24} color={palette.ink} />
        </TouchableOpacity>
      </View>

      <KeyboardAwareForm
        contentContainerClassName="flex-grow gap-6 px-4 pb-8"
        footer={(
          <View className="w-full bg-surface px-4 pb-6 pt-3">
            <Button
              label="Продолжить"
              loading={isSubmitting || uploading}
              onPress={onSubmit}
              disabled={!nameVal || !cityVal || uploading}
            />
          </View>
        )}>
        {/* Centered title & subtitle */}
        <View className="items-center gap-2 mt-2">
          <Text className="text-2xl font-bold text-ink text-center">Создание профиля</Text>
          <Text className="text-base text-ink-secondary text-center">
            Расскажите немного о себе
          </Text>
        </View>

        {/* Interactive Avatar Placeholder */}
        <View className="items-center my-2">
          <TouchableOpacity
            onPress={handleAvatarPress}
            activeOpacity={0.8}
            className="relative h-24 w-24 items-center justify-center rounded-full bg-surface-muted border border-line"
          >
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} className="h-24 w-24 rounded-full" />
            ) : (
              <Ionicons name="person" size={44} color={palette.inkMuted} />
            )}
            <View
              className="absolute bottom-0 right-0 h-8 w-8 items-center justify-center rounded-full border border-white"
              style={{ backgroundColor: palette.primary }}
            >
              <Ionicons name="camera" size={16} color="#FFF" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Form Fields */}
        <View className="gap-4">
          {/* Name input */}
          <View className="w-full">
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
                  after={value.length > 0 ? (
                    <TouchableOpacity onPress={() => setValue('name', '')} hitSlop={8}>
                      <Ionicons name="close-circle" size={18} color={palette.inkMuted} />
                    </TouchableOpacity>
                  ) : null}
                />
              )}
            />
          </View>

          {/* Surname input */}
          <View className="w-full">
            <Controller
              control={control}
              name="surname"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  icon="person-outline"
                  placeholder="Фамилия (необязательно)"
                  value={value || ''}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.surname?.message}
                  after={value && value.length > 0 ? (
                    <TouchableOpacity onPress={() => setValue('surname', '')} hitSlop={8}>
                      <Ionicons name="close-circle" size={18} color={palette.inkMuted} />
                    </TouchableOpacity>
                  ) : null}
                />
              )}
            />
          </View>

          {/* Birthday Input (Pressable) */}
          <PickerField
            value={birthdayVal ? formatBirthday(birthdayVal) : null}
            placeholder="Дата рождения (необязательно)"
            icon="calendar-outline"
            onPress={openDatePicker}
          />

          {/* City Input (Pressable) */}
          <PickerField
            value={cityVal}
            placeholder="Город"
            icon="location-outline"
            error={errors.city?.message}
            onPress={openCityPicker}
          />
        </View>
      </KeyboardAwareForm>

      <BirthdayPickerSheet
        visible={datePickerVisible}
        onClose={closeDatePicker}
        onApply={(isoDate) => {
          setValue('birthday', isoDate);
          closeDatePicker();
        }}
        initialValue={birthdayVal}
      />

      {/* City Autocomplete Bottom Sheet Modal */}
      <CityPickerSheet
        visible={cityPickerVisible}
        onClose={closeCityPicker}
        onSelect={(city) => {
          if (city) {
            handleSelectCity(city);
          } else {
            closeCityPicker();
          }
        }}
        selectedCity={cityVal}
      />
    </ScreenContainer>
  );
}
