import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { Button, ScreenContainer } from '@/components/ui';
import { palette } from '@/theme/tokens';

export default function WelcomeScreen() {
  return (
    <ScreenContainer centered>
      <View className="flex-1 items-center justify-center gap-4">
        <View className="h-24 w-24 items-center justify-center rounded-3xl bg-primary-light">
          <Ionicons name="home" size={48} color={palette.primary} />
        </View>
        <Text className="text-3xl font-bold text-ink">Дом рядом</Text>
        <Text className="px-6 text-center text-base text-ink-secondary">
          Найдите квартиру или сдайте свою — аренда посуточно без лишних шагов.
        </Text>
      </View>

      <View className="gap-3 pb-6">
        <Button label="Войти по email" onPress={() => router.push('/email')} />
        <Button label="Продолжить через VK ID" variant="secondary" onPress={() => {}} />
      </View>
    </ScreenContainer>
  );
}
