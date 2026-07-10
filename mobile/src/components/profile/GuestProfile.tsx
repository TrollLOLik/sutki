import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import type { NativeSyntheticEvent, NativeScrollEvent } from 'react-native';

import { MetricTile } from '@/components/ui';
import { useFiltersStore } from '@/store/filters';
import { requireAuth } from '@/lib/requireAuth';
import { useAppTheme } from '@/theme/useAppTheme';
import { ThemeSelector } from '@/components/profile/ThemeSelector';

function GuestProfileAction({
  icon,
  title,
  subtitle,
  onPress,
  disabled = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { palette } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className={`flex-row items-center gap-3 rounded-card border border-line bg-surface px-4 py-4 ${disabled ? 'opacity-65' : 'active:bg-surface-muted'}`}
      style={{ shadowColor: palette.ink, shadowOpacity: 0.04, shadowRadius: 14, shadowOffset: { width: 0, height: 8 } }}
    >
      <View className="h-12 w-12 items-center justify-center rounded-field bg-primary-light">
        <Ionicons name={icon} size={23} color={palette.primary} />
      </View>
      <View className="flex-1 gap-0.5">
        <Text className="text-base font-bold text-ink">{title}</Text>
        <Text className="text-sm text-ink-secondary">{subtitle}</Text>
      </View>
      <Ionicons name={disabled ? 'lock-closed-outline' : 'chevron-forward'} size={20} color={palette.inkMuted} />
    </Pressable>
  );
}

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
      contentContainerStyle={{ paddingTop: topInset, paddingBottom: 112, backgroundColor: palette.surfaceMuted }}
    >
      {/* Top white surface patch — covers the area above the card fully */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: topInset + 200, backgroundColor: palette.surface }} pointerEvents="none" />

      <View
        style={{
          borderBottomLeftRadius: 32,
          borderBottomRightRadius: 32,
          backgroundColor: palette.surface,
          paddingBottom: 24,
          paddingHorizontal: 20,
          borderBottomWidth: 1,
          borderBottomColor: palette.line,
        }}
        className="items-center justify-center gap-4 py-6"
      >
        <View className="h-[84px] w-[84px] items-center justify-center rounded-full border border-line p-[3px]">
          <View className="h-full w-full items-center justify-center rounded-full bg-surface-muted overflow-hidden">
            <Ionicons name="person-outline" size={40} color={palette.inkMuted} />
          </View>
        </View>

        <View className="items-center">
          <Text className="text-xl font-extrabold text-ink">Вы не вошли</Text>
          <Text className="text-sm text-ink-secondary mt-1 text-center px-6 leading-5">
            Войдите, чтобы бронировать жилье и общаться с хозяевами. Избранное пока хранится на этом устройстве
          </Text>
          <Pressable
            onPress={() => router.push('/welcome')}
            className="mt-4 bg-primary px-5 py-2.5 rounded-field active:opacity-90"
          >
            <Text className="text-sm font-bold text-white">Войти или зарегистрироваться</Text>
          </Pressable>
        </View>
      </View>

      <View className="px-4">
        <View className="mt-4 flex-row gap-3 opacity-50">
          <MetricTile label="объявления" value={0} />
          <MetricTile label="рейтинг" value="—" />
        </View>

        <View className="mt-6 gap-3">
          <GuestProfileAction
            icon="home-outline"
            title="Мои объявления"
            subtitle="Управляйте объектами, ценами и календарём"
            onPress={() => handleAuthAction('host')}
            disabled
          />
          <GuestProfileAction
            icon="star-outline"
            title="Мои отзывы"
            subtitle="Отзывы, которые вы оставили или получили"
            onPress={() => handleAuthAction('host')}
            disabled
          />

          <View className="h-px bg-line my-2" />

          <GuestProfileAction
            icon="heart-outline"
            title="Избранное (локальное)"
            subtitle="Жилье, сохраненное на этом устройстве"
            onPress={handleShowLocalFavorites}
          />
        </View>

        <View className="mt-4">
          <ThemeSelector />
        </View>

        <View className="mt-6 border border-line bg-surface p-4 rounded-card" style={{ shadowColor: palette.ink, shadowOpacity: 0.02, shadowRadius: 10 }}>
          <Text className="text-sm font-extrabold text-ink mb-3">О приложении</Text>
          <View className="gap-3">
            <View className="flex-row justify-between py-1 border-b border-line pb-2">
              <Text className="text-sm text-ink-secondary">Версия</Text>
              <Text className="text-sm text-ink font-semibold">1.0.0 (Guest)</Text>
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
  );
}
