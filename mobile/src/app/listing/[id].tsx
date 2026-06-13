import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Badge, Button } from '@/components/ui';
import { palette } from '@/theme/tokens';

export default function ListingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <View className="flex-1 bg-surface">
      <SafeAreaView edges={['top']} className="flex-1">
        <View className="flex-row items-center justify-between px-4 py-2">
          <Pressable
            onPress={() => router.back()}
            className="h-10 w-10 items-center justify-center rounded-full bg-surface-muted">
            <Ionicons name="chevron-back" size={22} color={palette.ink} />
          </Pressable>
          <Pressable className="h-10 w-10 items-center justify-center rounded-full bg-surface-muted">
            <Ionicons name="heart-outline" size={20} color={palette.ink} />
          </Pressable>
        </View>

        <View className="flex-1 gap-3 px-4 pt-2">
          <View className="h-56 items-center justify-center rounded-card bg-surface-muted">
            <Ionicons name="image-outline" size={40} color={palette.inkMuted} />
          </View>
          <View className="flex-row gap-2">
            <Badge label="Свободно сегодня" tone="success" />
            <Badge label="Проверено" tone="info" />
          </View>
          <Text className="text-xl font-bold text-ink">Уютная квартира в центре</Text>
          <Text className="text-base text-ink-secondary">Магнитогорск · объявление #{id}</Text>
          <Text className="text-2xl font-bold text-primary">2 000 ₽ / сутки</Text>
          <Text className="text-base text-ink-muted">
            Детальная страница (галерея, удобства, отзывы, карта) — фаза 2.
          </Text>
        </View>

        <View className="px-4 pb-6">
          <Button
            label="Оставить заявку"
            onPress={() => router.push({ pathname: '/booking/[id]', params: { id } })}
          />
        </View>
      </SafeAreaView>
    </View>
  );
}
