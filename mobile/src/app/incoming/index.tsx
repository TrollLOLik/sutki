import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
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
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useActivityScopeSeen } from '@/hooks/useActivityScopeSeen';
import { NavigationBackButton } from '@/components/NavigationBackButton';

import { EmptyState } from '@/components/EmptyState';
import { IncomingRequestCard } from '@/components/IncomingRequestCard';
import { PersonalListToolbar, type SortOption } from '@/components/PersonalListToolbar';
import { BottomSheet, Button } from '@/components/ui';
import {
  bookingKeys,
  useConfirmBooking,
  useIncomingBookings,
  useRejectBooking,
} from '@/lib/api/bookings';
import { ApiError } from '@/lib/api/client';
import { useFindOrCreateConversation } from '@/lib/api/chat';
import { useAppTheme } from '@/theme/useAppTheme';
import type { Booking } from '@/types/booking';
import { appAlert as Alert } from '@/components/AppAlert';

type Tab = 'pending' | 'processed';
type IncomingSort = 'newest' | 'oldest' | 'checkin_asc' | 'checkin_desc';
const SORT_OPTIONS: SortOption<IncomingSort>[] = [
  { value: 'newest', label: 'Сначала новые заявки', icon: 'arrow-down-outline' },
  { value: 'oldest', label: 'Сначала старые заявки', icon: 'arrow-up-outline' },
  { value: 'checkin_asc', label: 'Ближайшее заселение', icon: 'calendar-outline' },
  { value: 'checkin_desc', label: 'Позднее заселение', icon: 'calendar-number-outline' },
];

function filterIncoming(items: Booking[], query: string, sort: IncomingSort): Booking[] {
  const needle = query.trim().toLocaleLowerCase('ru');
  return items.filter((item) => {
    const guest = item.guest;
    const searchable = `${guest?.name ?? item.name} ${guest?.surname ?? item.surname} ${item.phone} ${item.house?.address ?? ''} ${item.house?.city ?? ''}`.toLocaleLowerCase('ru');
    return !needle || searchable.includes(needle);
  }).sort((a, b) => {
    if (sort === 'oldest') return Date.parse(a.created_at) - Date.parse(b.created_at) || a.id - b.id;
    if (sort === 'checkin_asc') return Date.parse(a.start_date) - Date.parse(b.start_date) || b.id - a.id;
    if (sort === 'checkin_desc') return Date.parse(b.start_date) - Date.parse(a.start_date) || b.id - a.id;
    return Date.parse(b.created_at) - Date.parse(a.created_at) || b.id - a.id;
  });
}

export default function IncomingBookingsScreen() {
  useActivityScopeSeen('incoming');
  const { palette } = useAppTheme();
  const [tab, setTab] = useState<Tab>('pending');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<IncomingSort>('newest');
  const [sortVisible, setSortVisible] = useState(false);
  const pageWidth = Dimensions.get('window').width;
  const [containerWidth, setContainerWidth] = useState(pageWidth - 32);
  const tabAnim = useRef(new Animated.Value(0)).current;
  const horizontalScrollRef = useRef<ScrollView>(null);
  const { mutateAsync: findOrCreateConv } = useFindOrCreateConversation();

  const { data, isLoading, isError, refetch, isRefetching } = useIncomingBookings({ limit: 100 });
  const rawItems = data?.items ?? [];
  const rawPendingItems = rawItems.filter(item => item.status === 'in_progress');
  const rawProcessedItems = rawItems.filter(item => item.status !== 'in_progress');
  const pendingItems = useMemo(() => filterIncoming(rawPendingItems, query, sort), [rawPendingItems, query, sort]);
  const processedItems = useMemo(() => filterIncoming(rawProcessedItems, query, sort), [rawProcessedItems, query, sort]);

  const handleOpenChat = async (booking: Booking) => {
    try {
      const res = await findOrCreateConv({
        houseID: booking.house_id,
        userID: booking.user_id,
      });
      router.push({
        pathname: `/chat/${res.conversation_id}` as any,
        params: {
          title: `${booking.guest?.name ?? booking.name ?? ''} ${booking.guest?.surname ?? booking.surname ?? ''}`.trim() || 'Гость',
          otherUserId: booking.user_id,
          houseId: String(booking.house_id),
        },
      });
    } catch (err) {
      Alert.alert('Ошибка', err instanceof ApiError ? err.message : 'Не удалось открыть чат.');
    }
  };

  useEffect(() => {
    Animated.timing(tabAnim, {
      toValue: tab === 'pending' ? 0 : 1,
      duration: 200,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    }).start();
  }, [tab]);

  const handleTabChange = (nextTab: Tab) => {
    setTab(nextTab);
    horizontalScrollRef.current?.scrollTo({
      x: nextTab === 'pending' ? 0 : pageWidth,
      animated: true,
    });
  };

  const queryClient = useQueryClient();
  const confirmMutation = useConfirmBooking();
  const rejectMutation = useRejectBooking();

  const [rejectionTarget, setRejectionTarget] = useState<Booking | null>(null);
  const [reason, setReason] = useState('');

  const handleConfirm = (booking: Booking) => {
    Alert.alert(
      'Подтвердить бронирование?',
      'Вы одобряете проживание гостя на выбранные даты.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Подтвердить',
          style: 'default',
          onPress: async () => {
            try {
              await confirmMutation.mutateAsync(booking.id);
            } catch (err) {
              const msg = err instanceof ApiError && err.status === 409
                ? 'Заявка уже была отменена гостем или истекла.'
                : 'Не удалось подтвердить заявку.';
              Alert.alert('Ошибка', msg);
              queryClient.invalidateQueries({ queryKey: bookingKeys.all });
            }
          },
        },
      ]
    );
  };

  const handleRejectSubmit = async () => {
    if (!rejectionTarget) return;
    try {
      await rejectMutation.mutateAsync({
        id: rejectionTarget.id,
        reason: reason.trim() || undefined,
      });
      setRejectionTarget(null);
      setReason('');
    } catch (err) {
      const msg =
        err instanceof ApiError && err.status === 409
          ? 'Заявка уже была отменена гостем или истекла.'
          : 'Не удалось отклонить заявку.';
      Alert.alert('Ошибка', msg);
      setRejectionTarget(null);
      setReason('');
      queryClient.invalidateQueries({ queryKey: bookingKeys.all });
    }
  };

  const isMutationBusy = confirmMutation.isPending || rejectMutation.isPending;

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
          <Text className="flex-1 text-center text-xl font-extrabold text-ink">Входящие заявки</Text>
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
            accessibilityState={{ selected: tab === 'pending' }}
            onPress={() => handleTabChange('pending')}
            className="relative z-10 flex-1 items-center justify-center rounded-pill"
          >
            <Text className={`text-sm font-bold ${tab === 'pending' ? 'text-ink' : 'text-ink-secondary'}`}>
              Ожидают
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === 'processed' }}
            onPress={() => handleTabChange('processed')}
            className="relative z-10 flex-1 items-center justify-center rounded-pill"
          >
            <Text className={`text-sm font-bold ${tab === 'processed' ? 'text-ink' : 'text-ink-secondary'}`}>
              Обработанные
            </Text>
          </Pressable>
        </View>

        <PersonalListToolbar
          query={query}
          onQueryChange={setQuery}
          placeholder="Гость, телефон или адрес"
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
              const nextTab = page === 0 ? 'pending' : 'processed';
              if (tab !== nextTab) {
                setTab(nextTab);
              }
            }}
            className="flex-1"
          >
            {/* Pending Tab Page */}
            <View style={{ width: pageWidth }}>
              {pendingItems.length === 0 ? (
                <EmptyState
                  icon={rawPendingItems.length > 0 ? 'search-outline' : 'file-tray-outline'}
                  title={rawPendingItems.length > 0 ? 'Ничего не найдено' : 'Новых заявок нет'}
                  subtitle={rawPendingItems.length > 0 ? 'Попробуйте изменить поисковый запрос.' : 'Здесь появятся заявки, ожидающие вашего решения.'}
                />
              ) : (
                <FlatList
                  data={pendingItems}
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
                    <IncomingRequestCard
                      booking={item}
                      onPress={() =>
                        router.push({ pathname: '/incoming/[id]', params: { id: String(item.id) } })
                      }
                      onConfirm={() => handleConfirm(item)}
                      onReject={() => setRejectionTarget(item)}
                      isConfirming={confirmMutation.isPending && confirmMutation.variables === item.id}
                      isRejecting={rejectMutation.isPending && rejectMutation.variables?.id === item.id}
                      disabled={isMutationBusy}
                      onChatPress={() => handleOpenChat(item)}
                    />
                  )}
                  ListFooterComponent={
                    pendingItems.length > 0 ? (
                      <View className="py-6 items-center">
                        <Text className="text-xs text-ink-muted">Это все заявки</Text>
                      </View>
                    ) : null
                  }
                />
              )}
            </View>

            {/* Processed Tab Page */}
            <View style={{ width: pageWidth }}>
              {processedItems.length === 0 ? (
                <EmptyState
                  icon={rawProcessedItems.length > 0 ? 'search-outline' : 'archive-outline'}
                  title={rawProcessedItems.length > 0 ? 'Ничего не найдено' : 'История пуста'}
                  subtitle={rawProcessedItems.length > 0 ? 'Попробуйте изменить поисковый запрос.' : 'Здесь появятся обработанные заявки.'}
                />
              ) : (
                <FlatList
                  data={processedItems}
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
                    <IncomingRequestCard
                      booking={item}
                      onPress={() =>
                        router.push({ pathname: '/incoming/[id]', params: { id: String(item.id) } })
                      }
                      onConfirm={() => handleConfirm(item)}
                      onReject={() => setRejectionTarget(item)}
                      isConfirming={confirmMutation.isPending && confirmMutation.variables === item.id}
                      isRejecting={rejectMutation.isPending && rejectMutation.variables?.id === item.id}
                      disabled={isMutationBusy}
                      onChatPress={() => handleOpenChat(item)}
                    />
                  )}
                  ListFooterComponent={
                    processedItems.length > 0 ? (
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

      <BottomSheet
        visible={rejectionTarget !== null}
        onClose={() => {
          setRejectionTarget(null);
          setReason('');
        }}>
        <View style={{ gap: 18 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: palette.dangerLight,
              }}>
              <Ionicons name="close-circle-outline" size={23} color={palette.danger} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: palette.ink }}>Отклонить заявку</Text>
              <Text style={{ fontSize: 13, lineHeight: 18, color: palette.inkSecondary }}>
                Причина поможет гостю понять ваше решение
              </Text>
            </View>
          </View>

          <TextInput
            placeholder="Причина отклонения (необязательно)"
            value={reason}
            onChangeText={setReason}
            multiline
            autoFocus
            placeholderTextColor={palette.inkMuted}
            style={{
              minHeight: 112,
              borderWidth: 1,
              borderColor: palette.line,
              borderRadius: 18,
              paddingHorizontal: 16,
              paddingVertical: 14,
              backgroundColor: palette.surfaceMuted,
              fontSize: 15,
              lineHeight: 21,
              color: palette.ink,
              textAlignVertical: 'top',
            }}
          />

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Button
                label="Назад"
                variant="secondary"
                size="md"
                onPress={() => {
                  setRejectionTarget(null);
                  setReason('');
                }}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                label="Отклонить"
                variant="danger"
                size="md"
                loading={rejectMutation.isPending}
                onPress={handleRejectSubmit}
              />
            </View>
          </View>
        </View>
      </BottomSheet>
    </View>
  );
}
