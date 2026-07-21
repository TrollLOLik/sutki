import { Ionicons } from '@expo/vector-icons';
import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { appAlert as Alert } from '@/components/AppAlert';
import { EmptyState } from '@/components/EmptyState';
import { NavigationBackButton } from '@/components/NavigationBackButton';
import { Button, MaterialSurface } from '@/components/ui';
import { useBooking, useCancelBooking } from '@/lib/api/bookings';
import { useFindOrCreateConversation } from '@/lib/api/chat';
import { ApiError } from '@/lib/api/client';
import { useMyReviewEligibility } from '@/lib/api/reviews';
import { bookingStatusMeta, isPending } from '@/lib/booking-status';
import { formatGuests, formatNights, formatReviewsCount, formatRub } from '@/lib/format';
import { requireAuth } from '@/lib/requireAuth';
import { useAppTheme } from '@/theme/useAppTheme';

function formatDateShort(date: Date): string {
  return format(date, 'd MMMM', { locale: ru });
}

function fullName(name: string, patronymic: string, surname: string): string {
  return [name, patronymic, surname]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(' ') || 'Владелец';
}

function statusDescription(status: string): string {
  if (status === 'confirmed') return 'Владелец подтвердил бронирование';
  if (status === 'active') return 'Сейчас идёт период проживания';
  if (status === 'cancelled') return 'Бронирование завершено или отменено';
  if (status === 'pending_verification') return 'Завершите подтверждение заявки';
  return 'Ожидаем решение владельца';
}

function statusVisual(status: string, palette: ReturnType<typeof useAppTheme>['palette']) {
  if (status === 'confirmed' || status === 'active') {
    return { color: palette.success, background: palette.successLight, icon: 'checkmark-circle-outline' as const };
  }
  if (status === 'cancelled') {
    return { color: palette.inkSecondary, background: palette.surfaceMuted, icon: 'close-circle-outline' as const };
  }
  if (status === 'pending_verification') {
    return { color: palette.danger, background: palette.dangerLight, icon: 'shield-checkmark-outline' as const };
  }
  return { color: palette.primary, background: palette.primaryLight, icon: 'time-outline' as const };
}

export default function BookingDetailScreen() {
  const { palette, isDark } = useAppTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const bookingId = Number(id);
  const { data, isLoading, isError, refetch } = useBooking(bookingId);
  const cancel = useCancelBooking();
  const insets = useSafeAreaInsets();
  const eligibility = useMyReviewEligibility();
  const elig = eligibility.data?.items?.find((item) => item.request_id === bookingId);
  const canReview = elig?.can_review === true;
  const reviewLabel =
    elig?.review_status === 'rejected' || elig?.review_status === 'moderation_review'
      ? 'Изменить отзыв'
      : 'Оставить отзыв';
  const { mutateAsync: findOrCreateConv, isPending: isCreatingChat } = useFindOrCreateConversation();

  const handleOpenChat = async () => {
    if (!data?.house) return;
    if (!requireAuth('generic')) return;
    try {
      const result = await findOrCreateConv({
        houseID: data.house_id,
        userID: data.house.owner_id,
      });
      router.push({
        pathname: `/chat/${result.conversation_id}` as any,
        params: {
          title: `${data.house.owner_name ?? ''} ${data.house.owner_surname ?? ''}`.trim() || 'Владелец',
          otherUserId: data.house.owner_id,
          houseId: String(data.house_id),
        },
      });
    } catch (error) {
      Alert.alert('Ошибка', error instanceof ApiError ? error.message : 'Не удалось открыть чат.');
    }
  };

  const handleOwnerProfile = () => {
    if (!data?.house?.owner_id) return;
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
        reviewsCount:
          data.house.owner_reviews_count != null ? String(data.house.owner_reviews_count) : undefined,
        isVerified: data.house.owner_is_verified ? 'true' : 'false',
        city: data.house.city,
      },
    } as any);
  };

  const handleCall = () => {
    const phone = data?.house?.owner_phone;
    if (!phone) return;
    Linking.openURL(`tel:${phone}`).catch(() => {
      Alert.alert('Ошибка', 'Не удалось открыть приложение для звонков.');
    });
  };

  const handleCancel = () => {
    Alert.alert('Отменить заявку?', 'Это действие нельзя отменить.', [
      { text: 'Назад', style: 'cancel' },
      {
        text: 'Отменить заявку',
        style: 'destructive',
        onPress: async () => {
          try {
            await cancel.mutateAsync(bookingId);
          } catch (error) {
            Alert.alert(
              'Ошибка',
              error instanceof ApiError ? error.message : 'Не удалось отменить заявку.',
            );
          }
        },
      },
    ]);
  };

  const start = data ? parseISO(data.start_date) : null;
  const end = data?.end_date ? parseISO(data.end_date) : null;
  const nights = start && end ? Math.max(0, differenceInCalendarDays(end, start)) : 0;
  const total = data?.house ? data.house.price * Math.max(1, nights) : 0;
  const status = data ? bookingStatusMeta(data.status) : null;
  const visual = data ? statusVisual(data.status, palette) : null;

  return (
    <View style={[styles.screen, { backgroundColor: palette.surface }]}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: palette.surface }}>
        <View style={[styles.header, { borderBottomColor: palette.line }]}>
          <NavigationBackButton fallback="/bookings" size={48} variant="material" />
          <View style={styles.headerCopy}>
            <Text style={[styles.headerTitle, { color: palette.ink }]}>Детали брони</Text>
            {data ? <Text style={[styles.headerSubtitle, { color: palette.inkMuted }]}>№{data.id}</Text> : null}
          </View>
          <View style={styles.headerSpacer} />
        </View>
      </SafeAreaView>

      {isLoading ? (
        <View style={styles.centeredState}>
          <ActivityIndicator color={palette.primary} />
        </View>
      ) : isError || !data || !status || !visual ? (
        <View style={styles.errorState}>
          <EmptyState
            icon="cloud-offline-outline"
            title="Не удалось загрузить бронь"
            subtitle="Проверьте подключение и попробуйте снова."
          />
          <Button label="Повторить" variant="secondary" onPress={() => refetch()} />
        </View>
      ) : (
        <>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.content}>
            <MaterialSurface level="raised" radius={24} style={styles.statusCard}>
              <View style={[styles.statusIcon, { backgroundColor: visual.background }]}>
                <Ionicons name={visual.icon} size={25} color={visual.color} />
              </View>
              <View style={styles.statusCopy}>
                <Text style={[styles.statusTitle, { color: palette.ink }]}>{status.label}</Text>
                <Text style={[styles.statusDescription, { color: palette.inkSecondary }]}>
                  {statusDescription(data.status)}
                </Text>
                <Text style={[styles.createdAt, { color: palette.inkMuted }]}>
                  Создана {format(parseISO(data.created_at), 'd MMMM, HH:mm', { locale: ru })}
                </Text>
              </View>
            </MaterialSurface>

            {data.house ? (
              <MaterialSurface level="raised" radius={24} style={styles.listingCard}>
                <TouchableOpacity
                  accessibilityRole="button"
                  activeOpacity={0.72}
                  onPress={() =>
                    router.push({ pathname: '/listing/[id]', params: { id: String(data.house!.id) } })
                  }
                  style={styles.listingPressable}>
                  <View style={[styles.listingImageWrap, { backgroundColor: palette.surfaceSkeleton }]}>
                    {data.house.cover_url ? (
                      <Image
                        source={{ uri: data.house.cover_url }}
                        style={styles.listingImage}
                        contentFit="cover"
                        transition={150}
                      />
                    ) : (
                      <View style={styles.imageFallback}>
                        <Ionicons name="image-outline" size={29} color={palette.inkMuted} />
                      </View>
                    )}
                  </View>
                  <View style={styles.listingCopy}>
                    <Text numberOfLines={2} style={[styles.listingTitle, { color: palette.ink }]}>
                      {data.house.address}
                    </Text>
                    <Text numberOfLines={1} style={[styles.listingCity, { color: palette.inkSecondary }]}>
                      {data.house.city}
                    </Text>
                    <Text style={[styles.listingPrice, { color: palette.primary }]}>
                      {formatRub(data.house.price)} ₽ / ночь
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={19} color={palette.inkMuted} />
                </TouchableOpacity>
              </MaterialSurface>
            ) : null}

            {data.status === 'cancelled' && data.rejection_reason ? (
              <MaterialSurface
                level="raised"
                radius={20}
                style={[styles.reasonCard, { backgroundColor: palette.dangerLight }]}>
                <View style={styles.reasonTitleRow}>
                  <Ionicons name="close-circle-outline" size={20} color={palette.danger} />
                  <Text style={[styles.reasonTitle, { color: palette.danger }]}>Причина отклонения</Text>
                </View>
                <Text style={[styles.reasonBody, { color: palette.ink }]}>{data.rejection_reason}</Text>
              </MaterialSurface>
            ) : null}

            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: palette.ink }]}>Проживание</Text>
              <MaterialSurface level="raised" radius={24} style={styles.infoGroup}>
                <InfoRow
                  icon="calendar-outline"
                  label="Заезд и выезд"
                  value={
                    end && start
                      ? `${formatDateShort(start)} — ${formatDateShort(end)}`
                      : start
                        ? formatDateShort(start)
                        : '—'
                  }
                />
                <Divider />
                <InfoRow icon="moon-outline" label="Продолжительность" value={formatNights(Math.max(1, nights))} />
                <Divider />
                <InfoRow icon="people-outline" label="Гости" value={formatGuests(data.count)} />
              </MaterialSurface>
            </View>

            {data.house ? (
              <MaterialSurface level="raised" radius={24} style={styles.totalCard}>
                <View style={styles.totalCopy}>
                  <Text style={[styles.totalLabel, { color: palette.inkSecondary }]}>Итого</Text>
                  <Text style={[styles.totalBreakdown, { color: palette.inkMuted }]}>
                    {formatRub(data.house.price)} ₽ × {formatNights(Math.max(1, nights))}
                  </Text>
                </View>
                <Text style={[styles.totalValue, { color: palette.ink }]}>{formatRub(total)} ₽</Text>
              </MaterialSurface>
            ) : null}

            {data.message?.trim() ? (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: palette.ink }]}>Комментарий</Text>
                <MaterialSurface level="raised" radius={22} style={styles.commentCard}>
                  <Ionicons name="chatbubble-ellipses-outline" size={20} color={palette.primary} />
                  <Text style={[styles.commentText, { color: palette.inkSecondary }]}>{data.message.trim()}</Text>
                </MaterialSurface>
              </View>
            ) : null}

            {data.house ? (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: palette.ink }]}>Владелец</Text>
                <MaterialSurface level="raised" radius={24} style={styles.ownerCard}>
                  <TouchableOpacity
                    accessibilityRole="button"
                    activeOpacity={0.72}
                    onPress={handleOwnerProfile}
                    style={styles.ownerProfileRow}>
                    <View style={[styles.ownerAvatar, { backgroundColor: palette.surfaceMuted }]}>
                      {data.house.owner_avatar_url ? (
                        <Image
                          source={{ uri: data.house.owner_avatar_url }}
                          style={styles.ownerAvatarImage}
                          contentFit="cover"
                          transition={150}
                        />
                      ) : (
                        <View style={styles.imageFallback}>
                          <Ionicons name="person-outline" size={25} color={palette.inkMuted} />
                        </View>
                      )}
                    </View>

                    <View style={styles.ownerCopy}>
                      <View style={styles.ownerNameRow}>
                        <Text numberOfLines={2} style={[styles.ownerName, { color: palette.ink }]}>
                          {fullName(
                            data.house.owner_name || 'Владелец',
                            data.house.owner_patronymic || '',
                            data.house.owner_surname || '',
                          )}
                        </Text>
                        {data.house.owner_is_verified ? (
                          <Ionicons name="checkmark-circle" size={17} color={palette.success} />
                        ) : null}
                      </View>
                      {data.house.owner_rating != null && data.house.owner_rating > 0 ? (
                        <View style={styles.ratingRow}>
                          <Ionicons name="star" size={14} color={palette.star} />
                          <Text style={[styles.ratingValue, { color: palette.ink }]}>
                            {data.house.owner_rating.toFixed(1)}
                          </Text>
                          <Text style={[styles.ratingCount, { color: palette.inkMuted }]}>
                            · {formatReviewsCount(data.house.owner_reviews_count ?? 0)}
                          </Text>
                        </View>
                      ) : (
                        <Text style={[styles.ownerSubtitle, { color: palette.inkMuted }]}>Профиль владельца</Text>
                      )}
                    </View>
                    <Ionicons name="chevron-forward" size={19} color={palette.inkMuted} />
                  </TouchableOpacity>

                  {data.house.owner_phone ? (
                    <>
                      <Divider indent={0} />
                      <TouchableOpacity
                        accessibilityRole="button"
                        activeOpacity={0.72}
                        onPress={handleCall}
                        style={styles.phoneRow}>
                        <View style={[styles.phoneIcon, { backgroundColor: palette.primaryLight }]}>
                          <Ionicons name="call-outline" size={19} color={palette.primary} />
                        </View>
                        <View style={styles.phoneCopy}>
                          <Text style={[styles.phoneLabel, { color: palette.inkSecondary }]}>Позвонить</Text>
                          <Text style={[styles.phoneValue, { color: palette.ink }]}>{data.house.owner_phone}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={17} color={palette.inkMuted} />
                      </TouchableOpacity>
                    </>
                  ) : null}
                </MaterialSurface>
              </View>
            ) : null}
          </ScrollView>

          <View
            style={[
              styles.footer,
              {
                backgroundColor: palette.surface,
                borderTopColor: palette.line,
                paddingBottom: insets.bottom > 0 ? insets.bottom : 14,
                shadowOpacity: isDark ? 0.28 : 0.08,
              },
            ]}>
            {canReview ? (
              <Button
                icon="star-outline"
                label={reviewLabel}
                onPress={() => router.push({ pathname: '/review/[id]', params: { id: String(bookingId) } })}
              />
            ) : null}
            <Button
              icon="chatbubble-outline"
              label="Открыть чат"
              loading={isCreatingChat}
              onPress={handleOpenChat}
              variant={canReview ? 'secondary' : 'primary'}
            />
            {isPending(data.status) ? (
              <TouchableOpacity
                accessibilityRole="button"
                activeOpacity={0.68}
                disabled={cancel.isPending}
                onPress={handleCancel}
                style={[styles.cancelButton, { backgroundColor: palette.dangerLight }]}>
                <Text style={[styles.cancelText, { color: palette.danger }]}>
                  {cancel.isPending ? 'Отменяем…' : 'Отменить заявку'}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </>
      )}
    </View>
  );
}

function Divider({ indent = 64 }: { indent?: number }) {
  const { palette } = useAppTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, marginLeft: indent, backgroundColor: palette.line }} />;
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  const { palette } = useAppTheme();
  return (
    <View style={styles.infoRow}>
      <View style={[styles.infoIcon, { backgroundColor: palette.primaryLight }]}>
        <Ionicons name={icon} size={19} color={palette.primary} />
      </View>
      <View style={styles.infoCopy}>
        <Text style={[styles.infoLabel, { color: palette.inkSecondary }]}>{label}</Text>
        <Text style={[styles.infoValue, { color: palette.ink }]}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    height: 70,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerCopy: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  headerTitle: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '800',
  },
  headerSubtitle: {
    marginTop: 1,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '700',
  },
  headerSpacer: {
    width: 48,
    height: 48,
  },
  centeredState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorState: {
    flex: 1,
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  content: {
    gap: 16,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 28,
  },
  statusCard: {
    minHeight: 100,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    padding: 16,
  },
  statusIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  statusCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  statusTitle: {
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '800',
  },
  statusDescription: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
  },
  createdAt: {
    marginTop: 4,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '600',
  },
  listingCard: {
    overflow: 'hidden',
  },
  listingPressable: {
    minHeight: 124,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    padding: 14,
  },
  listingImageWrap: {
    width: 96,
    height: 96,
    borderRadius: 18,
    overflow: 'hidden',
    flexShrink: 0,
  },
  listingImage: {
    width: '100%',
    height: '100%',
  },
  imageFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listingCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  listingTitle: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '800',
  },
  listingCity: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  listingPrice: {
    marginTop: 5,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
  },
  reasonCard: {
    gap: 8,
    padding: 15,
  },
  reasonTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reasonTitle: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '800',
  },
  reasonBody: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    paddingHorizontal: 3,
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '800',
  },
  infoGroup: {
    overflow: 'hidden',
  },
  infoRow: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  infoIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  infoCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  infoLabel: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '800',
  },
  totalCard: {
    minHeight: 86,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
    padding: 16,
  },
  totalCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  totalLabel: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700',
  },
  totalBreakdown: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
  },
  totalValue: {
    fontSize: 21,
    lineHeight: 26,
    fontWeight: '900',
  },
  commentCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 11,
    padding: 15,
  },
  commentText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
  },
  ownerCard: {
    overflow: 'hidden',
  },
  ownerProfileRow: {
    minHeight: 88,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },
  ownerAvatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    overflow: 'hidden',
    flexShrink: 0,
  },
  ownerAvatarImage: {
    width: '100%',
    height: '100%',
  },
  ownerCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  ownerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  ownerName: {
    flexShrink: 1,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '800',
  },
  ownerSubtitle: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingValue: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
  },
  ratingCount: {
    flexShrink: 1,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
  },
  phoneRow: {
    minHeight: 70,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  phoneIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phoneCopy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  phoneLabel: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
  },
  phoneValue: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '800',
  },
  footer: {
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000000',
    shadowRadius: 18,
    shadowOffset: { width: 0, height: -8 },
    elevation: 8,
  },
  cancelButton: {
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
  },
  cancelText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
  },
});
