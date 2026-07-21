import { Ionicons } from '@expo/vector-icons';
import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Image } from 'expo-image';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Button, MaterialSurface } from '@/components/ui';
import { bookingStatusMeta } from '@/lib/booking-status';
import { formatDateRangeRu, formatGuests, formatRub } from '@/lib/format';
import { useAppTheme } from '@/theme/useAppTheme';
import type { Booking } from '@/types/booking';

interface IncomingRequestCardProps {
  booking: Booking;
  onPress: () => void;
  onConfirm: () => void;
  onReject: () => void;
  isConfirming?: boolean;
  isRejecting?: boolean;
  disabled?: boolean;
  onChatPress?: () => void;
}

function statusVisual(status: string, hasReason: boolean, palette: ReturnType<typeof useAppTheme>['palette']) {
  if (status === 'confirmed' || status === 'active') {
    return {
      label: status === 'active' ? 'Проживание' : 'Подтверждена',
      color: palette.success,
      background: palette.successLight,
      icon: 'checkmark-circle-outline' as const,
    };
  }
  if (status === 'cancelled') {
    return {
      label: hasReason ? 'Отклонена' : 'Отменена',
      color: hasReason ? palette.danger : palette.inkSecondary,
      background: hasReason ? palette.dangerLight : palette.surfaceMuted,
      icon: hasReason ? 'close-circle-outline' as const : 'return-down-back-outline' as const,
    };
  }
  const statusMeta = bookingStatusMeta(status);
  return {
    label: statusMeta.label,
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

export function IncomingRequestCard({
  booking,
  onPress,
  onConfirm,
  onReject,
  isConfirming = false,
  isRejecting = false,
  disabled = false,
  onChatPress,
}: IncomingRequestCardProps) {
  const { palette } = useAppTheme();
  const start = parseISO(booking.start_date);
  const end = booking.end_date ? parseISO(booking.end_date) : null;
  const nights = end ? Math.max(1, differenceInCalendarDays(end, start)) : 1;
  const total = booking.house?.price ? booking.house.price * nights : null;
  const guestName = compactGuestName(booking);
  const initial = guestName.charAt(0).toUpperCase();
  const visual = statusVisual(booking.status, Boolean(booking.rejection_reason), palette);
  const pending = booking.status === 'in_progress' || booking.status === 'pending';

  return (
    <MaterialSurface level="raised" radius={24} style={styles.card}>
      <TouchableOpacity
        accessibilityRole="button"
        activeOpacity={0.72}
        onPress={onPress}
        style={styles.main}>
        <View style={styles.topRow}>
          <View style={[styles.statusBadge, { backgroundColor: visual.background }]}>
            <Ionicons name={visual.icon} size={14} color={visual.color} />
            <Text style={[styles.statusText, { color: visual.color }]}>{visual.label}</Text>
          </View>
          <Text numberOfLines={1} style={[styles.requestMeta, { color: palette.inkMuted }]}>№{booking.id}</Text>
        </View>

        <View style={styles.guestRow}>
          <View style={[styles.avatar, { backgroundColor: palette.primaryLight }]}>
            {booking.guest?.avatar_url ? (
              <Image source={{ uri: booking.guest.avatar_url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
            ) : (
              <Text style={[styles.avatarInitial, { color: palette.primary }]}>{initial}</Text>
            )}
          </View>

          <View style={styles.guestCopy}>
            <View style={styles.nameRow}>
              <Text numberOfLines={1} style={[styles.title, { color: palette.ink }]}>{guestName}</Text>
              {booking.guest?.rating && booking.guest.rating > 0 ? (
                <View style={styles.rating}>
                  <Ionicons name="star" size={13} color={palette.star} />
                  <Text style={[styles.ratingText, { color: palette.ink }]}>{booking.guest.rating.toFixed(1)}</Text>
                </View>
              ) : (
                <Text style={[styles.newGuest, { color: palette.inkMuted }]}>Новый гость</Text>
              )}
            </View>
            {booking.house?.address ? (
              <View style={styles.detailRow}>
                <Ionicons name="home-outline" size={14} color={palette.inkMuted} />
                <Text numberOfLines={1} style={[styles.detailText, { color: palette.inkSecondary }]}>
                  {booking.house.address}
                </Text>
              </View>
            ) : null}
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

        {total != null ? (
          <View style={styles.totalRow}>
            <View style={styles.totalCopy}>
              <Text style={[styles.totalLabel, { color: palette.inkSecondary }]}>Стоимость проживания</Text>
              <Text style={[styles.createdAt, { color: palette.inkMuted }]}>
                Создана {format(parseISO(booking.created_at), 'd MMM, HH:mm', { locale: ru })}
              </Text>
            </View>
            <Text
              adjustsFontSizeToFit
              minimumFontScale={0.72}
              numberOfLines={1}
              style={[styles.totalValue, { color: palette.ink }]}>
              {formatRub(total)} ₽
            </Text>
          </View>
        ) : null}
      </TouchableOpacity>

      <View style={[styles.actions, { borderTopColor: palette.line }]}>
        {pending ? (
          <View style={styles.decisionRow}>
            <View style={styles.actionCell}>
              <Button label="Отклонить" icon="close-outline" variant="danger" size="md" loading={isRejecting} disabled={disabled} onPress={onReject} />
            </View>
            <View style={styles.actionCell}>
              <Button label="Принять" icon="checkmark-outline" variant="success" size="md" loading={isConfirming} disabled={disabled} onPress={onConfirm} />
            </View>
          </View>
        ) : null}
        <Button
          label="Чат"
          icon="chatbubble-outline"
          variant="secondary"
          size="md"
          onPress={onChatPress ?? onPress}
        />
      </View>
    </MaterialSurface>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 12,
    overflow: 'hidden',
  },
  main: {
    paddingHorizontal: 20,
    paddingVertical: 17,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingRight: 8,
  },
  statusBadge: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusText: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '800',
  },
  requestMeta: {
    maxWidth: 72,
    flexShrink: 1,
    marginRight: 2,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '700',
    textAlign: 'right',
  },
  guestRow: {
    marginTop: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingRight: 5,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 22,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarInitial: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '900',
  },
  guestCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  title: {
    flex: 1,
    minWidth: 0,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '800',
  },
  rating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  ratingText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
  },
  newGuest: {
    flexShrink: 0,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '700',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  detailText: {
    flexShrink: 1,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '600',
  },
  totalRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    paddingLeft: 2,
    paddingRight: 10,
  },
  totalCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  totalLabel: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
  },
  createdAt: {
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '600',
  },
  totalValue: {
    width: 118,
    flexShrink: 0,
    fontSize: 17,
    lineHeight: 21,
    fontWeight: '900',
    textAlign: 'right',
  },
  actions: {
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  decisionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionCell: {
    flex: 1,
  },
});
