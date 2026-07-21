import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BookingCard } from '@/components/BookingCard';
import { NavigationBackButton } from '@/components/NavigationBackButton';
import { EmptyState } from '@/components/EmptyState';
import { HistoryBookingCard } from '@/components/HistoryBookingCard';
import { PersonalListToolbar, type SortOption } from '@/components/PersonalListToolbar';
import { Button } from '@/components/ui';
import { useMyBookings } from '@/lib/api/bookings';
import { ApiError } from '@/lib/api/client';
import { useFindOrCreateConversation } from '@/lib/api/chat';
import { useMyReviewEligibility } from '@/lib/api/reviews';
import { useSessionStore } from '@/store/session';
import { useAppTheme } from '@/theme/useAppTheme';
import type { Booking } from '@/types/booking';
import { useActivityScopeSeen } from '@/hooks/useActivityScopeSeen';
import { appAlert as Alert } from '@/components/AppAlert';

type Tab = 'active' | 'history';
type BookingSort = 'newest' | 'oldest' | 'checkin_asc' | 'checkin_desc';
const SORT_OPTIONS: SortOption<BookingSort>[] = [
  { value: 'newest', label: 'Сначала новые заявки', icon: 'arrow-down-outline' },
  { value: 'oldest', label: 'Сначала старые заявки', icon: 'arrow-up-outline' },
  { value: 'checkin_asc', label: 'Ближайшее заселение', icon: 'calendar-outline' },
  { value: 'checkin_desc', label: 'Позднее заселение', icon: 'calendar-number-outline' },
];

function filterAndSortBookings(items: Booking[], query: string, sort: BookingSort): Booking[] {
  const needle = query.trim().toLocaleLowerCase('ru');
  return items.filter((item) => {
    const house = item.house;
    const searchable = `${house?.address ?? ''} ${house?.city ?? ''} ${house?.owner_name ?? ''} ${house?.owner_surname ?? ''} ${item.status}`.toLocaleLowerCase('ru');
    return !needle || searchable.includes(needle);
  }).sort((a, b) => {
    if (sort === 'oldest') return Date.parse(a.created_at) - Date.parse(b.created_at) || a.id - b.id;
    if (sort === 'checkin_asc') return Date.parse(a.start_date) - Date.parse(b.start_date) || b.id - a.id;
    if (sort === 'checkin_desc') return Date.parse(b.start_date) - Date.parse(a.start_date) || b.id - a.id;
    return Date.parse(b.created_at) - Date.parse(a.created_at) || b.id - a.id;
  });
}

export default function MyBookingsScreen() {
  useActivityScopeSeen('bookings');
  const { palette } = useAppTheme();
  const [tab, setTab] = useState<Tab>('active');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<BookingSort>('newest');
  const [sortVisible, setSortVisible] = useState(false);
  const pageWidth = Dimensions.get('window').width;
  const [containerWidth, setContainerWidth] = useState(pageWidth - 32);
  const tabAnim = useRef(new Animated.Value(0)).current;
  const horizontalScrollRef = useRef<ScrollView>(null);
  const { mutateAsync: findOrCreateConv } = useFindOrCreateConversation();

  const { status: authStatus } = useSessionStore();
  const isAuthenticated = authStatus === 'authenticated';
  const eligibility = useMyReviewEligibility(isAuthenticated);
  const eligibilityByRequest = new Map((eligibility.data?.items ?? []).map((item) => [item.request_id, item]));

  const activeQuery = useMyBookings({ limit: 100, scope: 'active' }, { enabled: isAuthenticated });
  const historyQuery = useMyBookings({ limit: 100, scope: 'history' }, { enabled: isAuthenticated });

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

  const rawActiveItems = activeQuery.data?.items ?? [];
  const rawHistoryItems = historyQuery.data?.items ?? [];
  const activeItems = useMemo(() => filterAndSortBookings(rawActiveItems, query, sort), [rawActiveItems, query, sort]);
  const historyItems = useMemo(() => filterAndSortBookings(rawHistoryItems, query, sort), [rawHistoryItems, query, sort]);

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
          <View
            className="h-[70px] flex-row items-center px-4"
            style={{ borderBottomWidth: 1, borderBottomColor: palette.line }}>
            <NavigationBackButton
              fallback="/(tabs)/profile"
              size={48}
              variant="material"
            />
            <Text className="flex-1 text-center text-xl font-extrabold text-ink">Мои брони</Text>
            <View className="h-12 w-12" />
          </View>

          {authStatus === 'loading' ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator color={palette.primary} />
            </View>
          ) : (
            <View className="flex-1 gap-4 px-4">
              <EmptyState
                icon="lock-closed-outline"
                title="Войдите, чтобы видеть брони"
                subtitle="Все заявки на аренду и их статусы будут доступны в одном месте."
              />
              <View className="px-8">
                <Button
                  label="Войти или зарегистрироваться"
                  onPress={() => router.push({ pathname: '/welcome', params: { fromBooking: 'true' } } as any)}
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
        <View
          className="h-[70px] flex-row items-center px-4"
          style={{ borderBottomWidth: 1, borderBottomColor: palette.line }}>
          <NavigationBackButton
            fallback="/(tabs)/profile"
            size={48}
            variant="material"
          />
          <Text className="flex-1 text-center text-xl font-extrabold text-ink">Мои брони</Text>
          <View className="h-12 w-12" />
        </View>

        <View
          onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
          className="relative mx-4 mb-2 mt-4 h-12 flex-row rounded-pill bg-surface-muted p-1"
          style={{ borderWidth: 1, borderColor: palette.line }}
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
            className="relative z-10 flex-1 items-center justify-center rounded-pill"
          >
            <Text className={`text-sm font-bold ${tab === 'active' ? 'text-ink' : 'text-ink-secondary'}`}>
              Активные
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === 'history' }}
            onPress={() => handleTabChange('history')}
            className="relative z-10 flex-1 items-center justify-center rounded-pill"
          >
            <Text className={`text-sm font-bold ${tab === 'history' ? 'text-ink' : 'text-ink-secondary'}`}>
              История
            </Text>
          </Pressable>
        </View>

        <PersonalListToolbar
          query={query}
          onQueryChange={setQuery}
          placeholder="Адрес, город или владелец"
          sort={sort}
          sortOptions={SORT_OPTIONS}
          sortVisible={sortVisible}
          onSortVisibleChange={setSortVisible}
          onSortChange={setSort}
        />

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
                  icon={rawActiveItems.length > 0 ? 'search-outline' : 'reader-outline'}
                  title={rawActiveItems.length > 0 ? 'Ничего не найдено' : 'Активных броней нет'}
                  subtitle={rawActiveItems.length > 0 ? 'Попробуйте изменить поисковый запрос.' : 'Выберите объявление и оставьте заявку на аренду.'}
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
                      onChatPress={() => handleOpenChat(item)}
                    />
                  )}
                  ListFooterComponent={
                    activeItems.length > 0 ? (
                      <View className="py-6 items-center">
                        <Text className="text-xs font-semibold text-ink-muted">Это все активные брони</Text>
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
                  icon={rawHistoryItems.length > 0 ? 'search-outline' : 'time-outline'}
                  title={rawHistoryItems.length > 0 ? 'Ничего не найдено' : 'История пуста'}
                  subtitle={rawHistoryItems.length > 0 ? 'Попробуйте изменить поисковый запрос.' : 'Здесь появятся завершённые и отменённые заявки.'}
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
                  renderItem={({ item }) => {
                    const elig = eligibilityByRequest.get(item.id);
                    const label = elig?.review_status === 'rejected' || elig?.review_status === 'moderation_review'
                      ? 'Изменить отзыв'
                      : 'Оставить отзыв';
                    return (
                      <HistoryBookingCard
                        booking={item}
                        onPress={() => open(item)}
                        onRepeat={() => repeat(item)}
                        onReview={() => review(item)}
                        reviewAvailable={elig?.can_review === true}
                        reviewLabel={label}
                      />
                    );
                  }}
                  ListFooterComponent={
                    historyItems.length > 0 ? (
                      <View className="py-6 items-center">
                        <Text className="text-xs font-semibold text-ink-muted">Это вся история</Text>
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
