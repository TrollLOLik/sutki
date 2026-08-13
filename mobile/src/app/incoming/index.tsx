import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useActivityScopeSeen } from '@/hooks/useActivityScopeSeen';

import { BookingCard } from '@/components/BookingCard';
import { BookingListSkeleton } from '@/components/DomainListSkeletons';
import { PersonalListToolbar, type SortOption } from '@/components/PersonalListToolbar';
import { AppHeader, BottomSheet, Button, CountedTabs, DialogActions, EmptyState, LoadErrorState, TextArea } from '@/components/ui';
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
import { CollapsibleHeader, useCollapsibleHeader } from '@/components/CollapsibleHeader';

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
  const collapsibleHeader = useCollapsibleHeader();
  useActivityScopeSeen('incoming');
  const { palette } = useAppTheme();
  const [tab, setTab] = useState<Tab>('pending');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<IncomingSort>('newest');
  const [sortVisible, setSortVisible] = useState(false);
  const pageWidth = Dimensions.get('window').width;
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

  const handleTabChange = (nextTab: Tab) => {
    collapsibleHeader.show();
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
        <AppHeader fallback="/(tabs)/profile" title="Входящие заявки" />

        <View className="flex-1 overflow-hidden">
        <CollapsibleHeader controller={collapsibleHeader} style={{ backgroundColor: palette.surface }}>
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

        <CountedTabs
          items={[
            { value: 'pending', label: 'Ожидают', count: rawPendingItems.length },
            { value: 'processed', label: 'Обработанные', count: rawProcessedItems.length },
          ]}
          value={tab}
          onChange={handleTabChange}
        />

        </CollapsibleHeader>

        {isLoading ? (
          <BookingListSkeleton />
        ) : isError ? (
          <LoadErrorState title="Не удалось загрузить заявки" onRetry={() => refetch()} />
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
                collapsibleHeader.show();
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
                  onScroll={collapsibleHeader.onScroll}
                  onScrollBeginDrag={collapsibleHeader.onScrollBeginDrag}
                  onScrollEndDrag={collapsibleHeader.onScrollEndDrag}
                  contentContainerStyle={{ paddingTop: collapsibleHeader.height + 4 }}
                  scrollEventThrottle={16}
                  contentContainerClassName="px-4 pb-6 pt-1"
                  showsVerticalScrollIndicator={false}
                  refreshControl={
                    <RefreshControl
                      refreshing={isRefetching}
                      onRefresh={() => refetch()}
                      tintColor={palette.primary}
                      colors={[palette.primary]}
                      progressViewOffset={collapsibleHeader.height}
                    />
                  }
                  renderItem={({ item }) => (
                    <BookingCard
                      booking={item}
                      variant="incoming"
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
                  onScroll={collapsibleHeader.onScroll}
                  onScrollBeginDrag={collapsibleHeader.onScrollBeginDrag}
                  onScrollEndDrag={collapsibleHeader.onScrollEndDrag}
                  contentContainerStyle={{ paddingTop: collapsibleHeader.height + 4 }}
                  scrollEventThrottle={16}
                  contentContainerClassName="px-4 pb-6 pt-1"
                  showsVerticalScrollIndicator={false}
                  refreshControl={
                    <RefreshControl
                      refreshing={isRefetching}
                      onRefresh={() => refetch()}
                      tintColor={palette.primary}
                      colors={[palette.primary]}
                      progressViewOffset={collapsibleHeader.height}
                    />
                  }
                  renderItem={({ item }) => (
                    <BookingCard
                      booking={item}
                      variant="incoming"
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
        </View>
      </SafeAreaView>

      <BottomSheet
        visible={rejectionTarget !== null}
        onClose={() => {
          setRejectionTarget(null);
          setReason('');
        }}
        title="Отклонить заявку"
        subtitle="Причина поможет гостю понять ваше решение"
        icon="close-circle-outline"
        tone="danger"
        footer={
          <DialogActions
            secondary={
              <Button
                label="Назад"
                variant="secondary"
                size="md"
                onPress={() => {
                  setRejectionTarget(null);
                  setReason('');
                }}
              />
            }
            primary={
              <Button
                label="Отклонить"
                mode="outline"
                tone="danger"
                size="md"
                loading={rejectMutation.isPending}
                onPress={handleRejectSubmit}
              />
            }
          />
        }>
        <TextArea
          placeholder="Причина отклонения (необязательно)"
          value={reason}
          onChangeText={setReason}
          autoFocus
          minHeight={112}
        />
      </BottomSheet>
    </View>
  );
}
