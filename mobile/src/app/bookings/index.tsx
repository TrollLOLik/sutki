import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BookingCard } from '@/components/BookingCard';
import { EmptyState } from '@/components/EmptyState';
import { HistoryBookingCard } from '@/components/HistoryBookingCard';
import { Button } from '@/components/ui';
import { useMyBookings } from '@/lib/api/bookings';
import { cn } from '@/lib/cn';
import { palette } from '@/theme/tokens';
import type { Booking } from '@/types/booking';

type Tab = 'active' | 'history';

export default function MyBookingsScreen() {
  const [tab, setTab] = useState<Tab>('active');
  const query = useMyBookings({ limit: 50, scope: tab });
  const { data, isLoading, isError, refetch, isRefetching } = query;
  const items = data?.items ?? [];

  const repeat = (b: Booking) =>
    router.push({ pathname: '/booking/[id]', params: { id: String(b.house_id) } });
  const review = (b: Booking) =>
    router.push({ pathname: '/review/[id]', params: { id: String(b.house_id) } });
  const open = (b: Booking) =>
    router.push({ pathname: '/bookings/[id]', params: { id: String(b.id) } });

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
          <Text className="text-lg font-semibold text-ink">Заявки</Text>
        </View>

        <View className="flex-row gap-1 rounded-pill bg-surface-muted p-1 mx-4 mb-2">
          <Segment label="Мои заявки" active={tab === 'active'} onPress={() => setTab('active')} />
          <Segment label="История" active={tab === 'history'} onPress={() => setTab('history')} />
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
          tab === 'active' ? (
            <EmptyState
              icon="reader-outline"
              title="Активных заявок нет"
              subtitle="Выберите объявление и оставьте заявку на аренду."
            />
          ) : (
            <EmptyState
              icon="time-outline"
              title="История пуста"
              subtitle="Здесь появятся завершённые и отменённые заявки."
            />
          )
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
            renderItem={({ item }) =>
              tab === 'history' ? (
                <HistoryBookingCard
                  booking={item}
                  onPress={() => open(item)}
                  onRepeat={() => repeat(item)}
                  onReview={() => review(item)}
                />
              ) : (
                <BookingCard booking={item} onPress={() => open(item)} />
              )
            }
          />
        )}
      </SafeAreaView>
    </View>
  );
}

function Segment({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      className={cn(
        'flex-1 items-center justify-center rounded-pill py-2',
        active ? 'bg-surface' : 'bg-transparent',
      )}>
      <Text className={cn('text-sm font-semibold', active ? 'text-ink' : 'text-ink-secondary')}>
        {label}
      </Text>
    </Pressable>
  );
}
