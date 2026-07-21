import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { Animated, Dimensions, Easing, Image, Modal, Pressable, ScrollView, Text, TextInput, View, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BirthdayPickerSheet, formatBirthday } from '@/components/BirthdayPickerSheet';
import { CityPickerSheet } from '@/components/CityPickerSheet';
import { NavigationBackButton } from '@/components/NavigationBackButton';
import { EmailChangeSheet } from '@/components/EmailChangeSheet';
import { PhoneChangeSheet } from '@/components/PhoneChangeSheet';
import { AccountDeleteSheet } from '@/components/AccountDeleteSheet';
import { Button, IconButton, Input, MaterialSurface } from '@/components/ui';
import {
  ProfileActionGroup,
  ProfileHero,
  ProfileInfoPanel,
  ProfileMetricGrid,
} from '@/components/profile/ProfileOverview';
import { useScrollHideTabBar } from '@/hooks/useScrollHideTabBar';
import { useUpdateMe, fetchMe, useSessions, useRevokeSession, useRevokeOtherSessions, Session } from '@/lib/api/auth';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { ApiError } from '@/lib/api/client';
import { useSessionStore } from '@/store/session';
import { useAppTheme } from '@/theme/useAppTheme';
import * as ImagePicker from 'expo-image-picker';
import { presignMediaUpload, uploadToS3 } from '@/lib/api/media';
import { useHostResponseStats } from '@/lib/api/hostStats';
import { formatHostResponseTime } from '@/lib/formatHostStats';
import { formatPhoneMask, normalizePhoneDigits } from '@/lib/phone';
import type { UpdateProfileBody } from '@/types/auth';
import type { User } from '@/types/user';
import { GuestProfile } from '@/components/profile/GuestProfile';
import { ThemeSelector } from '@/components/profile/ThemeSelector';
import { type ActivityScope, useActivityCounters, useMarkActivityRead } from '@/lib/api/activity';
import { useFiltersStore } from '@/store/filters';
import { appAlert as Alert } from '@/components/AppAlert';

type SettingsTab = 'basic' | 'security';

const formatRelativeTime = (isoString: string) => {
  try {
    const date = parseISO(isoString);
    return formatDistanceToNow(date, { addSuffix: true, locale: ru });
  } catch {
    return 'недавно';
  }
};

const getDeviceIcon = (os: string): keyof typeof Ionicons.glyphMap => {
  const osLower = os.toLowerCase();
  if (osLower.includes('ios') || osLower.includes('android')) {
    return 'phone-portrait-outline';
  }
  return 'desktop-outline';
};

function valueOrPlaceholder(value: string | number | boolean | null | undefined, placeholder = 'Не заполнено') {
  if (typeof value === 'boolean') return value ? 'Да' : 'Нет';
  if (value === null || value === undefined || value === '') return placeholder;
  return String(value);
}

function initials(user: User | null | undefined) {
  if (!user) return 'ДР';
  const parts = [user.name, user.surname].filter((p): p is string => !!p);
  if (parts.length === 0) return 'ДР';
  return parts.map((part) => part.trim()[0]).join('').toUpperCase();
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
      <Text className="px-1 text-sm font-bold text-ink-secondary">{label}</Text>
      <Input
        value={value}
        onChangeText={onChangeText}
        icon={icon}
        placeholder={placeholder}
        keyboardType={keyboardType}
      />
    </View>
  );
}

function PickerField({
  label,
  value,
  placeholder,
  icon,
  onPress,
  count = 0,
}: {
  label: string;
  value: string;
  placeholder: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  count?: number;
}) {
  const { palette } = useAppTheme();
  return (
    <View className="gap-2">
      <Text className="px-1 text-sm font-bold text-ink-secondary">{label}</Text>
      <Pressable
        onPress={onPress}
        className="h-14 flex-row items-center rounded-[18px] border border-line bg-surface-muted px-4 active:opacity-80">
        <Ionicons name={icon} size={20} color={palette.primary} />
        <Text className={`ml-3 flex-1 text-base ${value ? 'text-ink' : 'text-ink-muted'}`} numberOfLines={1}>
          {value || placeholder}
        </Text>
        <Ionicons name="chevron-forward" size={19} color={palette.inkMuted} />
      </Pressable>
    </View>
  );
}

function PhonePickerField({ value, onPress }: { value?: string | null; onPress: () => void }) {
  const { palette } = useAppTheme();
  const masked = value ? formatPhoneMask(normalizePhoneDigits(value)) : '';

  return (
    <View className="gap-2">
      <Text className="px-1 text-sm font-bold text-ink-secondary">Телефон</Text>
      <Pressable
        onPress={onPress}
        className="h-14 flex-row items-center rounded-[18px] border border-line bg-surface-muted px-4 active:opacity-80">
        <View className="flex-row items-center border-r border-line pr-3">
          <Text style={{ fontSize: 19, lineHeight: 23 }}>🇷🇺</Text>
          <Text className="ml-1.5 text-base font-bold text-ink">+7</Text>
        </View>
        <Text className={`ml-3 flex-1 text-base ${masked ? 'text-ink' : 'text-ink-muted'}`} numberOfLines={1}>
          {masked || '(999) 000-00-00'}
        </Text>
        <Ionicons name="chevron-forward" size={19} color={palette.inkMuted} />
      </Pressable>
    </View>
  );
}

export default function ProfileScreen() {
  const { palette } = useAppTheme();
  const user = useSessionStore((s) => s.user);
  const signOut = useSessionStore((s) => s.signOut);
  const setUser = useSessionStore((s) => s.setUser);
  const status = useSessionStore((s) => s.status);
  const { data: activity } = useActivityCounters(status === 'authenticated');
  const markActivityRead = useMarkActivityRead();
  const updateMe = useUpdateMe();
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('basic');
  const vkLinked = !!user?.vk_id;

  const openSection = (scope: ActivityScope, path: string) => {
    markActivityRead.mutate(scope);
    router.push(path as any);
  };

  const { data: sessionsData, refetch: refetchSessions, isLoading: sessionsLoading } = useSessions();
  const {
    data: hostResponseStats,
    isLoading: hostResponseStatsLoading,
  } = useHostResponseStats(user?.id, status === 'authenticated');
  const revokeSession = useRevokeSession();
  const revokeOtherSessions = useRevokeOtherSessions();

  const handleRevokeOther = () => {
    Alert.alert(
      'Завершить другие сеансы',
      'Вы уверены, что хотите завершить все остальные сеансы? Вы выйдете из аккаунта на всех устройствах, кроме этого.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Завершить',
          style: 'destructive',
          onPress: async () => {
            try {
              await revokeOtherSessions.mutateAsync();
              refetchSessions();
              Alert.alert('Успешно', 'Все остальные сеансы успешно завершены.');
            } catch (err) {
              Alert.alert('Ошибка', 'Не удалось завершить сеансы.');
            }
          },
        },
      ]
    );
  };

  const handleRevokeOne = (session: Session) => {
    Alert.alert(
      'Завершить сеанс',
      `Завершить сеанс на устройстве ${session.device_name} (${session.device_os})?`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Завершить',
          style: 'destructive',
          onPress: async () => {
            try {
              await revokeSession.mutateAsync(session.id);
              refetchSessions();
              Alert.alert('Успешно', 'Сеанс успешно завершен.');
            } catch (err) {
              Alert.alert('Ошибка', 'Не удалось завершить сеанс.');
            }
          },
        },
      ]
    );
  };

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
      refetchSessions().catch(() => {});
      return () => {
        active = false;
      };
    }, [setUser, refetchSessions])
  );

  // Editable "Основное" form state (initialised from the cached user on open).
  const [formName, setFormName] = useState('');
  const [formSurname, setFormSurname] = useState('');
  const [formPatronymic, setFormPatronymic] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formCity, setFormCity] = useState('');
  const [formBirthday, setFormBirthday] = useState(''); // YYYY-MM-DD
  const [formAvatarUri, setFormAvatarUri] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [cityPickerVisible, setCityPickerVisible] = useState(false);
  const [birthdayPickerVisible, setBirthdayPickerVisible] = useState(false);
  const [emailChangeVisible, setEmailChangeVisible] = useState(false);
  const [phoneChangeVisible, setPhoneChangeVisible] = useState(false);
  const [deleteSheetVisible, setDeleteSheetVisible] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (settingsVisible) {
      setFormName(user?.name ?? '');
      setFormSurname(user?.surname ?? '');
      setFormPatronymic(user?.patronymic ?? '');
      setFormPhone(user?.phone ?? '');
      setFormCity(user?.city ?? '');
      setFormBirthday(user?.birthday ?? '');
      setFormAvatarUri(user?.avatar_url || null);
      setSaveError(null);
      setSettingsTab('basic');
      tabAnim.setValue(0);
      requestAnimationFrame(() => {
        horizontalScrollRef.current?.scrollTo({ x: 0, animated: false });
      });
    }
  }, [settingsVisible, user]);

  const selectAvatarFromGallery = async (): Promise<string | undefined> => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Разрешение отклонено', 'Нам нужен доступ к галерее для выбора фото.');
      return undefined;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      return result.assets[0].uri;
    }
    return undefined;
  };

  const pickAvatar = async () => {
    const uri = await selectAvatarFromGallery();
    if (uri) setFormAvatarUri(uri);
  };

  const resolveAvatarURL = async (uri: string | null): Promise<string> => {
    if (uri === null) return '';
    if (!uri.startsWith('file://') && !uri.startsWith('content://')) return uri;

    const fileName = uri.split('/').pop() || 'avatar.jpg';
    const ext = fileName.split('.').pop()?.toLowerCase() || 'jpg';
    const mimeType = `image/${ext === 'png' ? 'png' : ext === 'webp' ? 'webp' : 'jpeg'}`;
    const target = await presignMediaUpload(fileName, 1024 * 1024, mimeType, 'avatar');
    await uploadToS3(uri, target, fileName, mimeType);
    return target.key;
  };

  const saveAvatarImmediately = async (uri: string | null) => {
    if (!user || uploadingAvatar) return;
    setUploadingAvatar(true);
    try {
      const avatarURL = await resolveAvatarURL(uri);
      if (avatarURL === (user.avatar_url ?? '')) return;
      const updated = await updateMe.mutateAsync({ avatar_url: avatarURL });
      setUser(updated);
      setFormAvatarUri(updated.avatar_url || null);
    } catch (err) {
      if (!(err instanceof ApiError) || err.status >= 500) {
        console.error('[Profile] Error updating avatar:', err);
      }
      Alert.alert(
        'Не удалось изменить фото',
        err instanceof ApiError ? err.message : 'Попробуйте выбрать фотографию ещё раз.',
      );
    } finally {
      setUploadingAvatar(false);
    }
  };

  const pickAndSaveAvatar = async () => {
    const uri = await selectAvatarFromGallery();
    if (uri) await saveAvatarImmediately(uri);
  };

  const handleProfileAvatarPress = async () => {
    if (uploadingAvatar) return;
    if (user?.avatar_url) {
      Alert.alert('Фото профиля', 'Что вы хотите сделать?', [
        { text: 'Выбрать из галереи', onPress: pickAndSaveAvatar },
        { text: 'Удалить фото', style: 'destructive', onPress: () => saveAvatarImmediately(null) },
        { text: 'Отмена', style: 'cancel' },
      ]);
      return;
    }
    await pickAndSaveAvatar();
  };

  const handleAvatarPress = async () => {
    if (formAvatarUri) {
      Alert.alert('Фото профиля', 'Что вы хотите сделать?', [
        { text: 'Выбрать из галереи', onPress: pickAvatar },
        { text: 'Удалить фото', style: 'destructive', onPress: () => setFormAvatarUri(null) },
        { text: 'Отмена', style: 'cancel' },
      ]);
    } else {
      await pickAvatar();
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    const name = formName.trim();
    const surname = formSurname.trim();
    const patronymic = formPatronymic.trim();
    const phone = formPhone.trim();
    const city = formCity.trim();
    if (name.length < 2) {
      setSaveError('Введите имя (минимум 2 символа)');
      return;
    }
    setSaveError(null);
    setUploadingAvatar(true);
    try {
      const finalAvatarUrl = await resolveAvatarURL(formAvatarUri);

      // Construct update payload containing only changed fields
      const body: UpdateProfileBody = {};
      if (name !== (user.name ?? '')) body.name = name;
      if (surname !== (user.surname ?? '')) body.surname = surname;
      if (patronymic !== (user.patronymic ?? '')) body.patronymic = patronymic;
      if (phone !== (user.phone ?? '')) body.phone = phone;
      if (city !== (user.city ?? '')) body.city = city;
      if (formBirthday && formBirthday !== (user.birthday ?? '')) body.birthday = formBirthday;
      if (finalAvatarUrl !== (user.avatar_url ?? '')) body.avatar_url = finalAvatarUrl;

      if (Object.keys(body).length === 0) {
        closeSettings();
        return;
      }

      const updated = await updateMe.mutateAsync(body);
      setUser(updated);
      closeSettings();
    } catch (err) {
      if (!(err instanceof ApiError) || err.status >= 500) {
        console.error('[Profile] Error saving profile:', err);
      }
      setSaveError(err instanceof ApiError ? err.message : 'Не удалось сохранить профиль.');
    } finally {
      setUploadingAvatar(false);
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

  const handleScroll = useScrollHideTabBar();

  const horizontalScrollRef = useRef<ScrollView>(null);
  const tabAnim = useRef(new Animated.Value(0)).current;
  const windowWidth = Dimensions.get('window').width;
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
      // Ensure scroll view is immediately in the correct page state
      horizontalScrollRef.current?.scrollTo({
        x: settingsTab === 'basic' ? 0 : containerWidth,
        animated: false,
      });
    }
  }, [settingsVisible, settingsTab, containerWidth]);

  const closeSettings = () => {
    setSettingsVisible(false);
  };

  const handleDeleteAccount = () => {
    setDeleteSheetVisible(true);
  };

  const displayName = user
    ? [user.name, user.patronymic, user.surname].filter(Boolean).join(' ')
    : 'Гость';
  const avatarUrl = user?.avatar_url || null;
  const completionItems = useMemo(() => {
    if (!user) return [];
    return [
      {
        id: 'avatar',
        label: 'Добавить аватарку',
        completed: !!(user.avatar_url && user.avatar_url.trim() !== ''),
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
    ];
  }, [user]);

  const completion = useMemo(() => {
    if (completionItems.length === 0) return 0;
    const completedCount = completionItems.filter(item => item.completed).length;
    return Math.round((completedCount / completionItems.length) * 100);
  }, [completionItems]);

  return (
    <View className="flex-1 bg-surface">
      <SafeAreaView edges={['top']} style={{ backgroundColor: palette.surface }}>
        <View
          className="h-[70px] flex-row items-center px-4"
          style={{ borderBottomWidth: 1, borderBottomColor: palette.line }}>
          <NavigationBackButton
            accessibilityLabel="В поиск"
            onPress={() => router.navigate('/')}
            size={48}
            variant="material"
          />
          <View className="flex-1 items-center px-3">
            <Text numberOfLines={1} className="text-xl font-extrabold text-ink">
              Профиль
            </Text>
          </View>
          {status !== 'guest' ? (
            <IconButton
              accessibilityLabel="Настройки профиля"
              icon="settings-outline"
              iconSize={22}
              onPress={() => setSettingsVisible(true)}
              size={48}
            />
          ) : (
            <View className="h-12 w-12" />
          )}
        </View>
      </SafeAreaView>

      {status === 'guest' ? (
        <GuestProfile topInset={12} onScroll={handleScroll as any} />
      ) : (
        <ScrollView
          style={{ backgroundColor: palette.surface }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 128, gap: 16 }}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          <ProfileHero
            avatarUri={avatarUrl}
            city={user?.city}
            initials={initials(user)}
            name={displayName}
            onAvatarPress={handleProfileAvatarPress}
            rating={user?.rating ?? 0}
            subtitle="Личный кабинет"
            uploadingAvatar={uploadingAvatar}
            verifiedLabel={user?.phone_verified_at ? 'Номер подтверждён' : undefined}
          />

          <ProfileMetricGrid
            metrics={[
              { icon: 'home-outline', label: 'Объявления', value: user?.listings_count ?? 0 },
              {
                icon: 'star-outline',
                label: 'Рейтинг',
                value: user?.rating && user.rating > 0 ? user.rating.toFixed(1) : '—',
                tone: 'neutral',
              },
              {
                icon: user?.phone_verified_at ? 'checkmark-circle-outline' : 'call-outline',
                label: 'Номер телефона',
                value: user?.phone_verified_at ? 'Подтверждён' : user?.phone ? 'Не подтверждён' : 'Не указан',
                tone: user?.phone_verified_at ? 'success' : 'neutral',
              },
              {
                icon: 'chatbubbles-outline',
                label: 'Среднее время ответа',
                value: formatHostResponseTime(hostResponseStats),
                loading: hostResponseStatsLoading,
              },
            ]}
          />

          <ProfileActionGroup
            title="Аккаунт"
            items={[
              {
                icon: 'heart-outline',
                title: 'Избранное',
                subtitle: 'Сохранённые объявления',
                onPress: () => {
                  useFiltersStore.setState({ favoritesOnly: true });
                  router.navigate('/');
                },
              },
              {
                icon: 'notifications-outline',
                title: 'Уведомления',
                subtitle: 'Заявки, объявления, сообщения и отзывы',
                count: activity?.notifications,
                onPress: () => router.push('/notifications'),
              },
            ]}
          />

          <ProfileActionGroup
            title="Аренда"
            items={[
              {
                icon: 'home-outline',
                title: 'Мои объявления',
                subtitle: 'Объекты, цены, доступность и продвижение',
                count: activity?.listings,
                onPress: () => openSection('listings', '/my-listings'),
              },
              {
                icon: 'reader-outline',
                title: 'Мои брони',
                subtitle: 'Ваши заявки и подтверждённые бронирования',
                count: activity?.bookings,
                onPress: () => openSection('bookings', '/bookings'),
              },
              {
                icon: 'file-tray-full-outline',
                title: 'Входящие заявки',
                subtitle: 'Запросы гостей на бронирование жилья',
                count: activity?.incoming,
                onPress: () => openSection('incoming', '/incoming'),
              },
              {
                icon: 'star-outline',
                title: 'Мои отзывы',
                subtitle: 'Оставленные и полученные отзывы',
                count: activity?.reviews,
                onPress: () => openSection('reviews', '/my-reviews'),
              },
            ]}
          />

          <ProfileInfoPanel title="Заполнение профиля">
            <View className="flex-row items-center justify-between">
              <Text className="text-sm font-semibold text-ink-secondary">
                {completion === 100 ? 'Всё готово' : 'Осталось немного'}
              </Text>
              <Text className="text-sm font-extrabold text-primary">{completion}%</Text>
            </View>
            <View className="mt-3 h-2 overflow-hidden rounded-pill bg-surface-muted">
              <View className="h-full rounded-pill bg-primary" style={{ width: `${completion}%` }} />
            </View>
            {completion === 100 ? (
              <View className="mt-4 flex-row items-center gap-3 rounded-field bg-success-light px-4 py-3">
                <Ionicons name="checkmark-circle" size={21} color={palette.success} />
                <Text className="flex-1 text-sm font-bold text-success">Основные данные заполнены</Text>
              </View>
            ) : (
              <View className="mt-4 gap-2">
                {completionItems.filter((item) => !item.completed).map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    activeOpacity={0.68}
                    onPress={item.onPress}
                    className="flex-row items-center rounded-field bg-surface-muted px-4 py-3">
                    <Ionicons name="add-circle-outline" size={20} color={palette.primary} />
                    <Text className="ml-3 flex-1 text-sm font-bold text-ink">{item.label}</Text>
                    <Ionicons name="chevron-forward" size={16} color={palette.inkMuted} />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </ProfileInfoPanel>

          <ThemeSelector />

          <ProfileInfoPanel title="О приложении">
            <View className="flex-row justify-between border-b border-line pb-3">
              <Text className="text-sm text-ink-secondary">Версия</Text>
              <Text className="text-sm font-semibold text-ink">1.0.0</Text>
            </View>
            <View className="flex-row justify-between border-b border-line py-3">
              <Text className="text-sm text-ink-secondary">Поддержка</Text>
              <Text className="text-sm font-bold text-primary">support@domryadom.ru</Text>
            </View>
            <View className="flex-row justify-between pt-3">
              <Text className="text-sm text-ink-secondary">Язык</Text>
              <Text className="text-sm font-semibold text-ink">Русский</Text>
            </View>
          </ProfileInfoPanel>

          <Button label="Выйти" icon="log-out-outline" variant="secondary" onPress={signOut} />
        </ScrollView>
      )}

      <Modal
        visible={settingsVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={closeSettings}
      >
        <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-surface px-4 pt-2 pb-6">
              <View className="h-16 flex-row items-center">
                <IconButton
                  accessibilityLabel="Закрыть настройки"
                  icon="close"
                  iconSize={22}
                  onPress={closeSettings}
                  size={48}
                />
                <View className="flex-1 items-center px-2">
                  <Text className="text-xl font-extrabold text-ink">Настройки профиля</Text>
                </View>
                <View className="h-12 w-12 items-center justify-center rounded-full bg-primary-light">
                  <Text className="text-xs font-extrabold text-primary">{completion}%</Text>
                </View>
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
                  keyboardShouldPersistTaps="handled"
                  contentContainerClassName="gap-4 pt-5 pb-28"
                  style={{ width: containerWidth }}
                >
                  <MaterialSurface level="raised" radius={24}>
                    <TouchableOpacity
                      onPress={handleAvatarPress}
                      activeOpacity={0.78}
                      disabled={uploadingAvatar}
                      className="relative p-4">
                      <View className="flex-row items-center gap-4">
                        {formAvatarUri ? (
                          <Image source={{ uri: formAvatarUri }} className="h-20 w-20 rounded-[22px]" />
                        ) : (
                          <View className="h-20 w-20 items-center justify-center rounded-[22px] border border-line bg-surface-muted">
                            <Ionicons name="person" size={32} color={palette.inkMuted} />
                          </View>
                        )}
                        <View className="flex-1">
                          <Text className="text-lg font-extrabold text-ink">Фото профиля</Text>
                          <Text className="mt-1 text-sm leading-5 text-ink-secondary">
                            {uploadingAvatar ? 'Загрузка...' : 'Нажмите, чтобы изменить фотографию'}
                          </Text>
                        </View>
                        <View className="h-10 w-10 items-center justify-center rounded-full bg-primary-light">
                          <Ionicons name="camera-outline" size={20} color={palette.primary} />
                        </View>
                        {uploadingAvatar ? (
                          <View className="absolute inset-0 items-center justify-center rounded-[24px] bg-black/30">
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          </View>
                        ) : null}
                      </View>
                    </TouchableOpacity>
                  </MaterialSurface>

                  <Text className="mt-1 px-1 text-lg font-extrabold text-ink">Личные данные</Text>

                  <EditableField
                    label="Имя"
                    value={formName}
                    onChangeText={setFormName}
                    icon="person-outline"
                    placeholder="Ваше имя"
                  />
                  <EditableField
                    label="Фамилия"
                    value={formSurname}
                    onChangeText={setFormSurname}
                    icon="person-outline"
                    placeholder="Ваша фамилия (необязательно)"
                  />
                  <EditableField
                    label="Отчество"
                    value={formPatronymic}
                    onChangeText={setFormPatronymic}
                    icon="person-outline"
                    placeholder="Ваше отчество (необязательно)"
                  />

                  <Text className="mt-2 px-1 text-lg font-extrabold text-ink">Контакты и город</Text>
                  <PhonePickerField value={user?.phone} onPress={() => setPhoneChangeVisible(true)} />
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
                  contentContainerClassName="gap-4 pt-5 pb-28"
                  style={{ width: containerWidth }}
                >
                  <Text className="px-1 text-lg font-extrabold text-ink">Способы входа</Text>
                  <MaterialSurface level="raised" radius={22} style={{ padding: 16, gap: 14 }}>
                    <Pressable
                      onPress={() => setEmailChangeVisible(true)}
                      className="flex-row items-center justify-between active:opacity-70"
                    >
                      <View className="h-11 w-11 items-center justify-center rounded-full bg-primary-light">
                        <Ionicons name="mail-outline" size={21} color={palette.primary} />
                      </View>
                      <View className="ml-3 flex-1 pr-2">
                        <Text className="text-base font-extrabold text-ink">Электронная почта</Text>
                        <Text className="mt-1 text-sm text-ink-secondary">{valueOrPlaceholder(user?.email)}</Text>
                      </View>
                      <View className="flex-row items-center gap-2">
                        <View className={`rounded-pill px-3 py-1 ${user?.email ? 'bg-success-light' : 'bg-surface-muted'}`}>
                          <Text className={`text-xs font-bold ${user?.email ? 'text-success' : 'text-ink-secondary'}`}>
                            {user?.email ? 'Подтверждена' : 'Добавить'}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color={palette.inkMuted} />
                      </View>
                    </Pressable>
                    <View className="h-px bg-line" />
                    <Pressable
                      onPress={() => setPhoneChangeVisible(true)}
                      className="flex-row items-center justify-between active:opacity-70">
                      <View className="h-11 w-11 items-center justify-center rounded-full bg-primary-light">
                        <Ionicons name="call-outline" size={21} color={palette.primary} />
                      </View>
                      <View className="ml-3 flex-1 pr-2">
                        <Text className="text-base font-extrabold text-ink">Номер телефона</Text>
                        <Text className="mt-1 text-sm text-ink-secondary">
                          {user?.phone
                            ? `+7 ${formatPhoneMask(normalizePhoneDigits(user.phone))}`
                            : 'Не заполнено'}
                        </Text>
                      </View>
                      <View className="flex-row items-center gap-2">
                        <View className={`rounded-pill px-3 py-1 ${user?.phone_verified_at ? 'bg-success-light' : 'bg-surface-muted'}`}>
                          <Text className={`text-xs font-bold ${user?.phone_verified_at ? 'text-success' : 'text-primary'}`}>
                            {user?.phone_verified_at ? 'Подтвержден' : user?.phone ? 'Подтвердить' : 'Добавить'}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color={palette.inkMuted} />
                      </View>
                    </Pressable>
                  </MaterialSurface>

                  <View className="gap-3">
                    <Text className="text-lg font-extrabold text-ink">Устройства входа</Text>
                    {sessionsLoading ? (
                      <ActivityIndicator size="small" color={palette.primary} className="py-4" />
                    ) : (
                      <>
                        {/* Current Session */}
                        {sessionsData?.current && (
                          <MaterialSurface level="raised" radius={20} style={{ padding: 16 }}>
                            <View className="flex-row items-center gap-3">
                              <View className="h-11 w-11 items-center justify-center rounded-full bg-primary-light">
                                <Ionicons
                                  name={getDeviceIcon(sessionsData.current.device_os)}
                                  size={21}
                                  color={palette.primary}
                                />
                              </View>
                              <View className="flex-1">
                                <View className="flex-row items-center gap-2">
                                  <Text className="font-bold leading-5 text-ink">
                                    {sessionsData.current.device_name || 'Текущее устройство'}
                                  </Text>
                                  <View className="rounded-pill bg-success-light px-2 py-0.5">
                                    <Text className="text-[10px] font-bold uppercase text-success">Сейчас</Text>
                                  </View>
                                </View>
                                <Text className="mt-1 text-xs leading-4 text-ink-secondary">
                                  {sessionsData.current.location || 'Неизвестно'} • {sessionsData.current.ip_address}
                                </Text>
                                <Text className="mt-0.5 text-[10px] leading-4 text-ink-muted">
                                  Дом рядом v{sessionsData.current.app_version || '1.0.0'} • {sessionsData.current.device_os}
                                </Text>
                              </View>
                            </View>
                          </MaterialSurface>
                        )}

                        {/* Other Active Sessions */}
                        {sessionsData?.active && sessionsData.active.map((session) => (
                          <MaterialSurface key={session.id} level="raised" radius={20}>
                            <Pressable
                              onPress={() => handleRevokeOne(session)}
                              className="flex-row items-center gap-3 p-4 active:opacity-75">
                              <View className="h-11 w-11 items-center justify-center rounded-full bg-surface-muted">
                                <Ionicons
                                  name={getDeviceIcon(session.device_os)}
                                  size={21}
                                  color={palette.inkSecondary}
                                />
                              </View>
                              <View className="flex-1">
                                <Text className="font-bold leading-5 text-ink">
                                  {session.device_name || 'Неизвестное устройство'}
                                </Text>
                                <Text className="mt-1 text-xs leading-4 text-ink-secondary">
                                  {session.location || 'Неизвестно'} • {session.ip_address}
                                </Text>
                                <Text className="mt-0.5 text-[10px] leading-4 text-ink-muted">
                                  {session.device_os} • {formatRelativeTime(session.last_active_at)}
                                </Text>
                              </View>
                              <Ionicons name="trash-outline" size={18} color={palette.danger} />
                            </Pressable>
                          </MaterialSurface>
                        ))}

                        {/* Revoke All Other Sessions Button */}
                        {sessionsData?.active && sessionsData.active.length > 0 && (
                          <Pressable
                            onPress={handleRevokeOther}
                            className="h-11 items-center justify-center rounded-field bg-danger-light active:bg-danger/25 border border-danger/10 mt-1"
                          >
                            <Text className="text-sm font-bold text-danger">Завершить все другие сеансы</Text>
                          </Pressable>
                        )}
                      </>
                    )}
                  </View>

                  <View className="gap-3 mt-6">
                    <Text className="text-lg font-extrabold" style={{ color: palette.danger }}>Опасная зона</Text>
                    <MaterialSurface level="raised" radius={22} style={{ padding: 16 }}>
                      <View className="flex-row items-start gap-3">
                        <View className="h-11 w-11 items-center justify-center rounded-full bg-danger-light">
                          <Ionicons name="trash-outline" size={20} color={palette.danger} />
                        </View>
                        <View className="flex-1">
                          <Text className="text-base font-extrabold text-ink">Удаление аккаунта</Text>
                          <Text className="mt-1 text-sm leading-5 text-ink-secondary">
                            Удаление профиля является окончательным действием. Все ваши объявления, переписка и бронирования будут безвозвратно удалены.
                          </Text>
                        </View>
                      </View>
                      <View className="mt-4">
                        <Button label="Удалить профиль" icon="trash-outline" variant="danger" size="md" onPress={handleDeleteAccount} />
                      </View>
                    </MaterialSurface>
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
                if (city) setFormCity(city);
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
            <PhoneChangeSheet
              visible={phoneChangeVisible}
              onClose={() => setPhoneChangeVisible(false)}
            />
            <AccountDeleteSheet
              visible={deleteSheetVisible}
              onClose={() => setDeleteSheetVisible(false)}
            />
      </Modal>
    </View>
  );
}
