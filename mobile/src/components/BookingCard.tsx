import { Ionicons } from '@expo/vector-icons';
import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { ResilientImage } from '@/components/ResilientImage';
import { Button, MaterialSurface } from '@/components/ui';
import { bookingStatusMeta } from '@/lib/booking-status';
import { formatDateRangeRu, formatGuests, formatRub } from '@/lib/format';
import { useAppTheme } from '@/theme/useAppTheme';
import type { Booking } from '@/types/booking';

interface BookingCardProps {
  booking: Booking;
  onPress: () => void;
  /** Show "Повторить" action button. */
  onRepeat?: () => void;
  /** Owner inbox: lead with the requester's name instead of the listing. */
  showRequester?: boolean;
  onVerifyEmail?: () => void;
  onChatPress?: () => void;
}

function statusVisual(status: string, palette: ReturnType<typeof useAppTheme>['palette']) {
  if (status === 'confirmed' || status === 'active') {
    return { color: palette.success, background: palette.successLight, icon: 'checkmark-circle-outline' as const };
  }
  if (status === 'pending_verification') {
    return { color: palette.danger, background: palette.dangerLight, icon: 'shield-checkmark-outline' as const };
  }
  if (status === 'cancelled') {
    return { color: palette.inkSecondary, background: palette.surfaceMuted, icon: 'close-circle-outline' as const };
  }
  return { color: palette.primary, background: palette.primaryLight, icon: 'time-outline' as const };
}

export function BookingCard({
  booking,
  onPress,
  onRepeat,
  showRequester = false,
  onVerifyEmail,
  onChatPress,
}: BookingCardProps) {
  const { palette } = useAppTheme();
  const status = bookingStatusMeta(booking.status);
  const visual = statusVisual(booking.status, palette);
  const start = parseISO(booking.start_date);
  const end = booking.end_date ? parseISO(booking.end_date) : null;
  const nights = end ? differenceInCalendarDays(end, start) : 0;
  const totalPrice = nights > 0 && booking.house?.price ? booking.house.price * nights : null;
  const title = showRequester ? booking.name || 'Гость' : booking.house?.address ?? 'Объявление';
  const subtitle = showRequester ? booking.house?.address : booking.house?.city;
  const createdAt = format(parseISO(booking.created_at), 'd MMM, HH:mm', { locale: ru });

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
            <Text style={[styles.statusText, { color: visual.color }]}>{status.label}</Text>
          </View>
          <Text numberOfLines={1} style={[styles.requestMeta, { color: palette.inkMuted }]}>№{booking.id}</Text>
        </View>

        <View style={styles.contentRow}>
          <View style={[styles.cover, { backgroundColor: palette.surfaceSkeleton }]}>
            <ResilientImage
              uri={booking.house?.cover_url}
              style={StyleSheet.absoluteFill}
              fallbackSize={28}
              transition={150}
            />
          </View>

          <View style={styles.copy}>
            <Text numberOfLines={2} style={[styles.title, { color: palette.ink }]}>{title}</Text>
            {subtitle ? (
              <Text numberOfLines={1} style={[styles.subtitle, { color: palette.inkSecondary }]}>{subtitle}</Text>
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

        {totalPrice != null ? (
          <View style={styles.totalRow}>
            <View style={styles.totalCopy}>
              <Text numberOfLines={1} style={[styles.totalLabel, { color: palette.inkSecondary }]}>Стоимость проживания</Text>
              <Text numberOfLines={1} style={[styles.createdText, { color: palette.inkMuted }]}>Создана {createdAt}</Text>
            </View>
            <Text
              adjustsFontSizeToFit
              minimumFontScale={0.72}
              numberOfLines={1}
              style={[styles.totalValue, { color: palette.ink }]}>
              {formatRub(totalPrice)} ₽
            </Text>
          </View>
        ) : null}
      </TouchableOpacity>

      <View style={[styles.actions, { borderTopColor: palette.line }]}>
        {booking.status === 'pending_verification' && onVerifyEmail ? (
          <Button
            icon="shield-checkmark-outline"
            label="Подтвердить почту"
            size="md"
            onPress={(event) => {
              event.stopPropagation();
              onVerifyEmail();
            }}
          />
        ) : (
          <View style={styles.actionRow}>
            <View style={styles.actionCell}>
              <Button
                icon="chatbubble-outline"
                label="Чат"
                size="md"
                variant="secondary"
                onPress={(event) => {
                  event.stopPropagation();
                  onChatPress ? onChatPress() : onPress();
                }}
              />
            </View>
            {onRepeat ? (
              <View style={styles.actionCell}>
                <Button
                  icon="refresh-outline"
                  label="Повторить"
                  size="md"
                  onPress={(event) => {
                    event.stopPropagation();
                    onRepeat();
                  }}
                />
              </View>
            ) : null}
          </View>
        )}
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
    fontWeight: '600',
    textAlign: 'right',
  },
  contentRow: {
    marginTop: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingRight: 5,
  },
  cover: {
    width: 92,
    height: 92,
    borderRadius: 17,
    overflow: 'hidden',
    flexShrink: 0,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  title: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '800',
  },
  subtitle: {
    marginBottom: 3,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
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
    marginTop: 13,
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
  createdText: {
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
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionCell: {
    flex: 1,
  },
});
