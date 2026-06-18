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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';

import { Button, ScreenContainer } from '@/components/ui';
import { useDeleteMe, useUpdateMe } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';
import { env } from '@/lib/env';
import { useSessionStore } from '@/store/session';
import { palette, radii } from '@/theme/tokens';
import type { User } from '@/types/user';

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

const fetchDadataCities = async (query: string): Promise<string[]> => {
  try {
    const response = await fetch(
      `${env.apiUrl}/api/v1/cities/suggest`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          query: query,
          from_bound: { value: 'city' },
          to_bound: { value: 'city' },
        }),
      },
    );
    const data = await response.json();
    if (data && data.suggestions) {
      return data.suggestions
        .map((s: any) => s.data.city)
        .filter((c: any) => c != null && c.length > 0)
        .filter((v: any, i: any, a: any) => a.indexOf(v) === i);
    }
  } catch (err) {
    console.error('Dadata fetch error:', err);
  }
  return [];
};

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
  city: z.string().trim().min(2, 'Выберите город'),
  birthday: z.string().trim().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function ProfileSetupScreen() {
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

  // ScrollRefs for Date Picker wheels
  const dayScrollRef = useRef<ScrollView>(null);
  const monthScrollRef = useRef<ScrollView>(null);
  const yearScrollRef = useRef<ScrollView>(null);

  // Modal States with Animations
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [datePickerFade] = useState(() => new Animated.Value(0));
  const [datePickerSlide] = useState(() => new Animated.Value(400));

  const [cityPickerVisible, setCityPickerVisible] = useState(false);
  const [cityPickerFade] = useState(() => new Animated.Value(0));
  const [cityPickerSlide] = useState(() => new Animated.Value(600));

  const [tempDay, setTempDay] = useState(12);
  const [tempMonth, setTempMonth] = useState(4); // May (0-indexed)
  const [tempYear, setTempYear] = useState(CURRENT_YEAR - 20);

  // City Picker States
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [detectedCity, setDetectedCity] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', city: '', birthday: '' },
  });

  const nameVal = watch('name');
  const cityVal = watch('city');
  const birthdayVal = watch('birthday');

  // Trigger animations after Modal renders to avoid skipped frames and abrupt jumps
  useEffect(() => {
    if (datePickerVisible) {
      datePickerFade.setValue(0);
      datePickerSlide.setValue(400);
      requestAnimationFrame(() => {
        Animated.parallel([
          Animated.timing(datePickerFade, {
            toValue: 0.4,
            duration: 250,
            useNativeDriver: true,
          }),
          Animated.timing(datePickerSlide, {
            toValue: 0,
            duration: 250,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
        ]).start(() => {
          // Centering the wheels once bottom sheet slide animation resolves
          setTimeout(() => {
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
          }, 100);
        });
      });
    }
  }, [datePickerVisible]);

  useEffect(() => {
    if (cityPickerVisible) {
      cityPickerFade.setValue(0);
      cityPickerSlide.setValue(600);
      requestAnimationFrame(() => {
        Animated.parallel([
          Animated.timing(cityPickerFade, {
            toValue: 0.4,
            duration: 250,
            useNativeDriver: true,
          }),
          Animated.timing(cityPickerSlide, {
            toValue: 0,
            duration: 250,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
        ]).start();
      });
    }
  }, [cityPickerVisible]);

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
    Animated.parallel([
      Animated.timing(datePickerFade, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(datePickerSlide, {
        toValue: 400,
        duration: 200,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setDatePickerVisible(false);
    });
  };

  const openCityPicker = () => {
    setCityPickerVisible(true);
  };

  const closeCityPicker = () => {
    Animated.parallel([
      Animated.timing(cityPickerFade, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(cityPickerSlide, {
        toValue: 600,
        duration: 200,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setCityPickerVisible(false);
    });
  };

  // Auto-detect city by IP on first load
  useEffect(() => {
    const autoDetect = async () => {
      const detected = await detectCityByIP();
      if (detected) {
        setValue('city', detected);
        setDetectedCity(detected);
        setSuggestions([detected]);
      }
    };
    autoDetect();
  }, []);

  // Load city suggestions based on search query
  useEffect(() => {
    const loadSuggestions = async () => {
      if (searchQuery.trim() === '') {
        setSuggestions(detectedCity ? [detectedCity] : []);
      } else {
        const fetched = await fetchDadataCities(searchQuery);
        setSuggestions(fetched);
      }
    };
    const delayDebounce = setTimeout(() => {
      loadSuggestions();
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery, detectedCity]);

  const toggleAvatar = () => {
    if (avatarUri) {
      setAvatarUri(null);
    } else {
      setAvatarUri(MOCK_AVATAR_URL);
    }
  };

  const onSubmit = handleSubmit(async ({ name, city, birthday }) => {
    try {
      // Send birthday formatted as YYYY-MM-DD
      let formattedBirthday = '';
      if (birthday) {
        const [d, m, y] = birthday.split('.');
        formattedBirthday = `${y}-${m}-${d}`;
      }

      const user = await updateMe.mutateAsync({
        name,
        city,
        birthday: formattedBirthday || undefined,
        avatar_url: avatarUri || undefined,
      });

      setCreatedUser(user);
      setIsCompleted(true);
    } catch (err) {
      setError('name', {
        message: err instanceof ApiError ? err.message : 'Не удалось сохранить профиль.',
      });
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
            onPress={() => completeOnboarding(createdUser)}
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
            onPress={toggleAvatar}
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
          loading={isSubmitting}
          onPress={onSubmit}
          disabled={!nameVal || !cityVal}
        />
      </View>

      {/* Date Picker Bottom Sheet Modal */}
      {datePickerVisible && (
        <Modal visible={true} transparent animationType="none">
          <View className="flex-1 justify-end">
            {/* Animated Backdrop */}
            <Animated.View
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'black',
                opacity: datePickerFade,
              }}
            >
              <Pressable style={{ flex: 1 }} onPress={closeDatePicker} />
            </Animated.View>

            {/* Animated Bottom Sheet Container */}
            <Animated.View
              style={{
                transform: [{ translateY: datePickerSlide }],
                backgroundColor: palette.surface,
                borderTopLeftRadius: radii.card,
                borderTopRightRadius: radii.card,
              }}
              className="px-4 pb-8 pt-4"
            >
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
            </Animated.View>
          </View>
        </Modal>
      )}

      {/* City Autocomplete Bottom Sheet Modal */}
      {cityPickerVisible && (
        <Modal visible={true} transparent animationType="none">
          <View className="flex-1 justify-end">
            {/* Animated Backdrop */}
            <Animated.View
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'black',
                opacity: cityPickerFade,
              }}
            >
              <Pressable style={{ flex: 1 }} onPress={closeCityPicker} />
            </Animated.View>

            {/* Animated Bottom Sheet Container */}
            <Animated.View
              style={{
                transform: [{ translateY: cityPickerSlide }],
                backgroundColor: palette.surface,
                borderTopLeftRadius: radii.card,
                borderTopRightRadius: radii.card,
                height: '70%',
              }}
              className="px-4 pb-8 pt-4"
            >
              {/* Header */}
              <View className="items-center pb-4">
                <View className="h-1 w-12 rounded-full bg-line mb-3" />
                <Text className="text-lg font-bold text-ink">Выберите город</Text>
              </View>

              {/* Search Input */}
              <View className="h-12 flex-row items-center rounded-field border border-line bg-surface-muted px-3 mb-4">
                <Ionicons name="search" size={20} color={palette.inkMuted} />
                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Поиск города..."
                  placeholderTextColor={palette.inkMuted}
                  className="ml-2 flex-1 text-base text-ink"
                />
                {searchQuery.length > 0 ? (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <Ionicons name="close-circle" size={18} color={palette.inkMuted} />
                  </TouchableOpacity>
                ) : null}
              </View>

              {/* Suggestions list */}
              <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
                {suggestions.map((city) => (
                  <TouchableOpacity
                    key={city}
                    onPress={() => handleSelectCity(city)}
                    className="py-4 border-b border-line flex-row items-center justify-between"
                  >
                    <Text className="text-base text-ink">{city}</Text>
                    {cityVal === city ? (
                      <Ionicons name="checkmark" size={20} color={palette.primary} />
                    ) : null}
                  </TouchableOpacity>
                ))}
                {suggestions.length === 0 ? (
                  <Text className="text-center text-base text-ink-muted py-6">
                    Города не найдены
                  </Text>
                ) : null}
              </ScrollView>
            </Animated.View>
          </View>
        </Modal>
      )}
    </ScreenContainer>
  );
}
