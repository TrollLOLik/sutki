import { Ionicons } from '@expo/vector-icons';
import { parseISO } from 'date-fns';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/EmptyState';
import { Badge, Button, Input } from '@/components/ui';
import { useBooking, useConfirmBooking, useRejectBooking } from '@/lib/api/bookings';
import { ApiError } from '@/lib/api/client';
import { bookingStatusMeta, isPending } from '@/lib/booking-status';
import { formatDateRu, formatGuests, formatPricePerNight } from '@/lib/format';
import { palette } from '@/theme/tokens';

export default function IncomingBookingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const bookingId = Number(id);
  const { data, isLoading, isError, refetch } = useBooking(bookingId);
  const confirm = useConfirmBooking();
  const reject = useRejectBooking();

  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const busy = confirm.isPending || reject.isPending;

  const onConfirm = () => {
    Alert.alert('Подтвердить заявку?', 'Гость получит подтверждение брони.', [
      { text: 'Назад', style: 'cancel' },
      {
        text: 'Подтвердить',
        onPress: async () => {
          try {
            await confirm.mutateAsync(bookingId);
          } catch (err) {
            Alert.alert('Ошибка', err instanceof ApiError ? err.message : 'Не удалось подтвердить заявку.');
          }
        },
      },
    ]);
  };

  const onReject = async () => {
    try {
      await reject.mutateAsync({ id: bookingId, reason });
      setRejecting(false);
      setReason('');
    } catch (err) {
      Alert.alert('Ошибка', err instanceof ApiError ? err.message : 'Не удалось отклонить заявку.');
    }
  };

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
          <Text className="text-lg font-semibold text-ink">Заявка</Text>
        </View>

        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={palette.primary} />
          </View>
        ) : isError || !data ? (
          <View className="flex-1 gap-4 px-4">
            <EmptyState
              icon="cloud-offline-outline"
              title="Не удалось загрузить заявку"
              subtitle="Проверьте подключение и попробуйте снова."
            />
            <View className="px-8">
              <Button label="Повторить" variant="secondary" onPress={() => refetch()} />
            </View>
          </View>
        ) : (
          <>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="gap-4 px-4 pb-6 pt-1">
              <View className="self-start">
                <Badge {...badgeProps(data.status)} />
              </View>

              {data.house ? (
                <View className="flex-row gap-3 rounded-card border border-line p-3">
                  <View className="h-20 w-20 overflow-hidden rounded-field bg-surface-skeleton">
                    {data.house.cover_url ? (
                      <Image
                        source={{ uri: data.house.cover_url }}
                        style={{ flex: 1 }}
                        contentFit="cover"
                        transition={150}
                      />
                    ) : (
                      <View className="flex-1 items-center justify-center">
                        <Ionicons name="image-outline" size={24} color={palette.inkMuted} />
                      </View>
                    )}
                  </View>
                  <View className="flex-1 justify-center gap-0.5">
                    <Text className="text-base font-semibold text-ink">{data.house.address}</Text>
                    <Text className="text-sm text-ink-secondary">{data.house.city}</Text>
                    <Text className="text-sm text-primary">{formatPricePerNight(data.house.price)}</Text>
                  </View>
                </View>
              ) : null}

              <View className="gap-2 rounded-card border border-line p-4">
                <Text className="text-sm font-semibold text-ink">Гость</Text>
                <DetailRow label="Имя" value={fullName(data.name, data.surname, data.lastname)} />
                <DetailRow label="Телефон" value={data.phone || '—'} />
                {data.message ? <DetailRow label="Комментарий" value={data.message} /> : null}
              </View>

              <View className="gap-2 rounded-card border border-line p-4">
                <DetailRow label="Заезд" value={formatDateRu(parseISO(data.start_date))} />
                <DetailRow
                  label="Выезд"
                  value={data.end_date ? formatDateRu(parseISO(data.end_date)) : '—'}
                />
                <DetailRow label="Гости" value={formatGuests(data.count)} />
              </View>

              {data.status === 'cancelled' && data.rejection_reason ? (
                <View className="gap-1 rounded-card border border-line bg-surface-muted p-4">
                  <Text className="text-sm font-semibold text-ink">Причина отклонения</Text>
                  <Text className="text-base text-ink-secondary">{data.rejection_reason}</Text>
                </View>
              ) : null}
            </ScrollView>

            {isPending(data.status) ? (
              <View className="gap-3 border-t border-line px-4 py-3">
                {rejecting ? (
                  <>
                    <Input
                      placeholder="Причина отказа (необязательно)"
                      value={reason}
                      onChangeText={setReason}
                      autoFocus
                    />
                    <Button
                      label="Отклонить заявку"
                      variant="secondary"
                      loading={reject.isPending}
                      onPress={onReject}
                    />
                    <Button
                      label="Отмена"
                      variant="ghost"
                      disabled={reject.isPending}
                      onPress={() => {
                        setRejecting(false);
                        setReason('');
                      }}
                    />
                  </>
                ) : (
                  <View className="flex-row gap-3">
                    <View className="flex-1">
                      <Button
                        label="Отклонить"
                        variant="secondary"
                        disabled={busy}
                        onPress={() => setRejecting(true)}
                      />
                    </View>
                    <View className="flex-1">
                      <Button
                        label="Подтвердить"
                        variant="success"
                        loading={confirm.isPending}
                        disabled={busy}
                        onPress={onConfirm}
                      />
                    </View>
                  </View>
                )}
              </View>
            ) : null}
          </>
        )}
      </SafeAreaView>
    </View>
  );
}

function badgeProps(status: string) {
  const meta = bookingStatusMeta(status);
  return { label: meta.label, tone: meta.tone };
}

function fullName(name: string, surname: string, lastname: string): string {
  const full = [surname, name, lastname]
    .map((p) => p.trim())
    .filter(Boolean)
    .join(' ');
  return full || '—';
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-start justify-between gap-4">
      <Text className="text-base text-ink-secondary">{label}</Text>
      <Text className="flex-1 text-right text-base text-ink">{value}</Text>
    </View>
  );
}
