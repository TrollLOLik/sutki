import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BookingCard } from '@/components/BookingCard';
import { EmptyState } from '@/components/EmptyState';
import { HistoryBookingCard } from '@/components/HistoryBookingCard';
import { Button } from '@/components/ui';
import { useMyBookings } from '@/lib/api/bookings';
import { ApiError } from '@/lib/api/client';
import { useFindOrCreateConversation } from '@/lib/api/chat';
import { useSessionStore } from '@/store/session';
import { useAppTheme } from '@/theme/useAppTheme';
import type { Booking } from '@/types/booking';

type Tab = 'active' | 'history';

export default function MyBookingsScreen() {
  const { palette } = useAppTheme();
  const [tab, setTab] = useState<Tab>('active');
  const pageWidth = Dimensions.get('window').width;
  const [containerWidth, setContainerWidth] = useState(pageWidth - 32);
  const tabAnim = useRef(new Animated.Value(0)).current;
  const horizontalScrollRef = useRef<ScrollView>(null);
  const { mutateAsync: findOrCreateConv } = useFindOrCreateConversation();

  const { status: authStatus } = useSessionStore();
  const isAuthenticated = authStatus === 'authenticated';

  const activeQuery = useMyBookings({ limit: 50, scope: 'active' }, { enabled: isAuthenticated });
  const historyQuery = useMyBookings({ limit: 50, scope: 'history' }, { enabled: isAuthenticated });

  const handleOpenChat = async (booking: Booking) => {
    if (!booking.house) return;
    try {
      const res = await findOrCreateConv({
        houseID: booking.house_id,
        userID: booking.house.owner_id,
      });
      router.push({
        pathname: `/chat/${res.conversation_id}` as any,
        params: {
          title: `${booking.house.owner_name ?? ''} ${booking.house.owner_surname ?? ''}`.trim() || 'Хозяин',
          otherUserId: booking.house.owner_id,
          houseId: String(booking.house_id),
        },
      });
    } catch (err) {
      Alert.alert('Ошибка', err instanceof ApiError ? err.message : 'Не удалось открыть чат.');
    }
  };

  const activeItems = activeQuery.data?.items ?? [];

  const historyItems = historyQuery.data?.items ?? [];

  const isLoading = activeQuery.isLoading || historyQuery.isLoading;
  const isError = activeQuery.isError || historyQuery.isError;
  const isRefetching = activeQuery.isRefetching || historyQuery.isRefetching;

  const refetch = () => {
    activeQuery.refetch();
    historyQuery.refetch();
  };

  useEffect(() => {
    Animated.timing(tabAnim, {
      toValue: tab === 'active' ? 0 : 1,
      duration: 200,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    }).start();
  }, [tab]);

  const handleTabChange = (nextTab: Tab) => {
    setTab(nextTab);
    horizontalScrollRef.current?.scrollTo({
      x: nextTab === 'active' ? 0 : pageWidth,
      animated: true,
    });
  };

  const repeat = (b: Booking) =>
    router.push({ pathname: '/booking/[id]', params: { id: String(b.house_id) } });
  const review = (b: Booking) =>
    router.push({ pathname: '/review/[id]', params: { id: String(b.house_id) } });
  const open = (b: Booking) =>
    router.push({ pathname: '/bookings/[id]', params: { id: String(b.id) } });

  if (!isAuthenticated) {
    return (
      <View className="flex-1 bg-surface">
        <SafeAreaView edges={['top']} className="flex-1">
          <View className="flex-row items-center px-4 py-2">
            <Pressable
              onPress={() => router.back()}
              accessibilityLabel="Назад"
              className="h-10 w-10 items-center justify-center rounded-full bg-surface-muted">
              <Ionicons name="chevron-back" size={22} color={palette.ink} />
            </Pressable>
            <Text className="flex-1 text-center text-lg font-semibold text-ink">Заявки</Text>
            <View className="h-10 w-10" />
          </View>

          {authStatus === 'loading' ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator color={palette.primary} />
            </View>
          ) : (
            <View className="flex-1 gap-4 px-4">
              <EmptyState
                icon="lock-closed-outline"
                title="Войдите, чтобы видеть заявки"
                subtitle="Заявки привязываются к email-аккаунту. Локально у гостя остается только избранное."
              />
              <View className="px-8">
                <Button
                  label="Войти по email"
                  onPress={() => router.push({ pathname: '/email', params: { fromBooking: 'true' } } as any)}
                />
              </View>
            </View>
          )}
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-surface">
      <SafeAreaView edges={['top']} className="flex-1">
        <View className="flex-row items-center px-4 py-2">
          <Pressable
            onPress={() => router.back()}
            accessibilityLabel="Назад"
            className="h-10 w-10 items-center justify-center rounded-full bg-surface-muted">
            <Ionicons name="chevron-back" size={22} color={palette.ink} />
          </Pressable>
          <Text className="flex-1 text-center text-lg font-semibold text-ink">Заявки</Text>
          {/* Spacer to balance the back button */}
          <View className="h-10 w-10" />
        </View>

        <View
          onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
          className="flex-row rounded-pill bg-surface-muted p-1 mx-4 mb-2 relative"
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
              borderRadius: 9999,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.08,
              shadowRadius: 4,
              elevation: 2,
            }}
          />
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === 'active' }}
            onPress={() => handleTabChange('active')}
            className="h-10 flex-1 items-center justify-center rounded-pill relative z-10"
          >
            <Text className={`text-sm font-semibold transition-colors duration-200 ${tab === 'active' ? 'text-ink' : 'text-ink-secondary'}`}>
              Мои заявки
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === 'history' }}
            onPress={() => handleTabChange('history')}
            className="h-10 flex-1 items-center justify-center rounded-pill relative z-10"
          >
            <Text className={`text-sm font-semibold transition-colors duration-200 ${tab === 'history' ? 'text-ink' : 'text-ink-secondary'}`}>
              История
            </Text>
          </Pressable>
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
        ) : (
          <ScrollView
            ref={horizontalScrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={16}
            onMomentumScrollEnd={(e) => {
              const offsetX = e.nativeEvent.contentOffset.x;
              const page = Math.round(offsetX / pageWidth);
              const nextTab = page === 0 ? 'active' : 'history';
              if (tab !== nextTab) {
                setTab(nextTab);
              }
            }}
            className="flex-1"
          >
            {/* Active Tab Page */}
            <View style={{ width: pageWidth }}>
              {activeItems.length === 0 ? (
                <EmptyState
                  icon="reader-outline"
                  title="Активных заявок нет"
                  subtitle="Выберите объявление и оставьте заявку на аренду."
                />
              ) : (
                <FlatList
                  data={activeItems}
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
                      onPress={() => open(item)}
                      onRepeat={() => repeat(item)}
                      onChatPress={() => handleOpenChat(item)}
                    />
                  )}
                  ListFooterComponent={
                    activeItems.length > 0 ? (
                      <View className="py-6 items-center">
                        <Text className="text-xs text-ink-muted">Это все заявки</Text>
                      </View>
                    ) : null
                  }
                />
              )}
            </View>

            {/* History Tab Page */}
            <View style={{ width: pageWidth }}>
              {historyItems.length === 0 ? (
                <EmptyState
                  icon="time-outline"
                  title="История пуста"
                  subtitle="Здесь появятся завершённые и отменённые заявки."
                />
              ) : (
                <FlatList
                  data={historyItems}
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
                    <HistoryBookingCard
                      booking={item}
                      onPress={() => open(item)}
                      onRepeat={() => repeat(item)}
                      onReview={() => review(item)}
                    />
                  )}
                  ListFooterComponent={
                    historyItems.length > 0 ? (
                      <View className="py-6 items-center">
                        <Text className="text-xs text-ink-muted">Это все заявки</Text>
                      </View>
                    ) : null
                  }
                />
              )}
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}
