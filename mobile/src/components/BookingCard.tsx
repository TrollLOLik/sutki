import { Ionicons } from '@expo/vector-icons';
import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { ResilientImage } from '@/components/ResilientImage';
import { Button, InlineAlert, MaterialSurface } from '@/components/ui';
import { historyKind, historyMeta } from '@/lib/booking-history';
import { bookingStatusMeta } from '@/lib/booking-status';
import { formatDateRangeRu, formatGuests, formatRub } from '@/lib/format';
import { useAppTheme } from '@/theme/useAppTheme';
import type { Booking } from '@/types/booking';

export type BookingCardVariant = 'outgoing' | 'incoming' | 'history';

interface BookingCardProps {
  booking: Booking;
  variant?: BookingCardVariant;
  onPress: () => void;
  onChatPress?: () => void;
  onVerifyEmail?: () => void;
  onRepeat?: () => void;
  onReview?: () => void;
  reviewAvailable?: boolean;
  reviewLabel?: string;
  onConfirm?: () => void;
  onReject?: () => void;
  isConfirming?: boolean;
  isRejecting?: boolean;
  disabled?: boolean;
}

function statusVisual(
  booking: Booking,
  variant: BookingCardVariant,
  palette: ReturnType<typeof useAppTheme>['palette'],
) {
  if (variant === 'history') {
    const kind = historyKind(booking);
    const meta = historyMeta(kind);
    const completed = kind === 'completed';
    return {
      label: meta.label,
      color: completed ? palette.success : palette.inkSecondary,
      background: completed ? palette.successLight : palette.surfaceMuted,
      icon: completed
        ? ('checkmark-circle-outline' as const)
        : kind === 'rejected'
          ? ('close-circle-outline' as const)
          : ('return-down-back-outline' as const),
    };
  }

  if (booking.status === 'confirmed' || booking.status === 'active') {
    return {
      label: booking.status === 'active' ? 'Проживание' : 'Подтверждена',
      color: palette.success,
      background: palette.successLight,
      icon: 'checkmark-circle-outline' as const,
    };
  }
  if (booking.status === 'pending_verification') {
    return {
      label: bookingStatusMeta(booking.status).label,
      color: palette.danger,
      background: palette.dangerLight,
      icon: 'shield-checkmark-outline' as const,
    };
  }
  if (booking.status === 'cancelled') {
    const rejected = Boolean(booking.rejection_reason?.trim());
    return {
      label: rejected ? 'Отклонена' : 'Отменена',
      color: rejected ? palette.danger : palette.inkSecondary,
      background: rejected ? palette.dangerLight : palette.surfaceMuted,
      icon: rejected ? ('close-circle-outline' as const) : ('return-down-back-outline' as const),
    };
  }
  return {
    label: bookingStatusMeta(booking.status).label,
    color: palette.primary,
    background: palette.primaryLight,
    icon: 'time-outline' as const,
  };
}

function compactGuestName(booking: Booking) {
  const name = booking.guest?.name || booking.name || 'Гость';
  const surname = booking.guest?.surname || booking.surname || '';
  return surname.trim() ? `${name} ${surname.trim().charAt(0)}.` : name;
}

export function BookingCard({
  booking,
  variant = 'outgoing',
  onPress,
  onChatPress,
  onVerifyEmail,
  onRepeat,
  onReview,
  reviewAvailable = false,
  reviewLabel,
  onConfirm,
  onReject,
  isConfirming = false,
  isRejecting = false,
  disabled = false,
}: BookingCardProps) {
  const { palette } = useAppTheme();
  const incoming = variant === 'incoming';
  const history = variant === 'history';
  const start = parseISO(booking.start_date);
  const end = booking.end_date ? parseISO(booking.end_date) : null;
  const nights = end ? Math.max(1, differenceInCalendarDays(end, start)) : 1;
  const total = booking.house?.price ? booking.house.price * nights : null;
  const guestName = compactGuestName(booking);
  const visual = statusVisual(booking, variant, palette);
  const pending = booking.status === 'in_progress' || booking.status === 'pending';
  const createdAt = format(parseISO(booking.created_at), 'd MMM, HH:mm', { locale: ru });

  return (
    <MaterialSurface level="raised" radius={24} style={styles.card}>
      <TouchableOpacity accessibilityRole="button" activeOpacity={0.72} onPress={onPress} style={styles.main}>
        <View style={styles.topRow}>
          <View style={[styles.statusBadge, { backgroundColor: visual.background }]}>
            <Ionicons name={visual.icon} size={14} color={visual.color} />
            <Text style={[styles.statusText, { color: visual.color }]}>{visual.label}</Text>
          </View>
          <Text numberOfLines={1} style={[styles.requestMeta, { color: palette.inkMuted }]}>№{booking.id}</Text>
        </View>

        <View style={styles.contentRow}>
          <View
            style={[
              incoming ? styles.avatar : styles.cover,
              { backgroundColor: incoming ? palette.primaryLight : palette.surfaceSkeleton },
            ]}>
            <ResilientImage
              uri={incoming ? booking.guest?.avatar_url : booking.house?.cover_url}
              style={StyleSheet.absoluteFill}
              fallbackSize={incoming ? 24 : 28}
              transition={150}
            />
          </View>

          <View style={styles.copy}>
            <View style={styles.titleRow}>
              <Text numberOfLines={incoming ? 1 : 2} style={[styles.title, { color: palette.ink }]}>
                {incoming ? guestName : booking.house?.address ?? 'Объявление'}
              </Text>
              {incoming && booking.guest?.rating && booking.guest.rating > 0 ? (
                <View style={styles.rating}>
                  <Ionicons name="star" size={13} color={palette.star} />
                  <Text style={[styles.ratingText, { color: palette.ink }]}>{booking.guest.rating.toFixed(1)}</Text>
                </View>
              ) : incoming ? (
                <Text style={[styles.newGuest, { color: palette.inkMuted }]}>Новый гость</Text>
              ) : null}
            </View>
            <Text numberOfLines={1} style={[styles.subtitle, { color: palette.inkSecondary }]}>
              {incoming ? booking.house?.address : booking.house?.city}
            </Text>
            <View style={styles.detailRow}>
              <Ionicons name="calendar-outline" size={14} color={palette.inkMuted} />
              <Text numberOfLines={1} style={[styles.detailText, { color: palette.inkSecondary }]}>
                {formatDateRangeRu(start, end)}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Ionicons name="people-outline" size={14} color={palette.inkMuted} />
              <Text style={[styles.detailText, { color: palette.inkSecondary }]}>{formatGuests(booking.count)}</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={palette.inkMuted} />
        </View>

        {booking.rejection_reason?.trim() ? (
          <InlineAlert compact tone="danger" title="Причина отказа" style={styles.rejectionAlert}>
            {booking.rejection_reason.trim()}
          </InlineAlert>
        ) : null}

        {total != null ? (
          <View style={styles.totalRow}>
            <View style={styles.totalCopy}>
              <Text numberOfLines={1} style={[styles.totalLabel, { color: palette.inkSecondary }]}>
                {history ? 'Итого за проживание' : 'Стоимость проживания'}
              </Text>
              {!history ? (
                <Text numberOfLines={1} style={[styles.createdText, { color: palette.inkMuted }]}>Создана {createdAt}</Text>
              ) : null}
            </View>
            <Text adjustsFontSizeToFit minimumFontScale={0.72} numberOfLines={1} style={[styles.totalValue, { color: palette.ink }]}>
              {formatRub(total)} ₽
            </Text>
          </View>
        ) : null}
      </TouchableOpacity>

      <View style={[styles.actions, { borderTopColor: palette.line }]}>
        {incoming ? (
          <>
            {pending ? (
              <View style={styles.actionRow}>
                <View style={styles.actionCell}>
                  <Button label="Отклонить" icon="close-outline" variant="danger" size="md" loading={isRejecting} disabled={disabled} onPress={onReject} />
                </View>
                <View style={styles.actionCell}>
                  <Button label="Принять" icon="checkmark-outline" variant="success" size="md" loading={isConfirming} disabled={disabled} onPress={onConfirm} />
                </View>
              </View>
            ) : null}
            <Button label="Чат" icon="chatbubble-outline" variant="secondary" size="md" onPress={onChatPress ?? onPress} />
          </>
        ) : history ? (
          <View style={styles.actionRow}>
            <View style={styles.actionCell}>
              <Button icon="refresh-outline" label="Повторить" variant="secondary" size="md" onPress={onRepeat} />
            </View>
            {reviewAvailable ? (
              <View style={styles.actionCell}>
                <Button icon="star-outline" label={reviewLabel || 'Оставить отзыв'} size="md" onPress={onReview} />
              </View>
            ) : null}
          </View>
        ) : booking.status === 'pending_verification' && onVerifyEmail ? (
          <Button icon="shield-checkmark-outline" label="Подтвердить почту" size="md" onPress={onVerifyEmail} />
        ) : (
          <View style={styles.actionRow}>
            <View style={styles.actionCell}>
              <Button icon="chatbubble-outline" label="Чат" size="md" variant="secondary" onPress={onChatPress ?? onPress} />
            </View>
            {onRepeat ? (
              <View style={styles.actionCell}>
                <Button icon="refresh-outline" label="Повторить" size="md" onPress={onRepeat} />
              </View>
            ) : null}
          </View>
        )}
      </View>
    </MaterialSurface>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 12, overflow: 'hidden' },
  main: { paddingHorizontal: 20, paddingVertical: 17 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingRight: 8 },
  statusBadge: { minHeight: 28, flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5 },
  statusText: { fontSize: 11, lineHeight: 15, fontWeight: '800' },
  requestMeta: { maxWidth: 72, flexShrink: 1, marginRight: 2, fontSize: 10, lineHeight: 14, fontWeight: '700', textAlign: 'right' },
  contentRow: { marginTop: 13, flexDirection: 'row', alignItems: 'center', gap: 12, paddingRight: 5 },
  cover: { width: 92, height: 92, borderRadius: 17, overflow: 'hidden', flexShrink: 0 },
  avatar: { width: 72, height: 72, borderRadius: 22, overflow: 'hidden', flexShrink: 0 },
  copy: { flex: 1, minWidth: 0, gap: 3 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  title: { flex: 1, minWidth: 0, fontSize: 16, lineHeight: 21, fontWeight: '800' },
  subtitle: { marginBottom: 3, fontSize: 12, lineHeight: 16, fontWeight: '500' },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  ratingText: { fontSize: 12, lineHeight: 16, fontWeight: '800' },
  newGuest: { flexShrink: 0, fontSize: 10, lineHeight: 14, fontWeight: '700' },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  detailText: { flexShrink: 1, fontSize: 11, lineHeight: 16, fontWeight: '600' },
  rejectionAlert: { marginTop: 14 },
  totalRow: { marginTop: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, paddingLeft: 2, paddingRight: 10 },
  totalCopy: { flex: 1, minWidth: 0, gap: 2 },
  totalLabel: { fontSize: 11, lineHeight: 15, fontWeight: '600' },
  createdText: { fontSize: 9, lineHeight: 12, fontWeight: '600' },
  totalValue: { width: 118, flexShrink: 0, fontSize: 17, lineHeight: 21, fontWeight: '900', textAlign: 'right' },
  actions: { gap: 10, paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: StyleSheet.hairlineWidth },
  actionRow: { flexDirection: 'row', gap: 10 },
  actionCell: { flex: 1 },
});
