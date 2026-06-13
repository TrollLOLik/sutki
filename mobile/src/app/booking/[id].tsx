import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui';
import { palette } from '@/theme/tokens';

export default function BookingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <View className="flex-1 bg-surface">
      <SafeAreaView edges={['top']} className="flex-1">
        <View className="flex-row items-center gap-3 px-4 py-2">
          <Pressable
            onPress={() => router.back()}
            className="h-10 w-10 items-center justify-center rounded-full bg-surface-muted">
            <Ionicons name="chevron-back" size={22} color={palette.ink} />
          </Pressable>
          <Text className="text-lg font-semibold text-ink">Заявка на аренду</Text>
        </View>

        <View className="flex-1 gap-3 px-4 pt-2">
          <Text className="text-base text-ink-secondary">Объявление #{id}</Text>
          <View className="gap-2 rounded-card border border-line p-4">
            <Row label="Залог" value="2 000 ₽" />
            <Row label="2 000 ₽ × 1 ночь" value="2 000 ₽" />
            <View className="my-1 h-px bg-line" />
            <Row label="Итого" value="4 000 ₽" bold />
          </View>
          <Text className="text-base text-ink-muted">
            Форма заявки (даты, гости, расчёт, оплата) — фаза 3.
          </Text>
        </View>

        <View className="px-4 pb-6">
          <Button label="Отправить заявку" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    </View>
  );
}

function Row({ label, value, bold = false }: { label: string; value: string; bold?: boolean }) {
  return (
    <View className="flex-row items-center justify-between">
      <Text className={bold ? 'text-base font-semibold text-ink' : 'text-base text-ink-secondary'}>
        {label}
      </Text>
      <Text className={bold ? 'text-base font-bold text-ink' : 'text-base text-ink'}>{value}</Text>
    </View>
  );
}
