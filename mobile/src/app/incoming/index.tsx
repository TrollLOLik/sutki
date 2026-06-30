import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Easing,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/EmptyState';
import { IncomingRequestCard } from '@/components/IncomingRequestCard';
import { Button } from '@/components/ui';
import {
  bookingKeys,
  useConfirmBooking,
  useIncomingBookings,
  useRejectBooking,
} from '@/lib/api/bookings';
import { ApiError } from '@/lib/api/client';
import { cn } from '@/lib/cn';
import { useFindOrCreateConversation } from '@/lib/api/chat';
import { palette } from '@/theme/tokens';
import type { Booking } from '@/types/booking';

type Tab = 'pending' | 'processed';

export default function IncomingBookingsScreen() {
  const [tab, setTab] = useState<Tab>('pending');
  const pageWidth = Dimensions.get('window').width;
  const [containerWidth, setContainerWidth] = useState(pageWidth - 32);
  const tabAnim = useRef(new Animated.Value(0)).current;
  const horizontalScrollRef = useRef<ScrollView>(null);
  const { mutateAsync: findOrCreateConv } = useFindOrCreateConversation();

  const { data, isLoading, isError, refetch, isRefetching } = useIncomingBookings({ limit: 50 });
  const items = data?.items ?? [];

  const pendingItems = items.filter(item => item.status === 'in_progress');
  const processedItems = items.filter(item => item.status !== 'in_progress');

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
        <View className="flex-row items-center px-4 py-2">
          <Pressable
            onPress={() => router.back()}
            accessibilityLabel="Назад"
            className="h-10 w-10 items-center justify-center rounded-full bg-surface-muted"
          >
            <Ionicons name="chevron-back" size={22} color={palette.ink} />
          </Pressable>
          <Text className="flex-1 text-center text-lg font-semibold text-ink">Входящие заявки</Text>
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
            accessibilityState={{ selected: tab === 'pending' }}
            onPress={() => handleTabChange('pending')}
            className="h-10 flex-1 items-center justify-center rounded-pill relative z-10"
          >
            <Text className={`text-sm font-semibold transition-colors duration-200 ${tab === 'pending' ? 'text-ink' : 'text-ink-secondary'}`}>
              Ожидают
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === 'processed' }}
            onPress={() => handleTabChange('processed')}
            className="h-10 flex-1 items-center justify-center rounded-pill relative z-10"
          >
            <Text className={`text-sm font-semibold transition-colors duration-200 ${tab === 'processed' ? 'text-ink' : 'text-ink-secondary'}`}>
              Обработанные
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
                  icon="file-tray-outline"
                  title="Новых заявок нет"
                  subtitle="Здесь появятся заявки, ожидающие вашего решения."
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
                  icon="archive-outline"
                  title="История пуста"
                  subtitle="Здесь появятся обработанные заявки."
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

      {/* Rejection Reason Modal */}
      <Modal
        visible={rejectionTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setRejectionTarget(null);
          setReason('');
        }}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 20,
          }}
          onPress={() => {
            setRejectionTarget(null);
            setReason('');
          }}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ width: '100%', maxWidth: 340 }}
          >
            <Pressable
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 20,
                padding: 20,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.15,
                shadowRadius: 10,
                elevation: 5,
                gap: 16,
              }}
              onPress={(e) => e.stopPropagation()}
            >
              <View style={{ gap: 4 }}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: palette.ink }}>
                  Отклонить заявку
                </Text>
                <Text style={{ fontSize: 13, color: palette.inkSecondary }}>
                  Укажите причину отклонения (необязательно)
                </Text>
              </View>

              <TextInput
                placeholder="Причина отклонения..."
                value={reason}
                onChangeText={setReason}
                multiline
                numberOfLines={3}
                placeholderTextColor={palette.inkMuted}
                style={{
                  minHeight: 80,
                  borderWidth: 1,
                  borderColor: palette.line,
                  borderRadius: 10,
                  padding: 10,
                  fontSize: 14,
                  color: palette.ink,
                  textAlignVertical: 'top',
                }}
              />

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity
                  onPress={() => {
                    setRejectionTarget(null);
                    setReason('');
                  }}
                  style={{
                    flex: 1,
                    height: 44,
                    borderRadius: 999,
                    borderWidth: 1.5,
                    borderColor: palette.line,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontSize: 14, fontWeight: '700', color: palette.ink }}>
                    Назад
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleRejectSubmit}
                  disabled={rejectMutation.isPending}
                  style={{
                    flex: 1,
                    height: 44,
                    borderRadius: 999,
                    backgroundColor: palette.danger,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {rejectMutation.isPending ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#FFFFFF' }}>
                      Отклонить
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>
    </View>
  );
}
