import { Ionicons } from '@expo/vector-icons';
import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui';
import { useBooking, useCancelBooking } from '@/lib/api/bookings';
import { useFindOrCreateConversation } from '@/lib/api/chat';
import { ApiError } from '@/lib/api/client';
import { useMyReviewEligibility } from '@/lib/api/reviews';
import { bookingStatusMeta, isPending } from '@/lib/booking-status';
import { formatGuests, formatRub } from '@/lib/format';
import { useAppTheme } from '@/theme/useAppTheme';
import { requireAuth } from '@/lib/requireAuth';

/** Format date without year, e.g. "20 мая" */
function formatDateShort(date: Date): string {
  return format(date, 'd MMMM', { locale: ru });
}

function formatNightsPlural(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} ночь`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return `${n} ночи`;
  return `${n} ночей`;
}

function fullName(name: string, patronymic: string, surname: string): string {
  const full = [name, patronymic, surname]
    .map((p) => p.trim())
    .filter(Boolean)
    .join(' ');
  return full || 'Гость';
}

function reviewWord(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'отзыв';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'отзыва';
  return 'отзывов';
}

const statusColors: Record<string, string> = {
  pending: '#FF9500',
  in_progress: '#FF9500',
  confirmed:   '#2EAD6B',
  active:      '#2EAD6B',
  cancelled:   '#9AA0A6',
};

export default function BookingDetailScreen() {
  const { palette } = useAppTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const bookingId = Number(id);
  const { data, isLoading, isError, refetch } = useBooking(bookingId);
  const cancel = useCancelBooking();
  const insets = useSafeAreaInsets();
  const eligibility = useMyReviewEligibility();
  const elig = eligibility.data?.items?.find((item) => item.request_id === bookingId);
  const canReview = elig?.can_review === true;
  const reviewLabel = elig?.review_status === 'rejected' || elig?.review_status === 'moderation_review'
    ? 'Изменить отзыв'
    : 'Оставить отзыв';
  const { mutateAsync: findOrCreateConv, isPending: isCreatingChat } = useFindOrCreateConversation();

  const handleOpenChat = async () => {
    if (!data?.house) return;
    if (!requireAuth('generic')) return;
    try {
      const res = await findOrCreateConv({
        houseID: data.house_id,
        userID: data.house.owner_id,
      });
      router.push({
        pathname: `/chat/${res.conversation_id}` as any,
        params: {
          title: `${data.house.owner_name ?? ''} ${data.house.owner_surname ?? ''}`.trim() || 'Хозяин',
          otherUserId: data.house.owner_id,
        },
      });
    } catch (err) {
      Alert.alert('Ошибка', err instanceof ApiError ? err.message : 'Не удалось открыть чат.');
    }
  };

  const onCancel = () => {
    Alert.alert('Отменить заявку?', 'Это действие нельзя отменить.', [
      { text: 'Назад', style: 'cancel' },
      {
        text: 'Отменить заявку',
        style: 'destructive',
        onPress: async () => {
          try {
            await cancel.mutateAsync(bookingId);
          } catch (err) {
            const message =
              err instanceof ApiError ? err.message : 'Не удалось отменить заявку.';
            Alert.alert('Ошибка', message);
          }
        },
      },
    ]);
  };


  return (
    <View className="flex-1 bg-surface">
      <SafeAreaView edges={['top']} className="flex-1">
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: palette.surface,
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderBottomWidth: 1,
            borderBottomColor: palette.line,
          }}
        >
          <Pressable
            onPress={() => router.back()}
            accessibilityLabel="Назад"
            style={{
              width: 40, height: 40,
              alignItems: 'center', justifyContent: 'center',
              borderRadius: 20,
              backgroundColor: palette.surfaceMuted,
            }}
          >
            <Ionicons name="chevron-back" size={22} color={palette.ink} />
          </Pressable>
          <Text
            style={{ flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '600', color: palette.ink }}
          >
            {data ? `Заявка №${data.id}` : 'Заявка'}
          </Text>
          <View style={{ width: 40 }} />
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
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingBottom: 24 }}>

              {/* Status + created date bar */}
              {(() => {
                const status = bookingStatusMeta(data.status);
                const badgeColor = statusColors[data.status] ?? '#9AA0A6';
                const createdAt = format(parseISO(data.created_at), 'd MMM, HH:mm', { locale: ru });
                return (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: palette.surface,
                      paddingHorizontal: 16,
                      paddingVertical: 12,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                        backgroundColor: badgeColor + '20',
                        borderRadius: 999,
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                      }}
                    >
                      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: badgeColor }} />
                      <Text style={{ fontSize: 13, fontWeight: '600', color: badgeColor }}>
                        {status.label}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 12, color: palette.inkMuted }}>
                      Создана {createdAt}
                    </Text>
                  </View>
                );
              })()}

              {/* Listing card */}
              {data.house ? (() => {
                const start = parseISO(data.start_date);
                const end = data.end_date ? parseISO(data.end_date) : null;
                const nights = end ? differenceInCalendarDays(end, start) : 0;

                return (
                  <TouchableOpacity
                    onPress={() => router.push({ pathname: '/listing/[id]', params: { id: String(data.house!.id) } })}
                    activeOpacity={0.7}
                    style={{
                      backgroundColor: palette.surface,
                      borderRadius: 16,
                      borderWidth: 1,
                      borderColor: palette.line,
                      marginHorizontal: 16,
                      paddingHorizontal: 16,
                      paddingVertical: 14,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      {/* Cover image */}
                      <View
                        style={{
                          width: 90, height: 90,
                          borderRadius: 12, overflow: 'hidden',
                          backgroundColor: palette.surfaceSkeleton,
                          flexShrink: 0,
                        }}
                      >
                        {data.house.cover_url ? (
                          <Image
                            source={{ uri: data.house.cover_url }}
                            style={{ width: 90, height: 90 }}
                            contentFit="cover"
                            transition={150}
                          />
                        ) : (
                          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                            <Ionicons name="image-outline" size={28} color={palette.inkMuted} />
                          </View>
                        )}
                      </View>

                      {/* Info */}
                      <View style={{ flex: 1, justifyContent: 'center', gap: 3, paddingRight: 8 }}>
                        <Text style={{ fontSize: 16, fontWeight: '700', color: palette.ink, lineHeight: 21 }}
                          numberOfLines={2}>
                          {data.house.address}
                        </Text>
                        <Text style={{ fontSize: 13, color: palette.inkSecondary }}>
                          {data.house.city}
                        </Text>
                        <Text style={{ fontSize: 15, fontWeight: '600', color: palette.inkSecondary, marginTop: 4 }}>
                          {formatRub(data.house.price)} ₽ × {formatNightsPlural(nights)}
                        </Text>
                      </View>

                      {/* Chevron to indicate clickable link */}
                      <Ionicons name="chevron-forward" size={20} color={palette.inkMuted} />
                    </View>
                  </TouchableOpacity>
                );
              })() : null}

              {/* Rejection reason */}
              {data.status === 'cancelled' && data.rejection_reason ? (
                <View
                  style={{
                    backgroundColor: palette.dangerLight,
                    marginHorizontal: 16,
                    borderRadius: 16,
                    padding: 16,
                    gap: 6,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Ionicons name="close-circle" size={18} color={palette.danger} />
                    <Text style={{ fontSize: 14, fontWeight: '700', color: palette.danger }}>
                      Причина отклонения
                    </Text>
                  </View>
                  <Text style={{ fontSize: 14, color: palette.ink, lineHeight: 20 }}>
                    {data.rejection_reason}
                  </Text>
                </View>
              ) : null}

              {/* Details block */}
              <View
                style={{
                  backgroundColor: palette.surface,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: palette.line,
                  marginHorizontal: 16,
                  paddingVertical: 4,
                }}
              >
                <InfoRow
                  icon="calendar-outline"
                  label="Заезд — выезд"
                  value={
                    data.end_date
                      ? `${formatDateShort(parseISO(data.start_date))} — ${formatDateShort(parseISO(data.end_date))}`
                      : formatDateShort(parseISO(data.start_date))
                  }
                />
                <Divider />
                <InfoRow icon="people-outline" label="Количество гостей" value={formatGuests(data.count)} />
                <Divider />
                {data.house ? (
                  <>
                    <InfoRow
                      icon="card-outline"
                      label="Стоимость проживания"
                      value={(() => {
                        const start = parseISO(data.start_date);
                        const end = data.end_date ? parseISO(data.end_date) : null;
                        const nights = end ? differenceInCalendarDays(end, start) : 0;
                        const total = nights > 0 ? data.house!.price * nights : data.house!.price;
                        return `${formatRub(total)} ₽`;
                      })()}
                    />
                  </>
                ) : null}
              </View>

              {/* Total */}
              {data.house ? (() => {
                const start = parseISO(data.start_date);
                const end = data.end_date ? parseISO(data.end_date) : null;
                const nights = end ? differenceInCalendarDays(end, start) : 0;
                const total = nights > 0 ? data.house.price * nights : data.house.price;
                return (
                  <View
                    style={{
                      backgroundColor: palette.surface,
                      borderRadius: 16,
                      borderWidth: 1,
                      borderColor: palette.line,
                      marginHorizontal: 16,
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      paddingHorizontal: 16,
                      paddingVertical: 16,
                    }}
                  >
                    <Text style={{ fontSize: 17, fontWeight: '700', color: palette.ink }}>Итого</Text>
                    <Text style={{ fontSize: 19, fontWeight: '900', color: palette.ink }}>
                      {formatRub(total)} ₽
                    </Text>
                  </View>
                );
              })() : null}

              {/* Контакты владельца */}
              <View
                style={{
                  backgroundColor: palette.surface,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: palette.line,
                  marginHorizontal: 16,
                  paddingHorizontal: 16,
                  paddingVertical: 16,
                  gap: 12,
                }}
              >
                <Text style={{ fontSize: 15, fontWeight: '700', color: palette.ink }}>
                  Контакты владельца
                </Text>

                {/* Avatar + name row (Clickable to view Owner Profile) */}
                <TouchableOpacity
                  onPress={() => {
                    if (data.house?.owner_id) {
                      router.push({
                        pathname: '/profile/[id]',
                        params: {
                          id: String(data.house.owner_id),
                          name: data.house.owner_name,
                          surname: data.house.owner_surname,
                          patronymic: data.house.owner_patronymic,
                          phone: data.house.owner_phone,
                          avatarUrl: data.house.owner_avatar_url,
                          rating: data.house.owner_rating != null ? String(data.house.owner_rating) : undefined,
                          reviewsCount: data.house.owner_reviews_count != null ? String(data.house.owner_reviews_count) : undefined,
                          isVerified: data.house.owner_is_verified ? 'true' : 'false',
                          city: data.house.city,
                        },
                      } as any);
                    }
                  }}
                  activeOpacity={0.7}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingBottom: 14,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 }}>
                    {/* Avatar */}
                    <View style={{
                      width: 56, height: 56, borderRadius: 28,
                      backgroundColor: palette.surfaceMuted,
                      overflow: 'hidden', flexShrink: 0,
                    }}>
                      {data.house?.owner_avatar_url ? (
                        <Image
                          source={{ uri: data.house.owner_avatar_url }}
                          style={{ width: 56, height: 56 }}
                          contentFit="cover"
                          transition={150}
                        />
                      ) : (
                        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                          <Ionicons name="person" size={26} color={palette.inkMuted} />
                        </View>
                      )}
                    </View>

                    {/* Name + verified + rating */}
                    <View style={{ flex: 1, gap: 4 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <Text style={{ fontSize: 16, fontWeight: '700', color: palette.ink }}>
                          {data.house
                            ? fullName(data.house.owner_name || 'Владелец', data.house.owner_patronymic || '', data.house.owner_surname || '')
                            : 'Владелец'}
                        </Text>
                        {data.house?.owner_is_verified && (
                          <View style={{
                            flexDirection: 'row', alignItems: 'center', gap: 3,
                            backgroundColor: '#E8F5E9', borderRadius: 999,
                            paddingHorizontal: 7, paddingVertical: 2,
                          }}>
                            <Ionicons name="checkmark-circle" size={13} color="#2EAD6B" />
                            <Text style={{ fontSize: 11, fontWeight: '600', color: '#2EAD6B' }}>
                              Верифицирован
                            </Text>
                          </View>
                        )}
                      </View>

                      {/* Rating */}
                      {data.house && data.house.owner_rating != null && data.house.owner_rating > 0 ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Ionicons name="star" size={13} color="#FFB400" />
                          <Text style={{ fontSize: 13, fontWeight: '700', color: palette.ink }}>
                            {data.house.owner_rating.toFixed(1)}
                          </Text>
                          {data.house.owner_reviews_count != null && data.house.owner_reviews_count > 0 && (
                            <Text style={{ fontSize: 12, color: palette.inkMuted }}>
                              · {data.house.owner_reviews_count} {reviewWord(data.house.owner_reviews_count)}
                            </Text>
                          )}
                        </View>
                      ) : (
                        <Text style={{ fontSize: 12, color: palette.inkMuted }}>Нет отзывов</Text>
                      )}
                    </View>
                  </View>

                  <Ionicons name="chevron-forward" size={20} color={palette.inkSecondary} />
                </TouchableOpacity>

                {/* Divider */}
                <View style={{ height: 1, backgroundColor: palette.line }} />

                {/* Phone */}
                <TouchableOpacity
                  onPress={() => {
                    const phone = data.house?.owner_phone;
                    if (phone) {
                      Linking.openURL(`tel:${phone}`).catch(() => {
                        Alert.alert('Ошибка', 'Не удалось открыть приложение для звонков.');
                      });
                    }
                  }}
                  disabled={!data.house?.owner_phone}
                  activeOpacity={0.7}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                    <View style={{
                      width: 36, height: 36, borderRadius: 10,
                      backgroundColor: palette.surfaceMuted,
                      alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      <Ionicons name="call-outline" size={18} color={palette.inkSecondary} />
                    </View>
                    <Text style={{ fontSize: 14, color: palette.inkSecondary }}>Телефон</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: palette.inkSecondary }}>
                      {data.house?.owner_phone || '—'}
                    </Text>
                    {data.house?.owner_phone ? (
                      <Ionicons name="chevron-forward" size={16} color={palette.inkSecondary} />
                    ) : null}
                  </View>
                </TouchableOpacity>
              </View>

            </ScrollView>

            {/* Bottom actions */}
            <View
              style={{
                backgroundColor: palette.surface,
                borderTopWidth: 1,
                borderTopColor: palette.line,
                paddingHorizontal: 16,
                paddingTop: 12,
                paddingBottom: insets.bottom > 0 ? insets.bottom : 16,
                gap: 10,
              }}
            >
              {/* Оставить отзыв */}
              {canReview ? (
                <TouchableOpacity
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    borderRadius: 999,
                    paddingVertical: 13,
                    backgroundColor: palette.primary,
                  }}
                  onPress={() => router.push({ pathname: '/review/[id]', params: { id: String(bookingId) } })}
                >
                  <Ionicons name="star-outline" size={18} color="#fff" />
                  <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>{reviewLabel}</Text>
                </TouchableOpacity>
              ) : null}

              {/* Открыть чат */}
              <TouchableOpacity
                disabled={isCreatingChat}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  borderWidth: 1.5,
                  borderColor: palette.line,
                  borderRadius: 999,
                  paddingVertical: 13,
                  opacity: isCreatingChat ? 0.6 : 1,
                }}
                onPress={handleOpenChat}
              >
                {isCreatingChat ? (
                  <ActivityIndicator size="small" color={palette.ink} />
                ) : (
                  <>
                    <Ionicons name="chatbubble-outline" size={18} color={palette.ink} />
                    <Text style={{ fontSize: 15, fontWeight: '600', color: palette.ink }}>Открыть чат</Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Отменить заявку — only for pending */}
              {isPending(data.status) ? (
                <TouchableOpacity
                  disabled={cancel.isPending}
                  onPress={onCancel}
                  style={{
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 999,
                    paddingVertical: 13,
                    backgroundColor: palette.dangerLight,
                  }}
                >
                  <Text style={{ fontSize: 15, fontWeight: '600', color: palette.danger }}>
                    {cancel.isPending ? 'Отмена...' : 'Отменить заявку'}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </>
        )}
      </SafeAreaView>
    </View>
  );
}

function Divider() {
  const { palette } = useAppTheme();
  return (
    <View style={{ height: 1, backgroundColor: palette.line, marginLeft: 52 }} />
  );
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  const { palette } = useAppTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 13,
        gap: 12,
      }}
    >
      <View
        style={{
          width: 36, height: 36,
          borderRadius: 10,
          backgroundColor: palette.surfaceMuted,
          alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Ionicons name={icon as any} size={18} color={palette.inkSecondary} />
      </View>
      <Text style={{ flex: 1, fontSize: 14, color: palette.inkSecondary }}>{label}</Text>
      <Text style={{ fontSize: 14, fontWeight: '600', color: palette.ink, textAlign: 'right', maxWidth: '50%' }}>
        {value}
      </Text>
    </View>
  );
}
