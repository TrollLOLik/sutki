import { Ionicons } from '@expo/vector-icons';
import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { appAlert as Alert } from '@/components/AppAlert';
import { EmptyState } from '@/components/EmptyState';
import { NavigationBackButton } from '@/components/NavigationBackButton';
import { BottomSheet, Button, MaterialSurface } from '@/components/ui';
import { useBooking, useConfirmBooking, useRejectBooking } from '@/lib/api/bookings';
import { useFindOrCreateConversation } from '@/lib/api/chat';
import { ApiError } from '@/lib/api/client';
import { bookingStatusMeta, isPending } from '@/lib/booking-status';
import { formatGuests, formatNights, formatReviewsCount, formatRub } from '@/lib/format';
import { useAppTheme } from '@/theme/useAppTheme';

function fullName(parts: Array<string | undefined>): string {
  return parts.map((part) => part?.trim()).filter(Boolean).join(' ') || 'Гость';
}

function statusDescription(status: string, hasReason: boolean): string {
  if (status === 'confirmed') return 'Вы подтвердили проживание гостя';
  if (status === 'active') return 'Сейчас идёт период проживания';
  if (status === 'cancelled') return hasReason ? 'Вы отклонили эту заявку' : 'Гость отменил эту заявку';
  if (status === 'pending_verification') return 'Гость ещё подтверждает заявку';
  return 'Заявка ожидает вашего решения';
}

function statusVisual(status: string, hasReason: boolean, palette: ReturnType<typeof useAppTheme>['palette']) {
  if (status === 'confirmed' || status === 'active') {
    return { color: palette.success, background: palette.successLight, icon: 'checkmark-circle-outline' as const };
  }
  if (status === 'cancelled') {
    return {
      color: hasReason ? palette.danger : palette.inkSecondary,
      background: hasReason ? palette.dangerLight : palette.surfaceMuted,
      icon: hasReason ? 'close-circle-outline' as const : 'return-down-back-outline' as const,
    };
  }
  return { color: palette.primary, background: palette.primaryLight, icon: 'time-outline' as const };
}

export default function IncomingBookingDetailScreen() {
  const { palette } = useAppTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const bookingId = Number(id);
  const { data, isLoading, isError, refetch } = useBooking(bookingId);
  const confirm = useConfirmBooking();
  const reject = useRejectBooking();
  const { mutateAsync: findOrCreateConv, isPending: isCreatingChat } = useFindOrCreateConversation();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');

  const start = data ? parseISO(data.start_date) : null;
  const end = data?.end_date ? parseISO(data.end_date) : null;
  const nights = start && end ? Math.max(1, differenceInCalendarDays(end, start)) : 1;
  const total = data?.house ? data.house.price * nights : 0;
  const status = data ? bookingStatusMeta(data.status) : null;
  const visual = data ? statusVisual(data.status, Boolean(data.rejection_reason), palette) : null;
  const guestName = data
    ? data.guest
      ? fullName([data.guest.name, data.guest.patronymic, data.guest.surname])
      : fullName([data.name, data.lastname, data.surname])
    : 'Гость';
  const guestPhone = data ? data.guest?.phone || data.phone || '' : '';
  const busy = confirm.isPending || reject.isPending;

  const handleOpenChat = async () => {
    if (!data) return;
    try {
      const result = await findOrCreateConv({ houseID: data.house_id, userID: data.user_id });
      router.push({
        pathname: `/chat/${result.conversation_id}` as any,
        params: {
          title: guestName,
          otherUserId: data.user_id,
          houseId: String(data.house_id),
        },
      });
    } catch (error) {
      Alert.alert('Ошибка', error instanceof ApiError ? error.message : 'Не удалось открыть чат.');
    }
  };

  const handleGuestProfile = () => {
    if (!data?.user_id) return;
    router.push({
      pathname: '/profile/[id]',
      params: {
        id: String(data.user_id),
        name: data.guest?.name || data.name || '',
        surname: data.guest?.surname || data.surname || '',
        patronymic: data.guest?.patronymic || data.lastname || '',
        phone: guestPhone,
        avatarUrl: data.guest?.avatar_url || '',
        rating: data.guest?.rating != null ? String(data.guest.rating) : undefined,
        reviewsCount: data.guest?.reviews_count != null ? String(data.guest.reviews_count) : undefined,
        isVerified: data.guest?.is_verified ? 'true' : 'false',
      },
    } as any);
  };

  const handleCall = () => {
    if (!guestPhone) return;
    Linking.openURL(`tel:${guestPhone}`).catch(() => {
      Alert.alert('Ошибка', 'Не удалось открыть приложение для звонков.');
    });
  };

  const handleConfirm = () => {
    Alert.alert('Подтвердить заявку?', 'Гость получит подтверждение брони.', [
      { text: 'Назад', style: 'cancel' },
      {
        text: 'Подтвердить',
        onPress: async () => {
          try {
            await confirm.mutateAsync(bookingId);
          } catch (error) {
            Alert.alert('Ошибка', error instanceof ApiError ? error.message : 'Не удалось подтвердить заявку.');
          }
        },
      },
    ]);
  };

  const handleReject = async () => {
    try {
      await reject.mutateAsync({ id: bookingId, reason: reason.trim() || undefined });
      setRejecting(false);
      setReason('');
    } catch (error) {
      Alert.alert('Ошибка', error instanceof ApiError ? error.message : 'Не удалось отклонить заявку.');
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: palette.surface }]}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: palette.surface }}>
        <View style={[styles.header, { borderBottomColor: palette.line }]}>
          <NavigationBackButton fallback="/incoming" size={48} variant="material" />
          <View style={styles.headerCopy}>
            <Text style={[styles.headerTitle, { color: palette.ink }]}>Детали заявки</Text>
            {data ? <Text style={[styles.headerSubtitle, { color: palette.inkMuted }]}>№{data.id}</Text> : null}
          </View>
          <View style={styles.headerSpacer} />
        </View>
      </SafeAreaView>

      {isLoading ? (
        <View style={styles.centeredState}>
          <ActivityIndicator color={palette.primary} />
        </View>
      ) : isError || !data || !status || !visual || !start ? (
        <View style={styles.errorState}>
          <EmptyState
            icon="cloud-offline-outline"
            title="Не удалось загрузить заявку"
            subtitle="Проверьте подключение и попробуйте снова."
          />
          <Button label="Повторить" variant="secondary" onPress={() => refetch()} />
        </View>
      ) : (
        <>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
            <MaterialSurface level="raised" radius={24} style={styles.statusCard}>
              <View style={[styles.statusIcon, { backgroundColor: visual.background }]}>
                <Ionicons name={visual.icon} size={25} color={visual.color} />
              </View>
              <View style={styles.statusCopy}>
                <Text style={[styles.statusTitle, { color: palette.ink }]}>{status.label}</Text>
                <Text style={[styles.statusDescription, { color: palette.inkSecondary }]}>
                  {statusDescription(data.status, Boolean(data.rejection_reason))}
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
                  onPress={() => router.push({ pathname: '/listing/[id]', params: { id: String(data.house!.id) } })}
                  style={styles.listingPressable}>
                  <View style={[styles.listingImageWrap, { backgroundColor: palette.surfaceSkeleton }]}>
                    {data.house.cover_url ? (
                      <Image source={{ uri: data.house.cover_url }} style={styles.listingImage} contentFit="cover" transition={150} />
                    ) : (
                      <View style={styles.imageFallback}>
                        <Ionicons name="image-outline" size={29} color={palette.inkMuted} />
                      </View>
                    )}
                  </View>
                  <View style={styles.listingCopy}>
                    <Text numberOfLines={2} style={[styles.listingTitle, { color: palette.ink }]}>{data.house.address}</Text>
                    <Text numberOfLines={1} style={[styles.listingCity, { color: palette.inkSecondary }]}>{data.house.city}</Text>
                    <Text style={[styles.listingPrice, { color: palette.primary }]}>{formatRub(data.house.price)} ₽ / ночь</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={palette.inkMuted} />
                </TouchableOpacity>
              </MaterialSurface>
            ) : null}

            {data.status === 'cancelled' && data.rejection_reason ? (
              <MaterialSurface level="raised" radius={20} style={[styles.reasonCard, { backgroundColor: palette.dangerLight }]}>
                <View style={styles.reasonTitleRow}>
                  <Ionicons name="close-circle-outline" size={20} color={palette.danger} />
                  <Text style={[styles.reasonTitle, { color: palette.danger }]}>Причина отклонения</Text>
                </View>
                <Text style={[styles.reasonText, { color: palette.ink }]}>{data.rejection_reason}</Text>
              </MaterialSurface>
            ) : null}

            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: palette.ink }]}>Проживание</Text>
              <MaterialSurface level="raised" radius={24} style={styles.infoCard}>
                <DetailRow
                  icon="calendar-outline"
                  label="Заезд и выезд"
                  value={`${format(start, 'd MMMM', { locale: ru })}${end ? ` — ${format(end, 'd MMMM', { locale: ru })}` : ''}`}
                />
                <Separator />
                <DetailRow icon="moon-outline" label="Продолжительность" value={formatNights(nights)} />
                <Separator />
                <DetailRow icon="people-outline" label="Гости" value={formatGuests(data.count)} />
              </MaterialSurface>
            </View>

            {data.house ? (
              <MaterialSurface level="raised" radius={24} style={styles.totalCard}>
                <View style={styles.totalCopy}>
                  <Text style={[styles.totalLabel, { color: palette.inkSecondary }]}>Итого</Text>
                  <Text style={[styles.totalFormula, { color: palette.inkMuted }]}>
                    {formatRub(data.house.price)} ₽ × {formatNights(nights)}
                  </Text>
                </View>
                <Text adjustsFontSizeToFit minimumFontScale={0.72} numberOfLines={1} style={[styles.totalValue, { color: palette.ink }]}>
                  {formatRub(total)} ₽
                </Text>
              </MaterialSurface>
            ) : null}

            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: palette.ink }]}>Гость</Text>
              <MaterialSurface level="raised" radius={24} style={styles.guestCard}>
                <TouchableOpacity accessibilityRole="button" activeOpacity={0.72} onPress={handleGuestProfile} style={styles.guestProfile}>
                  <View style={[styles.guestAvatar, { backgroundColor: palette.primaryLight }]}>
                    {data.guest?.avatar_url ? (
                      <Image source={{ uri: data.guest.avatar_url }} style={styles.guestAvatarImage} contentFit="cover" transition={150} />
                    ) : (
                      <Text style={[styles.guestInitial, { color: palette.primary }]}>{guestName.charAt(0).toUpperCase()}</Text>
                    )}
                  </View>
                  <View style={styles.guestCopy}>
                    <View style={styles.guestNameRow}>
                      <Text numberOfLines={2} style={[styles.guestName, { color: palette.ink }]}>{guestName}</Text>
                      {data.guest?.is_verified ? (
                        <Ionicons name="checkmark-circle" size={17} color={palette.success} />
                      ) : null}
                    </View>
                    {data.guest && data.guest.reviews_count > 0 ? (
                      <View style={styles.ratingRow}>
                        <Ionicons name="star" size={14} color={palette.star} />
                        <Text style={[styles.ratingValue, { color: palette.ink }]}>{data.guest.rating.toFixed(1)}</Text>
                        <Text style={[styles.ratingCount, { color: palette.inkSecondary }]}>
                          {formatReviewsCount(data.guest.reviews_count)}
                        </Text>
                      </View>
                    ) : (
                      <Text style={[styles.ratingCount, { color: palette.inkMuted }]}>Пока нет отзывов</Text>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={palette.inkMuted} />
                </TouchableOpacity>

                {guestPhone ? (
                  <>
                    <Separator indent={64} />
                    <TouchableOpacity accessibilityRole="button" activeOpacity={0.72} onPress={handleCall} style={styles.phoneRow}>
                      <View style={[styles.phoneIcon, { backgroundColor: palette.primaryLight }]}>
                        <Ionicons name="call-outline" size={18} color={palette.primary} />
                      </View>
                      <View style={styles.phoneCopy}>
                        <Text style={[styles.phoneLabel, { color: palette.inkMuted }]}>Телефон</Text>
                        <Text style={[styles.phoneValue, { color: palette.ink }]}>{guestPhone}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={palette.inkMuted} />
                    </TouchableOpacity>
                  </>
                ) : null}

                {data.message ? (
                  <>
                    <Separator />
                    <View style={styles.commentBlock}>
                      <Text style={[styles.commentLabel, { color: palette.inkMuted }]}>Комментарий гостя</Text>
                      <Text style={[styles.commentText, { color: palette.ink }]}>{data.message}</Text>
                    </View>
                  </>
                ) : null}
              </MaterialSurface>
            </View>
          </ScrollView>

          <SafeAreaView edges={['bottom']} style={[styles.footer, { backgroundColor: palette.surface, borderTopColor: palette.line }]}>
            <Button
              label="Открыть чат"
              icon="chatbubble-outline"
              variant="secondary"
              size="md"
              loading={isCreatingChat}
              onPress={handleOpenChat}
            />
            {isPending(data.status) ? (
              <View style={styles.footerActions}>
                <View style={styles.footerAction}>
                  <Button label="Отклонить" icon="close-outline" variant="danger" size="md" disabled={busy} onPress={() => setRejecting(true)} />
                </View>
                <View style={styles.footerAction}>
                  <Button label="Подтвердить" icon="checkmark-outline" variant="success" size="md" loading={confirm.isPending} disabled={busy} onPress={handleConfirm} />
                </View>
              </View>
            ) : null}
          </SafeAreaView>

          <BottomSheet visible={rejecting} onClose={() => { setRejecting(false); setReason(''); }}>
            <View style={styles.sheetContent}>
              <View style={styles.sheetHeader}>
                <View style={[styles.sheetIcon, { backgroundColor: palette.dangerLight }]}>
                  <Ionicons name="close-circle-outline" size={23} color={palette.danger} />
                </View>
                <View style={styles.sheetCopy}>
                  <Text style={[styles.sheetTitle, { color: palette.ink }]}>Отклонить заявку</Text>
                  <Text style={[styles.sheetSubtitle, { color: palette.inkSecondary }]}>Причина поможет гостю понять ваше решение</Text>
                </View>
              </View>
              <TextInput
                placeholder="Причина отклонения (необязательно)"
                placeholderTextColor={palette.inkMuted}
                value={reason}
                onChangeText={setReason}
                multiline
                autoFocus
                style={[styles.reasonInput, { color: palette.ink, backgroundColor: palette.surfaceMuted, borderColor: palette.line }]}
              />
              <View style={styles.sheetActions}>
                <View style={styles.footerAction}>
                  <Button label="Назад" variant="secondary" size="md" onPress={() => { setRejecting(false); setReason(''); }} />
                </View>
                <View style={styles.footerAction}>
                  <Button label="Отклонить" variant="danger" size="md" loading={reject.isPending} onPress={handleReject} />
                </View>
              </View>
            </View>
          </BottomSheet>
        </>
      )}
    </View>
  );
}

function Separator({ indent = 68 }: { indent?: number }) {
  const { palette } = useAppTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, marginLeft: indent, backgroundColor: palette.line }} />;
}

function DetailRow({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  const { palette } = useAppTheme();
  return (
    <View style={styles.detailRow}>
      <View style={[styles.detailIcon, { backgroundColor: palette.primaryLight }]}>
        <Ionicons name={icon} size={19} color={palette.primary} />
      </View>
      <View style={styles.detailCopy}>
        <Text style={[styles.detailLabel, { color: palette.inkMuted }]}>{label}</Text>
        <Text style={[styles.detailValue, { color: palette.ink }]}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    height: 70,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerCopy: { flex: 1, alignItems: 'center', gap: 1 },
  headerTitle: { fontSize: 20, lineHeight: 25, fontWeight: '900' },
  headerSubtitle: { fontSize: 11, lineHeight: 14, fontWeight: '700' },
  headerSpacer: { width: 48, height: 48 },
  centeredState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorState: { flex: 1, justifyContent: 'center', gap: 18, paddingHorizontal: 32 },
  content: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 28, gap: 20 },
  statusCard: { minHeight: 112, flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18 },
  statusIcon: { width: 58, height: 58, borderRadius: 20, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  statusCopy: { flex: 1, minWidth: 0, gap: 3 },
  statusTitle: { fontSize: 20, lineHeight: 25, fontWeight: '900' },
  statusDescription: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  createdAt: { marginTop: 5, fontSize: 11, lineHeight: 15, fontWeight: '600' },
  listingCard: { overflow: 'hidden' },
  listingPressable: { minHeight: 126, flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
  listingImageWrap: { width: 94, height: 94, borderRadius: 20, overflow: 'hidden', flexShrink: 0 },
  listingImage: { width: '100%', height: '100%' },
  imageFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listingCopy: { flex: 1, minWidth: 0, gap: 4 },
  listingTitle: { fontSize: 17, lineHeight: 22, fontWeight: '900' },
  listingCity: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  listingPrice: { marginTop: 6, fontSize: 15, lineHeight: 20, fontWeight: '800' },
  reasonCard: { gap: 8, padding: 16 },
  reasonTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  reasonTitle: { fontSize: 14, lineHeight: 19, fontWeight: '800' },
  reasonText: { fontSize: 14, lineHeight: 20, fontWeight: '500' },
  section: { gap: 11 },
  sectionTitle: { paddingLeft: 4, fontSize: 20, lineHeight: 25, fontWeight: '900' },
  infoCard: { overflow: 'hidden' },
  detailRow: { minHeight: 82, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 18, paddingVertical: 14 },
  detailIcon: { width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  detailCopy: { flex: 1, minWidth: 0, gap: 2 },
  detailLabel: { fontSize: 12, lineHeight: 16, fontWeight: '700' },
  detailValue: { fontSize: 16, lineHeight: 21, fontWeight: '800' },
  totalCard: { minHeight: 98, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, paddingHorizontal: 20, paddingVertical: 18 },
  totalCopy: { flex: 1, minWidth: 0, gap: 3 },
  totalLabel: { fontSize: 13, lineHeight: 18, fontWeight: '700' },
  totalFormula: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
  totalValue: { width: 132, flexShrink: 0, textAlign: 'right', fontSize: 23, lineHeight: 28, fontWeight: '900' },
  guestCard: { overflow: 'hidden' },
  guestProfile: { minHeight: 92, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 18, paddingVertical: 15 },
  guestAvatar: { width: 58, height: 58, borderRadius: 20, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  guestAvatarImage: { width: '100%', height: '100%' },
  guestInitial: { fontSize: 23, lineHeight: 28, fontWeight: '900' },
  guestCopy: { flex: 1, minWidth: 0, gap: 5 },
  guestNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  guestName: { flexShrink: 1, fontSize: 17, lineHeight: 22, fontWeight: '900' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  ratingValue: { fontSize: 13, lineHeight: 17, fontWeight: '800' },
  ratingCount: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
  phoneRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingVertical: 13 },
  phoneIcon: { width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  phoneCopy: { flex: 1, minWidth: 0, gap: 2 },
  phoneLabel: { fontSize: 11, lineHeight: 15, fontWeight: '700' },
  phoneValue: { fontSize: 14, lineHeight: 19, fontWeight: '800' },
  commentBlock: { gap: 6, paddingHorizontal: 18, paddingVertical: 16 },
  commentLabel: { fontSize: 11, lineHeight: 15, fontWeight: '700' },
  commentText: { fontSize: 14, lineHeight: 21, fontWeight: '500' },
  footer: {
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: -8 },
    elevation: 8,
  },
  footerActions: { flexDirection: 'row', gap: 10 },
  footerAction: { flex: 1 },
  sheetContent: { gap: 18 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sheetIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  sheetCopy: { flex: 1, gap: 2 },
  sheetTitle: { fontSize: 18, lineHeight: 23, fontWeight: '900' },
  sheetSubtitle: { fontSize: 13, lineHeight: 18, fontWeight: '500' },
  reasonInput: { minHeight: 112, borderWidth: 1, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, lineHeight: 21, textAlignVertical: 'top' },
  sheetActions: { flexDirection: 'row', gap: 10 },
});
