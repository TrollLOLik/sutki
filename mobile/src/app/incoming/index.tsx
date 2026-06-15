import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BookingCard } from '@/components/BookingCard';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui';
import { useIncomingBookings } from '@/lib/api/bookings';
import { palette } from '@/theme/tokens';

export default function IncomingBookingsScreen() {
  const { data, isLoading, isError, refetch, isRefetching } = useIncomingBookings({ limit: 50 });
  const items = data?.items ?? [];

  return (
    <View className="flex-1 bg-surface">
      <SafeAreaView edges={['top']} className="flex-1">
        <View className="flex-row items-center gap-3 px-4 py-2">
          <Pressable
            onPress={() => router.back()}
            accessibilityLabel="Назад"
            className="h-10 w-10 items-center justify-center rounded-full bg-surface-muted">
            <Ionicons name="chevron-back" size={22} color={palette.ink} />
          </Pressable>
          <Text className="text-lg font-semibold text-ink">Входящие заявки</Text>
        </View>

        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={palette.primary} />
          </View>
        ) : isError ? (
          <View className="flex-1 gap-4 px-4">
            <EmptyState
              icon="cloud-offline-outline"
              title="Не удалось загрузить"
              subtitle="Проверьте подключение и попробуйте снова."
            />
            <View className="px-8">
              <Button label="Повторить" variant="secondary" onPress={() => refetch()} />
            </View>
          </View>
        ) : items.length === 0 ? (
          <EmptyState
            icon="file-tray-outline"
            title="Входящих заявок нет"
            subtitle="Здесь появятся заявки на ваши объявления."
          />
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item) => String(item.id)}
            contentContainerClassName="px-4 pb-6 pt-1"
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={isRefetching}
                onRefresh={() => refetch()}
                tintColor={palette.primary}
              />
            }
            renderItem={({ item }) => (
              <BookingCard
                booking={item}
                showRequester
                onPress={() =>
                  router.push({ pathname: '/incoming/[id]', params: { id: String(item.id) } })
                }
              />
            )}
          />
        )}
      </SafeAreaView>
    </View>
  );
}
