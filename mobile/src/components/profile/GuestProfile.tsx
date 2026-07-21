import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import type { NativeSyntheticEvent, NativeScrollEvent } from 'react-native';

import { Button } from '@/components/ui';
import { useFiltersStore } from '@/store/filters';
import { requireAuth } from '@/lib/requireAuth';
import { useAppTheme } from '@/theme/useAppTheme';
import { ThemeSelector } from '@/components/profile/ThemeSelector';
import {
  ProfileActionGroup,
  ProfileHero,
  ProfileInfoPanel,
  ProfileMetricGrid,
} from '@/components/profile/ProfileOverview';

export function GuestProfile({
  topInset,
  onScroll,
}: {
  topInset: number;
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
}) {
  const { palette } = useAppTheme();
  const router = useRouter();

  const handleShowLocalFavorites = () => {
    useFiltersStore.setState({ favoritesOnly: true });
    router.navigate('/');
  };

  const handleAuthAction = (context: 'host' | 'generic') => {
    requireAuth(context);
  };

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      onScroll={onScroll}
      scrollEventThrottle={16}
      style={{ backgroundColor: palette.surface }}
      contentContainerStyle={{ paddingTop: topInset, paddingHorizontal: 16, paddingBottom: 112, gap: 16 }}>
      <ProfileHero
        badge="Гостевой режим"
        initials="Г"
        name="Вы не вошли"
        subtitle="Избранное хранится на этом устройстве"
      />

      <ProfileInfoPanel>
        <View className="flex-row items-start gap-3">
          <View className="h-11 w-11 items-center justify-center rounded-full bg-primary-light">
            <Ionicons name="key-outline" size={21} color={palette.primary} />
          </View>
          <View className="flex-1">
            <Text className="text-base font-extrabold text-ink">Войдите в аккаунт</Text>
            <Text className="mt-1 text-sm leading-5 text-ink-secondary">
              Бронируйте жильё, общайтесь с арендодателями и управляйте своими объявлениями.
            </Text>
          </View>
        </View>
        <View className="mt-4">
          <Button label="Войти или зарегистрироваться" icon="log-in-outline" onPress={() => router.push('/welcome')} />
        </View>
      </ProfileInfoPanel>

      <ProfileMetricGrid
        metrics={[
          { icon: 'home-outline', label: 'Объявления', value: '—', tone: 'neutral' },
          { icon: 'star-outline', label: 'Рейтинг', value: '—', tone: 'neutral' },
          { icon: 'call-outline', label: 'Номер телефона', value: 'Не указан', tone: 'neutral' },
          { icon: 'chatbubbles-outline', label: 'Сообщения', value: '—', tone: 'neutral' },
        ]}
      />

      <ProfileActionGroup
        title="На этом устройстве"
        items={[
          {
            icon: 'heart-outline',
            title: 'Избранное',
            subtitle: 'Жильё, сохранённое без аккаунта',
            onPress: handleShowLocalFavorites,
          },
        ]}
      />

      <ProfileActionGroup
        title="После входа"
        items={[
          {
            icon: 'home-outline',
            title: 'Мои объявления',
            subtitle: 'Объекты, цены и календарь доступности',
            onPress: () => handleAuthAction('host'),
            disabled: true,
          },
          {
            icon: 'star-outline',
            title: 'Мои отзывы',
            subtitle: 'Оставленные и полученные отзывы',
            onPress: () => handleAuthAction('generic'),
            disabled: true,
          },
        ]}
      />

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
    </ScrollView>
  );
}
