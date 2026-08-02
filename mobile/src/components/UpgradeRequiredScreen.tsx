import { Ionicons } from '@expo/vector-icons';
import { Linking, Platform, Text, View } from 'react-native';

import { Button } from '@/components/ui';
import { useAppVersionStore } from '@/store/appVersion';
import { useAppTheme } from '@/theme/useAppTheme';

/**
 * Terminal screen shown when the backend reports this build as unsupported.
 *
 * Blocking is the point. Once the API refuses this version, every screen behind
 * it is a screen whose requests will fail — showing them would only produce a
 * stream of "что-то пошло не так" with no explanation. There is deliberately no
 * dismiss: the only way forward is to update.
 */
export function UpgradeRequiredScreen() {
  const { palette } = useAppTheme();
  const minimum = useAppVersionStore((s) => s.minimumSupportedVersion);

  const openStore = () => {
    // RuStore is the distribution channel for the Android build; iOS falls back
    // to the App Store listing. A failed open is non-fatal — the message above
    // already tells the user what to do.
    const url =
      Platform.OS === 'ios'
        ? 'itms-apps://apps.apple.com/app/id0000000000'
        : 'https://apps.rustore.ru/app/ru.wigaj.arenda';
    Linking.openURL(url).catch(() => {});
  };

  return (
    <View className="flex-1 items-center justify-center gap-6 bg-surface px-8">
      <View className="h-20 w-20 items-center justify-center rounded-full bg-primary-light">
        <Ionicons name="cloud-download-outline" size={40} color={palette.primary} />
      </View>
      <View className="gap-3">
        <Text className="text-center text-xl font-extrabold text-ink">
          Необходимо обновить приложение
        </Text>
        <Text className="text-center text-base leading-6 text-ink-secondary">
          Эта версия «ВИГАЖ» больше не поддерживается. Обновите приложение, чтобы продолжить
          пользоваться сервисом.
        </Text>
        {minimum ? (
          <Text className="text-center text-sm text-ink-muted">
            Минимальная поддерживаемая версия: {minimum}
          </Text>
        ) : null}
      </View>
      <Button label="Обновить" size="md" className="w-full" onPress={openStore} />
    </View>
  );
}
