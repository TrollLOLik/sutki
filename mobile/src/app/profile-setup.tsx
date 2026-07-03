import { Ionicons } from '@expo/vector-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useState, useEffect, useRef } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
	Animated,
	Easing,
	Image,
	Modal,
	Pressable,
	ScrollView,
	Text,
	TextInput,
	TouchableOpacity,
	View,
	Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';
import * as ImagePicker from 'expo-image-picker';

import { Button, ScreenContainer, BottomSheet } from '@/components/ui';
import { CityPickerSheet } from '@/components/CityPickerSheet';
import { useDeleteMe, useUpdateMe } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';
import { presignMediaUpload, uploadToS3 } from '@/lib/api/media';
import { env } from '@/lib/env';
import { useSessionStore } from '@/store/session';
import { radii } from '@/theme/tokens';
import { useAppTheme } from '@/theme/useAppTheme';
import type { User } from '@/types/user';
import { getGlobalFromBooking, setGlobalFromBooking } from '@/lib/requireAuth';

// Mock Premium Avatar URL
const MOCK_AVATAR_URL = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&h=300&fit=crop';

const MONTH_NAMES = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
];

const CURRENT_YEAR = new Date().getFullYear();


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

  // ScrollRefs for Date Picker wheels
  const dayScrollRef = useRef<ScrollView>(null);
  const monthScrollRef = useRef<ScrollView>(null);
  const yearScrollRef = useRef<ScrollView>(null);

  // Modal States
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [cityPickerVisible, setCityPickerVisible] = useState(false);

  const [tempDay, setTempDay] = useState(12);
  const [tempMonth, setTempMonth] = useState(4); // May (0-indexed)
  const [tempYear, setTempYear] = useState(CURRENT_YEAR - 20);



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

  // Centering the wheels once bottom sheet slide animation resolves
  useEffect(() => {
    if (datePickerVisible) {
      const timer = setTimeout(() => {
        if (birthdayVal) {
          const parts = birthdayVal.split('.');
          if (parts.length === 3) {
            const d = parseInt(parts[0], 10);
            const m = parseInt(parts[1], 10) - 1;
            const y = parseInt(parts[2], 10);
            dayScrollRef.current?.scrollTo({ y: (d - 1) * 40, animated: false });
            monthScrollRef.current?.scrollTo({ y: m * 40, animated: false });
            yearScrollRef.current?.scrollTo({ y: (CURRENT_YEAR - y) * 40, animated: false });
          }
        } else {
          dayScrollRef.current?.scrollTo({ y: (12 - 1) * 40, animated: false });
          monthScrollRef.current?.scrollTo({ y: 4 * 40, animated: false });
          yearScrollRef.current?.scrollTo({ y: (CURRENT_YEAR - (CURRENT_YEAR - 20)) * 40, animated: false });
        }
      }, 350); // 350ms ensures bottom sheet open animation (250ms) has fully finished
      return () => clearTimeout(timer);
    }
  }, [datePickerVisible, birthdayVal]);

  const openDatePicker = () => {
    if (birthdayVal) {
      const parts = birthdayVal.split('.');
      if (parts.length === 3) {
        const d = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const y = parseInt(parts[2], 10);
        if (!isNaN(d)) setTempDay(d);
        if (!isNaN(m)) setTempMonth(m);
        if (!isNaN(y)) setTempYear(y);
      }
    } else {
      setTempDay(12);
      setTempMonth(4);
      setTempYear(CURRENT_YEAR - 20);
    }
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
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
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

      let formattedBirthday = '';
      if (birthday) {
        const [d, m, y] = birthday.split('.');
        formattedBirthday = `${y}-${m}-${d}`;
      }

      const user = await updateMe.mutateAsync({
        name,
        surname: surname || undefined,
        city,
        birthday: formattedBirthday || undefined,
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

  const handleSelectDay = (d: number) => {
    setTempDay(d);
    dayScrollRef.current?.scrollTo({ y: (d - 1) * 40, animated: true });
  };

  const handleSelectMonth = (m: number) => {
    setTempMonth(m);
    monthScrollRef.current?.scrollTo({ y: m * 40, animated: true });
  };

  const handleSelectYear = (y: number) => {
    setTempYear(y);
    yearScrollRef.current?.scrollTo({ y: (CURRENT_YEAR - y) * 40, animated: true });
  };

  const handleApplyDate = () => {
    const dStr = tempDay.toString().padStart(2, '0');
    const mStr = (tempMonth + 1).toString().padStart(2, '0');
    const bday = `${dStr}.${mStr}.${tempYear}`;
    setValue('birthday', bday);
    closeDatePicker();
  };

  const handleSelectCity = (city: string) => {
    setValue('city', city);
    closeCityPicker();
  };

  const formatBirthdayForDisplay = (val: string) => {
    if (!val) return '';
    const parts = val.split('.');
    if (parts.length !== 3) return val;
    const d = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const y = parts[2];
    if (isNaN(d) || isNaN(m)) return val;
    return `${d} ${MONTH_NAMES[m - 1]} ${y}`;
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
              Добро пожаловать в «Дом рядом»
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

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerClassName="flex-grow gap-6 px-4 pb-8"
      >
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
                <View
                  className={`h-14 flex-row items-center rounded-field border bg-surface px-4 ${
                    errors.name ? 'border-danger' : 'border-line'
                  }`}
                >
                  <Ionicons
                    name="person-outline"
                    size={20}
                    color={errors.name ? palette.primary : palette.inkMuted}
                    style={{ marginRight: 10 }}
                  />
                  <TextInput
                    placeholder="Имя"
                    placeholderTextColor={palette.inkMuted}
                    className="flex-1 text-base text-ink"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                  />
                  {value.length > 0 ? (
                    <TouchableOpacity onPress={() => setValue('name', '')}>
                      <Ionicons name="close-circle" size={18} color={palette.inkMuted} />
                    </TouchableOpacity>
                  ) : null}
                </View>
              )}
            />
            {errors.name ? (
              <Text className="mt-1.5 px-1 text-xs font-medium text-danger">
                {errors.name.message}
              </Text>
            ) : null}
          </View>

          {/* Surname input */}
          <View className="w-full">
            <Controller
              control={control}
              name="surname"
              render={({ field: { onChange, onBlur, value } }) => (
                <View
                  className={`h-14 flex-row items-center rounded-field border bg-surface px-4 ${
                    errors.surname ? 'border-danger' : 'border-line'
                  }`}
                >
                  <Ionicons
                    name="person-outline"
                    size={20}
                    color={errors.surname ? palette.primary : palette.inkMuted}
                    style={{ marginRight: 10 }}
                  />
                  <TextInput
                    placeholder="Фамилия (необязательно)"
                    placeholderTextColor={palette.inkMuted}
                    className="flex-1 text-base text-ink"
                    value={value || ''}
                    onChangeText={onChange}
                    onBlur={onBlur}
                  />
                  {value && value.length > 0 ? (
                    <TouchableOpacity onPress={() => setValue('surname', '')}>
                      <Ionicons name="close-circle" size={18} color={palette.inkMuted} />
                    </TouchableOpacity>
                  ) : null}
                </View>
              )}
            />
            {errors.surname ? (
              <Text className="mt-1.5 px-1 text-xs font-medium text-danger">
                {errors.surname.message}
              </Text>
            ) : null}
          </View>

          {/* Birthday Input (Pressable) */}
          <View className="w-full">
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={openDatePicker}
              className="h-14 flex-row items-center rounded-field border border-line bg-surface px-4"
            >
              <Ionicons
                name="calendar-outline"
                size={20}
                color={palette.inkMuted}
                style={{ marginRight: 10 }}
              />
              <Text
                className={`flex-1 text-base ${
                  birthdayVal ? 'text-ink' : 'text-ink-muted'
                }`}
              >
                {birthdayVal ? formatBirthdayForDisplay(birthdayVal) : 'Дата рождения (необязательно)'}
              </Text>
              {birthdayVal ? (
                <TouchableOpacity onPress={() => setValue('birthday', '')}>
                  <Ionicons name="close-circle" size={18} color={palette.inkMuted} />
                </TouchableOpacity>
              ) : null}
            </TouchableOpacity>
          </View>

          {/* City Input (Pressable) */}
          <View className="w-full">
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={openCityPicker}
              className={`h-14 flex-row items-center rounded-field border bg-surface px-4 ${
                errors.city ? 'border-danger' : 'border-line'
              }`}
            >
              <Ionicons
                name="location-outline"
                size={20}
                color={errors.city ? palette.primary : palette.inkMuted}
                style={{ marginRight: 10 }}
              />
              <Text className={`flex-1 text-base ${cityVal ? 'text-ink' : 'text-ink-muted'}`}>
                {cityVal || 'Город'}
              </Text>
              {cityVal ? (
                <TouchableOpacity onPress={() => setValue('city', '')}>
                  <Ionicons name="close-circle" size={18} color={palette.inkMuted} />
                </TouchableOpacity>
              ) : null}
            </TouchableOpacity>
            {errors.city ? (
              <Text className="mt-1.5 px-1 text-xs font-medium text-danger">
                {errors.city.message}
              </Text>
            ) : null}
          </View>
        </View>
      </ScrollView>

      {/* Footer Continue Button */}
      <View className="w-full pb-6 px-4">
        <Button
          label="Продолжить"
          loading={isSubmitting || uploading}
          onPress={onSubmit}
          disabled={!nameVal || !cityVal || uploading}
        />
      </View>

      {/* Date Picker Bottom Sheet Modal */}
      <BottomSheet visible={datePickerVisible} onClose={closeDatePicker}>
        {/* Header */}
        <View className="items-center pb-4 border-b border-line">
          <View className="h-1 w-12 rounded-full bg-line mb-3" />
          <Text className="text-lg font-bold text-ink">Выберите дату рождения</Text>
        </View>

        {/* Scrollable Wheels Container */}
        <View className="flex-row justify-center py-6 h-48">
          {/* Day Column */}
          <ScrollView
            ref={dayScrollRef}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ alignItems: 'center', paddingVertical: 76 }}
            className="w-16"
          >
            {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
              <TouchableOpacity
                key={d}
                onPress={() => handleSelectDay(d)}
                style={{ height: 40 }}
                className="w-full items-center justify-center"
              >
                <Text
                  className={`text-lg ${
                    tempDay === d ? 'font-bold text-primary' : 'text-ink-secondary'
                  }`}
                  style={tempDay === d ? { color: palette.primary } : {}}
                >
                  {d}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Month Column */}
          <ScrollView
            ref={monthScrollRef}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ alignItems: 'center', paddingVertical: 76 }}
            className="flex-1"
          >
            {MONTH_NAMES.map((m, idx) => (
              <TouchableOpacity
                key={m}
                onPress={() => handleSelectMonth(idx)}
                style={{ height: 40 }}
                className="w-full items-center justify-center"
              >
                <Text
                  className={`text-lg capitalize ${
                    tempMonth === idx ? 'font-bold text-primary' : 'text-ink-secondary'
                  }`}
                  style={tempMonth === idx ? { color: palette.primary } : {}}
                >
                  {m}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Year Column */}
          <ScrollView
            ref={yearScrollRef}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ alignItems: 'center', paddingVertical: 76 }}
            className="w-24"
          >
            {Array.from({ length: 80 }, (_, i) => CURRENT_YEAR - i).map((y) => (
              <TouchableOpacity
                key={y}
                onPress={() => handleSelectYear(y)}
                style={{ height: 40 }}
                className="w-full items-center justify-center"
              >
                <Text
                  className={`text-lg ${
                    tempYear === y ? 'font-bold text-primary' : 'text-ink-secondary'
                  }`}
                  style={tempYear === y ? { color: palette.primary } : {}}
                >
                  {y}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Apply Button */}
        <Button label="Применить" onPress={handleApplyDate} />
      </BottomSheet>

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
