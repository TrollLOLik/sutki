import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { Animated, Alert, Dimensions, Easing, Image, Modal, Pressable, ScrollView, Text, TextInput, View, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

import { BirthdayPickerSheet, formatBirthday } from '@/components/BirthdayPickerSheet';
import { CityPickerSheet } from '@/components/CityPickerSheet';
import { EmailChangeSheet } from '@/components/EmailChangeSheet';
import { AccountDeleteSheet } from '@/components/AccountDeleteSheet';
import { Button, MetricTile, PastelIcon } from '@/components/ui';
import { useScrollHideTabBar } from '@/hooks/useScrollHideTabBar';
import { useShimmer } from '@/hooks/useShimmer';
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
import type { UpdateProfileBody } from '@/types/auth';
import type { User } from '@/types/user';
import { GuestProfile } from '@/components/profile/GuestProfile';
import { ThemeSelector } from '@/components/profile/ThemeSelector';

type SettingsTab = 'basic' | 'security';

const FALLBACK_AVATAR = 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=240&h=240&fit=crop';

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

function SettingsField({ label, value, icon }: { label: string; value: string; icon: keyof typeof Ionicons.glyphMap }) {
  const { palette } = useAppTheme();
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
  const { palette } = useAppTheme();
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
  const { palette } = useAppTheme();
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
  const { palette } = useAppTheme();
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
  const { palette, isDark } = useAppTheme();
  const user = useSessionStore((s) => s.user);
  const signOut = useSessionStore((s) => s.signOut);
  const setUser = useSessionStore((s) => s.setUser);
  const status = useSessionStore((s) => s.status);
  const updateMe = useUpdateMe();
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('basic');
  const vkLinked = !!user?.vk_id;

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

  // User card shimmer sweep animation (блеск/переливание)
  const shimmerAnim = useShimmer();


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
      setFormAvatarUri(result.assets[0].uri);
    }
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
      let finalAvatarUrl = user?.avatar_url || '';

      if (formAvatarUri === null) {
        finalAvatarUrl = '';
      } else if (formAvatarUri.startsWith('file://') || formAvatarUri.startsWith('content://')) {
        // Local file, upload to S3
        const fileName = formAvatarUri.split('/').pop() || 'avatar.jpg';
        const ext = fileName.split('.').pop() || 'jpg';
        const mimeType = `image/${ext === 'png' ? 'png' : ext === 'webp' ? 'webp' : 'jpeg'}`;
        const size = 1024 * 1024; // fallback size

        const target = await presignMediaUpload(fileName, size, mimeType, 'avatar');
        await uploadToS3(formAvatarUri, target, fileName, mimeType);
        finalAvatarUrl = target.key;
      } else {
        finalAvatarUrl = formAvatarUri;
      }

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
      console.error('[Profile] Error saving profile:', err);
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

  const insets = useSafeAreaInsets();
  const handleScroll = useScrollHideTabBar();

  const scrollY = useRef(new Animated.Value(0)).current;

  const bannerScale = scrollY.interpolate({
    inputRange: [-150, 0],
    outputRange: [1.2, 1],
    extrapolateRight: 'clamp',
  });

  const bannerTranslateY = scrollY.interpolate({
    inputRange: [-150, 0, 250],
    outputRange: [0, 0, 75],
    extrapolate: 'clamp',
  });

  const bannerOpacity = scrollY.interpolate({
    inputRange: [0, 120],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const isHeaderVisibleRef = useRef(false);
  const animVisible = useRef(new Animated.Value(0)).current;

  const headerBgOpacity = animVisible;
  const titleOpacity = animVisible;

  const buttonBgOpacity = useMemo(() => {
    return animVisible.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 0],
    });
  }, [animVisible]);

  const titleTranslateY = useMemo(() => {
    return animVisible.interpolate({
      inputRange: [0, 1],
      outputRange: [10, 0],
    });
  }, [animVisible]);

  const iconColor = useMemo(() => {
    return animVisible.interpolate({
      inputRange: [0, 1],
      outputRange: ['#FFFFFF', palette.ink],
    });
  }, [animVisible]);

  const handleMainScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    {
      useNativeDriver: false,
      listener: (event: any) => {
        const y = event.nativeEvent.contentOffset.y;
        handleScroll(event);

        const threshold = 120;
        if (y >= threshold) {
          if (!isHeaderVisibleRef.current) {
            isHeaderVisibleRef.current = true;
            Animated.timing(animVisible, {
              toValue: 1,
              duration: 200,
              useNativeDriver: false,
            }).start();
          }
        } else {
          if (isHeaderVisibleRef.current) {
            isHeaderVisibleRef.current = false;
            Animated.timing(animVisible, {
              toValue: 0,
              duration: 200,
              useNativeDriver: false,
            }).start();
          }
        }
      },
    }
  );

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
    <View className="flex-1 bg-surface-muted">
      {/* Sticky Header */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 20,
          paddingTop: (insets.top || 0) + 12,
          paddingBottom: 12,
        }}
        className="flex-row items-center px-4"
      >
        {/* Animated Solid Background Overlay */}
        <Animated.View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: palette.surface,
            borderBottomWidth: 1,
            borderBottomColor: palette.line,
            opacity: headerBgOpacity,
          }}
        />

        {/* Back to Search Button */}
        <Pressable
          onPress={() => router.navigate('/')}
          accessibilityLabel="В поиск"
          className="h-10 w-10 items-center justify-center rounded-full active:opacity-80 relative"
        >
          {status === 'guest' ? (
            // Guest has no gradient banner — always show dark icon on muted bg
            <View className="h-10 w-10 items-center justify-center rounded-full bg-surface-muted">
              <Ionicons name="chevron-back" size={24} color={palette.ink} />
            </View>
          ) : (
            <>
              <Animated.View style={{ position: 'absolute', opacity: buttonBgOpacity }}>
                <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
              </Animated.View>
              <Animated.View style={{ opacity: animVisible }}>
                <Ionicons name="chevron-back" size={24} color={palette.ink} />
              </Animated.View>
            </>
          )}
        </Pressable>

        {/* Title in center */}
        <View className="flex-1 px-3 justify-center items-center">
          <Animated.View
            style={{
              opacity: titleOpacity,
              transform: [{ translateY: titleTranslateY }],
            }}
          >
            <Text numberOfLines={1} className="text-base font-bold text-ink">
              Личный кабинет
            </Text>
          </Animated.View>
        </View>

        {/* Settings Button */}
        {status !== 'guest' ? (
          <Pressable
            accessibilityLabel="Настройки профиля"
            accessibilityRole="button"
            onPress={() => setSettingsVisible(true)}
            className="h-10 w-10 items-center justify-center rounded-full active:opacity-80 relative"
          >
            <Animated.View style={{ position: 'absolute', opacity: buttonBgOpacity }}>
              <Ionicons name="settings-outline" size={22} color="#FFFFFF" />
            </Animated.View>
            <Animated.View style={{ opacity: animVisible }}>
              <Ionicons name="settings-outline" size={22} color={palette.ink} />
            </Animated.View>
          </Pressable>
        ) : (
          <View className="h-10 w-10" />
        )}
      </View>

      {status === 'guest' ? (
        <GuestProfile
          topInset={(insets.top || 0) + 56}
          onScroll={handleMainScroll as any}
        />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerClassName="pb-28"
          onScroll={handleMainScroll}
          scrollEventThrottle={16}
      >
        <AnimatedLinearGradient
          colors={isDark ? ['#8C4E2D', '#3B1E30', '#1A0D1D'] : ['#FF8E53', '#FF5A1F', '#FF2D55']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            borderBottomLeftRadius: 32,
            borderBottomRightRadius: 32,
            paddingTop: (insets.top || 0) + 64,
            paddingBottom: 24,
            paddingHorizontal: 20,
            overflow: 'hidden',
            position: 'relative',
            transform: [
              { scale: bannerScale },
              { translateY: bannerTranslateY },
            ],
            opacity: bannerOpacity,
          }}
        >
          <View className="flex-row items-center gap-4">
            {/* Avatar container with double white border rings */}
            <View className="h-[84px] w-[84px] items-center justify-center rounded-full border border-white/40 p-[3px] flex-shrink-0">
              <View className="h-full w-full items-center justify-center rounded-full border-2 border-white bg-primary-light overflow-hidden">
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} className="h-full w-full rounded-full" />
                ) : (
                  <Text className="text-xl font-extrabold text-primary">{initials(user)}</Text>
                )}
              </View>
            </View>

            <View className="flex-1 justify-center">
              <View className="self-start rounded-pill bg-white/20 px-3 py-1">
                <Text className="text-xs font-bold text-white">Дом рядом</Text>
              </View>
              <Text numberOfLines={2} className="mt-1 text-2xl font-extrabold leading-8 text-white">
                {displayName}
              </Text>
              <Text numberOfLines={1} className="mt-0.5 text-sm leading-5 text-white opacity-95">
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
        </AnimatedLinearGradient>

        <View className="px-4">
          <View className="mt-4 flex-row gap-3">
            <MetricTile
              label="объявления"
              value={user?.listings_count ?? 0}
            />
            <MetricTile
              label="рейтинг"
              value={user?.rating && user.rating > 0 ? user.rating.toFixed(1) : '—'}
            />
          </View>

          <View className="mt-5 flex-row gap-3">
            <MetricTile
              label="Проверка профиля"
              value="Готово"
              icon={<PastelIcon name="shield-checkmark-outline" />}
            />
            <MetricTile
              label="Ответы хозяев"
              value={formatHostResponseTime(hostResponseStats)}
              loading={hostResponseStatsLoading}
              icon={<PastelIcon name="chatbubbles-outline" />}
            />
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
              <Text style={{ color: palette.surface }} className="ml-2 text-base font-bold">Открыть настройки</Text>
            </Pressable>
          </View>

          <View className="mt-4">
            <ThemeSelector />
          </View>

          <View className="mt-6">
            <Button label="Выйти" variant="secondary" onPress={signOut} />
          </View>

          <View className="mt-6 border border-line bg-surface p-4 rounded-card"
            style={{ shadowColor: palette.ink, shadowOpacity: 0.02, shadowRadius: 10 }}>
            <Text className="text-sm font-extrabold text-ink mb-3">О приложении</Text>
            <View className="gap-3">
              <View className="flex-row justify-between py-1 border-b border-line pb-2">
                <Text className="text-sm text-ink-secondary">Версия</Text>
                <Text className="text-sm text-ink font-semibold">1.0.0</Text>
              </View>
              <View className="flex-row justify-between py-1 border-b border-line pb-2">
                <Text className="text-sm text-ink-secondary">Поддержка</Text>
                <Text className="text-sm text-primary font-bold">support@domryadom.ru</Text>
              </View>
              <View className="flex-row justify-between py-1">
                <Text className="text-sm text-ink-secondary">Язык</Text>
                <Text className="text-sm text-ink font-semibold">Русский</Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
      )}

      <Modal
        visible={settingsVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={closeSettings}
      >
        <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-surface px-4 pt-2 pb-6">
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
                  <TouchableOpacity
                    onPress={handleAvatarPress}
                    activeOpacity={0.7}
                    disabled={uploadingAvatar}
                    className="rounded-[24px] border border-line bg-surface-muted p-4 relative"
                    style={{ borderRadius: 24 }}
                  >
                    <View className="flex-row items-center gap-4">
                      {formAvatarUri ? (
                        <Image source={{ uri: formAvatarUri }} className="h-20 w-20 rounded-[24px]" />
                      ) : (
                        <View className="h-20 w-20 rounded-[24px] bg-surface border border-line items-center justify-center">
                          <Ionicons name="person" size={32} color={palette.inkMuted} />
                        </View>
                      )}
                      <View className="flex-1">
                        <Text className="text-lg font-extrabold text-ink">Фото профиля</Text>
                        <Text className="mt-1 text-sm leading-5 text-ink-secondary">
                          {uploadingAvatar ? 'Загрузка...' : 'Нажмите для изменения или удаления фотографии.'}
                        </Text>
                      </View>
                      {uploadingAvatar && (
                        <View className="absolute inset-0 bg-black/30 items-center justify-center rounded-[24px]" style={{ borderRadius: 24 }}>
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>

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
                    {sessionsLoading ? (
                      <ActivityIndicator size="small" color={palette.primary} className="py-4" />
                    ) : (
                      <>
                        {/* Current Session */}
                        {sessionsData?.current && (
                          <View className="flex-row items-center gap-3 rounded-card border border-line bg-surface p-4">
                            <View className="h-11 w-11 items-center justify-center rounded-full bg-primary-light">
                              <Ionicons
                                name={getDeviceIcon(sessionsData.current.device_os)}
                                size={21}
                                color={palette.primary}
                              />
                            </View>
                            <View className="flex-1">
                              <View className="flex-row items-center gap-2">
                                <Text className="font-bold text-ink leading-5">
                                  {sessionsData.current.device_name || 'Текущее устройство'}
                                </Text>
                                <View className="rounded-pill bg-success-light px-2 py-0.5">
                                  <Text className="text-[10px] font-bold text-success uppercase">Сейчас</Text>
                                </View>
                              </View>
                              <Text className="mt-1 text-xs text-ink-secondary leading-4">
                                {sessionsData.current.location || 'Неизвестно'} • {sessionsData.current.ip_address}
                              </Text>
                              <Text className="text-[10px] text-ink-muted leading-4 mt-0.5">
                                Sutki.ru v{sessionsData.current.app_version || '1.0.0'} • {sessionsData.current.device_os}
                              </Text>
                            </View>
                          </View>
                        )}

                        {/* Other Active Sessions */}
                        {sessionsData?.active && sessionsData.active.map((session) => (
                          <Pressable
                            key={session.id}
                            onPress={() => handleRevokeOne(session)}
                            className="flex-row items-center gap-3 rounded-card border border-line bg-surface p-4 active:bg-surface-muted"
                          >
                            <View className="h-11 w-11 items-center justify-center rounded-full bg-surface-muted">
                              <Ionicons
                                name={getDeviceIcon(session.device_os)}
                                size={21}
                                color={palette.inkSecondary}
                              />
                            </View>
                            <View className="flex-1">
                              <Text className="font-bold text-ink leading-5">
                                {session.device_name || 'Неизвестное устройство'}
                              </Text>
                              <Text className="mt-1 text-xs text-ink-secondary leading-4">
                                {session.location || 'Неизвестно'} • {session.ip_address}
                              </Text>
                              <Text className="text-[10px] text-ink-muted leading-4 mt-0.5">
                                {session.device_os} • {formatRelativeTime(session.last_active_at)}
                              </Text>
                            </View>
                            <Ionicons name="trash-outline" size={18} color={palette.danger} />
                          </Pressable>
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
            <AccountDeleteSheet
              visible={deleteSheetVisible}
              onClose={() => setDeleteSheetVisible(false)}
            />
      </Modal>
    </View>
  );
}
