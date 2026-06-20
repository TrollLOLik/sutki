import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { Animated, Alert, Dimensions, Easing, Image, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BirthdayPickerSheet, formatBirthday } from '@/components/BirthdayPickerSheet';
import { CityPickerSheet } from '@/components/CityPickerSheet';
import { EmailChangeSheet } from '@/components/EmailChangeSheet';
import { AccountDeleteSheet } from '@/components/AccountDeleteSheet';
import { Button } from '@/components/ui';
import { useScrollHideTabBar } from '@/hooks/useScrollHideTabBar';
import { useUpdateMe, fetchMe } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';
import { useSessionStore } from '@/store/session';
import { palette } from '@/theme/tokens';
import type { UpdateProfileBody } from '@/types/auth';

type SettingsTab = 'basic' | 'security';

const FALLBACK_AVATAR = 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=240&h=240&fit=crop';

const TRUST_ITEMS = [
  { icon: 'shield-checkmark-outline', label: 'Проверка профиля', value: 'Готово' },
  { icon: 'chatbubbles-outline', label: 'Ответы хозяев', value: '12 мин' },
] as const;

const LOGIN_DEVICES = [
  { name: 'iPhone 15 Pro', place: 'Москва, Россия', date: 'Сейчас', current: true },
  { name: 'Chrome на Windows', place: 'Санкт-Петербург, Россия', date: 'Вчера, 20:14', current: false },
  { name: 'Android приложение', place: 'Казань, Россия', date: '12 июня, 09:42', current: false },
] as const;

const SCREEN_HEIGHT = Dimensions.get('window').height;

function valueOrPlaceholder(value: string | number | boolean | null | undefined, placeholder = 'Не заполнено') {
  if (typeof value === 'boolean') return value ? 'Да' : 'Нет';
  if (value === null || value === undefined || value === '') return placeholder;
  return String(value);
}

function initials(name: string | undefined) {
  const parts = name?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (parts.length === 0) return 'ДР';
  return parts.slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

function SettingsField({ label, value, icon }: { label: string; value: string; icon: keyof typeof Ionicons.glyphMap }) {
  return (
    <View className="gap-2">
      <Text className="text-sm font-semibold text-ink-secondary">{label}</Text>
      <View className="h-12 flex-row items-center rounded-field border border-line bg-surface px-3">
        <Ionicons name={icon} size={18} color={palette.primary} />
        <TextInput
          value={value}
          editable={false}
          placeholderTextColor={palette.inkMuted}
          className="ml-2 flex-1 text-base text-ink"
        />
      </View>
    </View>
  );
}

function EditableField({
  label,
  value,
  onChangeText,
  icon,
  placeholder,
  keyboardType = 'default',
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  icon: keyof typeof Ionicons.glyphMap;
  placeholder?: string;
  keyboardType?: 'default' | 'phone-pad';
}) {
  return (
    <View className="gap-2">
      <Text className="text-sm font-semibold text-ink-secondary">{label}</Text>
      <View className="h-12 flex-row items-center rounded-field border border-line bg-surface px-3">
        <Ionicons name={icon} size={18} color={palette.primary} />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={palette.inkMuted}
          keyboardType={keyboardType}
          className="ml-2 flex-1 text-base text-ink"
        />
      </View>
    </View>
  );
}

function PickerField({
  label,
  value,
  placeholder,
  icon,
  onPress,
}: {
  label: string;
  value: string;
  placeholder: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  return (
    <View className="gap-2">
      <Text className="text-sm font-semibold text-ink-secondary">{label}</Text>
      <Pressable
        onPress={onPress}
        className="h-12 flex-row items-center rounded-field border border-line bg-surface px-3 active:bg-surface-muted">
        <Ionicons name={icon} size={18} color={palette.primary} />
        <Text className={`ml-2 flex-1 text-base ${value ? 'text-ink' : 'text-ink-muted'}`}>
          {value || placeholder}
        </Text>
        <Ionicons name="chevron-forward" size={18} color={palette.inkMuted} />
      </Pressable>
    </View>
  );
}

function ProfileAction({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="flex-row items-center gap-3 rounded-card border border-line bg-surface px-4 py-4 active:bg-surface-muted"
      style={{ shadowColor: palette.ink, shadowOpacity: 0.04, shadowRadius: 14, shadowOffset: { width: 0, height: 8 } }}>
      <View className="h-12 w-12 items-center justify-center rounded-field bg-primary-light">
        <Ionicons name={icon} size={23} color={palette.primary} />
      </View>
      <View className="flex-1 gap-0.5">
        <Text className="text-base font-bold text-ink">{title}</Text>
        <Text className="text-sm text-ink-secondary">{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={palette.inkMuted} />
    </Pressable>
  );
}

export default function ProfileScreen() {
  const user = useSessionStore((s) => s.user);
  const signOut = useSessionStore((s) => s.signOut);
  const setUser = useSessionStore((s) => s.setUser);
  const updateMe = useUpdateMe();
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('basic');
  const vkLinked = !!user?.vk_id;

  // Auto-refresh profile on screen focus
  useFocusEffect(
    useCallback(() => {
      let active = true;
      fetchMe()
        .then((latestUser) => {
          if (active) {
            setUser(latestUser);
          }
        })
        .catch((err) => {
          console.warn('Failed to refresh user profile:', err);
        });
      return () => {
        active = false;
      };
    }, [setUser])
  );

  // User card shimmer sweep animation (блеск/переливание)
  const shimmerAnim = useRef(new Animated.Value(-1)).current;
  useEffect(() => {
    shimmerAnim.setValue(-1);
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1.5,
          duration: 3000,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.delay(1000),
      ])
    ).start();
  }, [shimmerAnim]);

  // Editable "Основное" form state (initialised from the cached user on open).
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formCity, setFormCity] = useState('');
  const [formBirthday, setFormBirthday] = useState(''); // YYYY-MM-DD
  const [cityPickerVisible, setCityPickerVisible] = useState(false);
  const [birthdayPickerVisible, setBirthdayPickerVisible] = useState(false);
  const [emailChangeVisible, setEmailChangeVisible] = useState(false);
  const [deleteSheetVisible, setDeleteSheetVisible] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (settingsVisible) {
      setFormName(user?.name ?? '');
      setFormPhone(user?.phone ?? '');
      setFormCity(user?.city ?? '');
      setFormBirthday(user?.birthday ?? '');
      setSaveError(null);
      setSettingsTab('basic');
      tabAnim.setValue(0);
      requestAnimationFrame(() => {
        horizontalScrollRef.current?.scrollTo({ x: 0, animated: false });
      });
    }
  }, [settingsVisible, user]);

  const handleSaveProfile = async () => {
    if (!user) return;
    const name = formName.trim();
    const phone = formPhone.trim();
    const city = formCity.trim();
    if (name.length < 2) {
      setSaveError('Введите имя (минимум 2 символа)');
      return;
    }
    // Only send changed fields. Birthday can't be cleared via the API (empty =
    // "unchanged" server-side), so only send it when set and different.
    const body: UpdateProfileBody = {};
    if (name !== (user.name ?? '')) body.name = name;
    if (phone !== (user.phone ?? '')) body.phone = phone;
    if (city !== (user.city ?? '')) body.city = city;
    if (formBirthday && formBirthday !== (user.birthday ?? '')) body.birthday = formBirthday;
    if (Object.keys(body).length === 0) {
      closeSettings();
      return;
    }
    setSaveError(null);
    try {
      const updated = await updateMe.mutateAsync(body);
      setUser(updated);
      closeSettings();
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : 'Не удалось сохранить профиль.');
    }
  };

  const handleToggleVK = async () => {
    if (!user) return;
    try {
      if (user.vk_id) {
        // unlink VK
        const updated = await updateMe.mutateAsync({ vk_id_do_null: true });
        setUser(updated);
      } else {
        // link VK (simulate linking with dummy VK ID)
        const updated = await updateMe.mutateAsync({ vk_id: 'vk_12345' });
        setUser(updated);
      }
    } catch (err) {
      console.warn('Failed to toggle VK link:', err);
      Alert.alert('Ошибка', 'Не удалось изменить привязку ВКонтакте.');
    }
  };

  const [settingsFade] = useState(() => new Animated.Value(0));
  const [settingsSlide] = useState(() => new Animated.Value(SCREEN_HEIGHT));
  const handleScroll = useScrollHideTabBar();

  const horizontalScrollRef = useRef<ScrollView>(null);
  const tabAnim = useRef(new Animated.Value(0)).current;
  const windowWidth = Dimensions.get('window').width;
  const shimmerTranslateX = shimmerAnim.interpolate({
    inputRange: [-1, 1.5],
    outputRange: [-windowWidth, windowWidth * 1.5],
  });
  const [containerWidth, setContainerWidth] = useState(windowWidth - 32);

  // Tab switching animation
  useEffect(() => {
    Animated.timing(tabAnim, {
      toValue: settingsTab === 'basic' ? 0 : 1,
      duration: 200,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    }).start();
  }, [settingsTab]);

  const handleTabChange = (tab: SettingsTab) => {
    setSettingsTab(tab);
    horizontalScrollRef.current?.scrollTo({
      x: tab === 'basic' ? 0 : containerWidth,
      animated: true,
    });
  };

  useEffect(() => {
    if (settingsVisible) {
      settingsFade.setValue(0);
      settingsSlide.setValue(SCREEN_HEIGHT);
      requestAnimationFrame(() => {
        // Ensure scroll view is immediately in the correct page state before slide-in starts
        horizontalScrollRef.current?.scrollTo({
          x: settingsTab === 'basic' ? 0 : containerWidth,
          animated: false,
        });

        Animated.parallel([
          Animated.timing(settingsFade, {
            toValue: 0.4,
            duration: 250,
            useNativeDriver: true,
          }),
          Animated.timing(settingsSlide, {
            toValue: 0,
            duration: 250,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
        ]).start();
      });
    }
  }, [settingsVisible, settingsTab, containerWidth]);

  const closeSettings = () => {
    Animated.parallel([
      Animated.timing(settingsFade, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(settingsSlide, {
        toValue: SCREEN_HEIGHT,
        duration: 200,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setSettingsVisible(false);
    });
  };

  const handleDeleteAccount = () => {
    setDeleteSheetVisible(true);
  };

  const displayName = user?.name || 'Гость';
  const avatarUrl = user?.avatar_url || FALLBACK_AVATAR;
  const completionItems = useMemo(() => {
    if (!user) return [];
    return [
      {
        id: 'avatar',
        label: 'Добавить аватарку',
        completed: !!(user.avatar_url && user.avatar_url !== FALLBACK_AVATAR && user.avatar_url.trim() !== ''),
        onPress: () => {
          setSettingsVisible(true);
          setSettingsTab('basic');
        },
      },
      {
        id: 'phone',
        label: 'Подтвердить телефон',
        completed: !!(user.phone && user.phone.trim() !== ''),
        onPress: () => {
          setSettingsVisible(true);
          setSettingsTab('basic');
        },
      },
      {
        id: 'email',
        label: 'Подтвердить почту',
        completed: !!(user.email && user.email.trim() !== ''),
        onPress: () => {
          setSettingsVisible(true);
          setSettingsTab('basic');
        },
      },
      {
        id: 'vk',
        label: 'Привязать аккаунт VK',
        completed: !!(user.vk_id && user.vk_id.trim() !== ''),
        onPress: () => {
          setSettingsVisible(true);
          setSettingsTab('security');
        },
      },
    ];
  }, [user]);

  const completion = useMemo(() => {
    if (completionItems.length === 0) return 0;
    const completedCount = completionItems.filter(item => item.completed).length;
    return Math.round((completedCount / completionItems.length) * 100);
  }, [completionItems]);

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-surface-muted">
      <View className="flex-row items-center justify-between px-4 pb-4 pt-2">
        <View>
          <Text className="text-2xl font-extrabold text-ink">Личный кабинет</Text>
        </View>
        <Pressable
          accessibilityLabel="Настройки профиля"
          accessibilityRole="button"
          onPress={() => setSettingsVisible(true)}
          className="h-12 w-12 items-center justify-center rounded-full border border-line bg-surface active:bg-surface-muted">
          <Ionicons name="settings-outline" size={22} color={palette.ink} />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerClassName="px-4 pb-28"
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        <LinearGradient
          colors={[palette.primary, palette.primaryPressed]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ borderRadius: 24, padding: 20, overflow: 'hidden', position: 'relative' }}>
          <View className="flex-row items-center gap-4">
            <View className="h-20 w-20 items-center justify-center rounded-full border-2 border-white bg-primary-light overflow-hidden">
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} className="h-full w-full rounded-full" />
              ) : (
                <Text className="text-xl font-extrabold text-primary">{initials(user?.name)}</Text>
              )}
            </View>

            <View className="flex-1">
              <View className="self-start rounded-pill bg-white/20 px-3 py-1">
                <Text className="text-xs font-bold text-white">Дом рядом</Text>
              </View>
              <Text className="mt-2 text-2xl font-extrabold leading-8 text-white">{displayName}</Text>
              <Text className="mt-1 text-sm leading-5 text-white opacity-95">
                {user?.city ? `${user.city} · ` : ''}Путешественник и хозяин
              </Text>
            </View>
          </View>

          {/* Shimmer shining sweep overlay */}
          <Animated.View
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              width: 130,
              transform: [{ translateX: shimmerTranslateX }, { skewX: '-25deg' }],
            }}
            pointerEvents="none"
          >
            <LinearGradient
              colors={['rgba(255, 255, 255, 0)', 'rgba(255, 255, 255, 0.45)', 'rgba(255, 255, 255, 0)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ flex: 1 }}
            />
          </Animated.View>
        </LinearGradient>

        <View className="mt-4 flex-row gap-3">
          <View className="flex-1 rounded-card border border-line bg-surface p-4"
            style={{ shadowColor: palette.ink, shadowOpacity: 0.02, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } }}>
            <Text className="text-xl font-extrabold text-ink">{user?.listings_count ?? 0}</Text>
            <Text className="text-xs font-semibold text-ink-secondary">объявления</Text>
          </View>
          <View className="flex-1 rounded-card border border-line bg-surface p-4"
            style={{ shadowColor: palette.ink, shadowOpacity: 0.02, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } }}>
            <Text className="text-xl font-extrabold text-ink">
              {user?.rating && user.rating > 0 ? user.rating.toFixed(1) : '0.0'}
            </Text>
            <Text className="text-xs font-semibold text-ink-secondary">рейтинг</Text>
          </View>
        </View>

        <View className="mt-5 flex-row gap-3">
          {TRUST_ITEMS.map((item) => (
            <View key={item.label} className="flex-1 rounded-card border border-line bg-surface p-3"
              style={{ shadowColor: palette.ink, shadowOpacity: 0.02, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } }}>
              <View className="mb-3 h-9 w-9 items-center justify-center rounded-full bg-primary-light">
                <Ionicons name={item.icon} size={18} color={palette.primary} />
              </View>
              <Text className="text-lg font-extrabold text-ink">{item.value}</Text>
              <Text className="mt-1 text-xs leading-4 text-ink-secondary">{item.label}</Text>
            </View>
          ))}
        </View>

        <View className="mt-6 gap-3">
          <ProfileAction
            icon="home-outline"
            title="Мои объявления"
            subtitle="Управляйте объектами, ценами и календарём"
            onPress={() => router.push('/my-listings' as any)}
          />
          <ProfileAction
            icon="reader-outline"
            title="Мои брони"
            subtitle="История поездок, чеки и отзывы"
            onPress={() => router.push('/bookings')}
          />
          <ProfileAction
            icon="file-tray-full-outline"
            title="Входящие заявки"
            subtitle="Новые запросы гостей и подтверждения"
            onPress={() => router.push('/incoming')}
          />
          <ProfileAction
            icon="star-outline"
            title="Мои отзывы"
            subtitle="Отзывы, которые вы оставили или получили"
            onPress={() => router.push('/my-reviews' as any)}
          />
        </View>

        <View className="mt-6 border border-line bg-surface p-4"
          style={{ borderRadius: 24, shadowColor: palette.ink, shadowOpacity: 0.04, shadowRadius: 14, shadowOffset: { width: 0, height: 8 } }}>
          <View className="flex-row items-center justify-between">
            <Text className="text-sm font-semibold text-ink-secondary">Заполнение профиля</Text>
            <Text className="text-sm font-extrabold text-primary">{completion}%</Text>
          </View>
          <View className="mt-3 h-2 overflow-hidden rounded-pill bg-surface-muted">
            <View className="h-full rounded-pill bg-primary" style={{ width: `${completion}%` }} />
          </View>

          {/* Checklist of completion tasks */}
          <View className="mt-4 gap-3">
            {completionItems.map((item) => (
              <Pressable
                key={item.id}
                onPress={item.onPress}
                className="flex-row items-center justify-between rounded-field bg-surface-muted px-4 py-3 active:opacity-80"
              >
                <View className="flex-row items-center gap-3 flex-1 pr-2">
                  <Ionicons
                    name={item.completed ? 'checkmark-circle' : 'ellipse-outline'}
                    size={20}
                    color={item.completed ? palette.success : palette.inkMuted}
                  />
                  <Text className={`text-sm ${item.completed ? 'text-ink-secondary line-through' : 'text-ink font-semibold'}`}>
                    {item.label}
                  </Text>
                </View>
                {!item.completed && (
                  <View className="flex-row items-center gap-1">
                    <Text className="text-xs text-primary font-bold">Заполнить</Text>
                    <Ionicons name="chevron-forward" size={12} color={palette.primary} />
                  </View>
                )}
              </Pressable>
            ))}
          </View>
        </View>

        <View className="mt-4 border border-line bg-surface p-5"
          style={{ borderRadius: 24, shadowColor: palette.ink, shadowOpacity: 0.04, shadowRadius: 14, shadowOffset: { width: 0, height: 8 } }}>
          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-4">
              <Text className="text-xl font-extrabold text-ink">Сделайте профиль заметнее</Text>
              <Text className="mt-2 text-sm leading-5 text-ink-secondary">
                Добавьте фото, город и дату рождения. Хозяева быстрее подтверждают заявки с заполненным профилем.
              </Text>
            </View>
            <View className="h-16 w-16 items-center justify-center rounded-[22px] bg-primary-light">
              <Ionicons name="sparkles-outline" size={30} color={palette.primary} />
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => setSettingsVisible(true)}
            className="mt-4 h-12 flex-row items-center justify-center rounded-field bg-ink active:opacity-90">
            <Ionicons name="create-outline" size={18} color={palette.surface} />
            <Text className="ml-2 text-base font-bold text-white">Открыть настройки</Text>
          </Pressable>
        </View>

        <View className="mt-6">
          <Button label="Выйти" variant="secondary" onPress={signOut} />
        </View>
      </ScrollView>

      <Modal visible={settingsVisible} transparent animationType="none" onRequestClose={closeSettings}>
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
              opacity: settingsFade,
            }}
          >
            <Pressable style={{ flex: 1 }} onPress={closeSettings} />
          </Animated.View>

          {/* Animated Full Screen Container */}
          <Animated.View
            className="px-4 pt-2 pb-6"
            style={{
              transform: [{ translateY: settingsSlide }],
              backgroundColor: palette.surface,
              height: '100%',
            }}
          >
            <SafeAreaView edges={['top', 'bottom']} className="flex-1">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-baseline gap-1.5">
                  <Text className="text-2xl font-extrabold text-ink">Профиль</Text>
                  <Text className="text-sm font-semibold text-primary">({completion}%)</Text>
                </View>
                <Pressable
                  accessibilityLabel="Закрыть настройки"
                  onPress={closeSettings}
                  className="h-11 w-11 items-center justify-center rounded-full bg-surface-muted">
                  <Ionicons name="close" size={22} color={palette.ink} />
                </Pressable>
              </View>

              <View
                onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
                className="mt-5 flex-row rounded-field bg-surface-muted p-1 relative"
              >
                <Animated.View
                  style={{
                    position: 'absolute',
                    top: 4,
                    left: 4,
                    bottom: 4,
                    width: (containerWidth - 8) / 2,
                    transform: [{
                      translateX: tabAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, (containerWidth - 8) / 2],
                      })
                    }],
                    backgroundColor: palette.surface,
                    borderRadius: 12,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.08,
                    shadowRadius: 4,
                    elevation: 2,
                  }}
                />
                <Pressable
                  accessibilityRole="tab"
                  accessibilityState={{ selected: settingsTab === 'basic' }}
                  onPress={() => handleTabChange('basic')}
                  className="h-11 flex-1 items-center justify-center rounded-field relative z-10"
                >
                  <Text className={`font-bold transition-colors duration-200 ${settingsTab === 'basic' ? 'text-ink' : 'text-ink-secondary'}`}>
                    Основное
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="tab"
                  accessibilityState={{ selected: settingsTab === 'security' }}
                  onPress={() => handleTabChange('security')}
                  className="h-11 flex-1 items-center justify-center rounded-field relative z-10"
                >
                  <Text className={`font-bold transition-colors duration-200 ${settingsTab === 'security' ? 'text-ink' : 'text-ink-secondary'}`}>
                    Безопасность
                  </Text>
                </Pressable>
              </View>

              <ScrollView
                ref={horizontalScrollRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                scrollEventThrottle={16}
                onMomentumScrollEnd={(e) => {
                  const offsetX = e.nativeEvent.contentOffset.x;
                  const page = Math.round(offsetX / containerWidth);
                  const nextTab = page === 0 ? 'basic' : 'security';
                  if (settingsTab !== nextTab) {
                    setSettingsTab(nextTab);
                  }
                }}
                className="flex-1 mt-2"
              >
                {/* Basic Tab */}
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  contentContainerClassName="gap-4 py-5 pr-2"
                  style={{ width: containerWidth }}
                >
                  <View className="rounded-[24px] border border-line bg-surface-muted p-4" style={{ borderRadius: 24 }}>
                    <View className="flex-row items-center gap-4">
                      <Image source={{ uri: avatarUrl }} className="h-20 w-20 rounded-[24px]" />
                      <View className="flex-1">
                        <Text className="text-lg font-extrabold text-ink">Фото профиля</Text>
                        <Text className="mt-1 text-sm leading-5 text-ink-secondary">
                          Заглушка загрузки аватара. Позже подключим выбор изображения и сохранение.
                        </Text>
                      </View>
                    </View>
                  </View>

                  <PickerField
                    label="Email"
                    value={valueOrPlaceholder(user?.email)}
                    placeholder="Укажите email"
                    icon="mail-outline"
                    onPress={() => setEmailChangeVisible(true)}
                  />
                  <EditableField
                    label="Имя"
                    value={formName}
                    onChangeText={setFormName}
                    icon="person-outline"
                    placeholder="Ваше имя"
                  />
                  <EditableField
                    label="Телефон"
                    value={formPhone}
                    onChangeText={setFormPhone}
                    icon="call-outline"
                    placeholder="+7 900 000-00-00"
                    keyboardType="phone-pad"
                  />
                  <PickerField
                    label="Город"
                    value={formCity}
                    placeholder="Выберите город"
                    icon="location-outline"
                    onPress={() => setCityPickerVisible(true)}
                  />
                  <PickerField
                    label="Дата рождения"
                    value={formatBirthday(formBirthday)}
                    placeholder="Укажите дату рождения"
                    icon="calendar-outline"
                    onPress={() => setBirthdayPickerVisible(true)}
                  />
                  {saveError ? (
                    <Text className="px-1 text-sm font-medium text-danger">{saveError}</Text>
                  ) : null}
                </ScrollView>

                {/* Security Tab */}
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  contentContainerClassName="gap-4 py-5 pl-2"
                  style={{ width: containerWidth }}
                >
                  <View className="rounded-[24px] bg-primary-light p-4" style={{ borderRadius: 24 }}>
                    <View className="flex-row items-start gap-3">
                      <View className="h-12 w-12 items-center justify-center rounded-full bg-surface">
                        <Ionicons name="lock-closed-outline" size={23} color={palette.primary} />
                      </View>
                      <View className="flex-1">
                        <Text className="text-lg font-extrabold text-ink">Защита аккаунта</Text>
                        <Text className="mt-1 text-sm leading-5 text-ink-secondary">
                          UI-заглушки для email-кода, устройств входа и статуса верификации без серверной логики.
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View className="gap-3 rounded-card border border-line bg-surface p-4">
                    <Pressable
                      onPress={() => setEmailChangeVisible(true)}
                      className="flex-row items-center justify-between active:opacity-70"
                    >
                      <View className="flex-1 pr-2">
                        <Text className="text-base font-extrabold text-ink">Вход по email-коду</Text>
                        <Text className="mt-1 text-sm text-ink-secondary">{valueOrPlaceholder(user?.email)}</Text>
                      </View>
                      <View className="flex-row items-center gap-2">
                        <View className="rounded-pill bg-success-light px-3 py-1">
                          <Text className="text-xs font-bold text-success">Активно</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color={palette.inkMuted} />
                      </View>
                    </Pressable>
                    <View className="h-px bg-line" />
                    <View className="flex-row items-center justify-between">
                      <View>
                        <Text className="text-base font-extrabold text-ink">Верификация</Text>
                        <Text className="mt-1 text-sm text-ink-secondary">Паспорт и документы пока не подключены</Text>
                      </View>
                      <Ionicons
                        name={user?.is_verified ? 'shield-checkmark' : 'shield-outline'}
                        size={24}
                        color={user?.is_verified ? palette.success : palette.inkMuted}
                      />
                    </View>
                    <View className="h-px bg-line" />
                    <View className="flex-row items-center justify-between">
                      <View className="flex-1 pr-4">
                        <Text className="text-base font-extrabold text-ink">ВКонтакте</Text>
                        <Text className="mt-1 text-sm text-ink-secondary">
                          {vkLinked ? 'Аккаунт VK привязан' : 'Связать профиль для быстрого входа'}
                        </Text>
                      </View>
                      <Pressable
                        onPress={handleToggleVK}
                        className={`rounded-pill px-3 py-1.5 ${vkLinked ? 'bg-surface-muted border border-line' : 'bg-primary-light'}`}
                      >
                        <Text className={`text-xs font-bold ${vkLinked ? 'text-ink-secondary' : 'text-primary'}`}>
                          {vkLinked ? 'Отвязать' : 'Привязать'}
                        </Text>
                      </Pressable>
                    </View>
                  </View>

                  <View className="gap-3">
                    <Text className="text-lg font-extrabold text-ink">Устройства входа</Text>
                    {LOGIN_DEVICES.map((device) => (
                      <View key={`${device.name}-${device.date}`} className="flex-row items-center gap-3 rounded-card border border-line bg-surface p-4">
                        <View className="h-11 w-11 items-center justify-center rounded-full bg-surface-muted">
                          <Ionicons name={device.current ? 'phone-portrait-outline' : 'desktop-outline'} size={21} color={palette.primary} />
                        </View>
                        <View className="flex-1">
                          <View className="flex-row items-center gap-2">
                            <Text className="font-bold text-ink">{device.name}</Text>
                            {device.current ? (
                              <View className="rounded-pill bg-success-light px-2 py-0.5">
                                <Text className="text-[10px] font-bold text-success">Сейчас</Text>
                              </View>
                            ) : null}
                          </View>
                          <Text className="mt-1 text-sm text-ink-secondary">{device.place}</Text>
                          <Text className="text-xs text-ink-muted">{device.date}</Text>
                        </View>
                        <Ionicons name="ellipsis-horizontal" size={20} color={palette.inkMuted} />
                      </View>
                    ))}
                  </View>

                  <View className="gap-3 mt-6">
                    <Text className="text-lg font-extrabold" style={{ color: palette.danger }}>Опасная зона</Text>
                    <View className="rounded-card border p-4" style={{ borderRadius: 16, backgroundColor: palette.dangerLight, borderColor: 'rgba(229, 72, 77, 0.2)' }}>
                      <View className="flex-row items-start gap-3">
                        <View className="h-11 w-11 items-center justify-center rounded-full bg-surface">
                          <Ionicons name="trash-outline" size={20} color={palette.danger} />
                        </View>
                        <View className="flex-1">
                          <Text className="text-base font-extrabold text-ink">Удаление аккаунта</Text>
                          <Text className="mt-1 text-sm leading-5 text-ink-secondary">
                            Удаление профиля является окончательным действием. Все ваши объявления, переписка и бронирования будут безвозвратно удалены.
                          </Text>
                        </View>
                      </View>
                      <Pressable
                        accessibilityRole="button"
                        onPress={handleDeleteAccount}
                        style={{ backgroundColor: palette.danger }}
                        className="mt-4 h-11 items-center justify-center rounded-field active:opacity-90">
                        <Text className="text-base font-bold text-white">Удалить профиль</Text>
                      </Pressable>
                    </View>
                  </View>
                </ScrollView>
              </ScrollView>

              <View className="flex-row gap-3">
                <Button label="Позже" variant="secondary" size="md" className="flex-1" onPress={closeSettings} />
                <Button
                  label="Сохранить"
                  size="md"
                  className="flex-1"
                  loading={updateMe.isPending}
                  onPress={handleSaveProfile}
                />
              </View>
            </SafeAreaView>

            <CityPickerSheet
              visible={cityPickerVisible}
              onClose={() => setCityPickerVisible(false)}
              onSelect={(city) => {
                setFormCity(city);
                setCityPickerVisible(false);
              }}
              selectedCity={formCity}
            />
            <BirthdayPickerSheet
              visible={birthdayPickerVisible}
              onClose={() => setBirthdayPickerVisible(false)}
              onApply={(iso) => {
                setFormBirthday(iso);
                setBirthdayPickerVisible(false);
              }}
              initialValue={formBirthday}
            />
            <EmailChangeSheet
              visible={emailChangeVisible}
              onClose={() => setEmailChangeVisible(false)}
            />
            <AccountDeleteSheet
              visible={deleteSheetVisible}
              onClose={() => setDeleteSheetVisible(false)}
            />
          </Animated.View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
