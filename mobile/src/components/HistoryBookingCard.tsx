import { Ionicons } from '@expo/vector-icons';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { ResilientImage } from '@/components/ResilientImage';
import { Button, MaterialSurface } from '@/components/ui';
import { historyKind, historyMeta } from '@/lib/booking-history';
import { formatDateRangeRu, formatGuests, formatRub } from '@/lib/format';
import { useAppTheme } from '@/theme/useAppTheme';
import type { Booking } from '@/types/booking';

interface HistoryBookingCardProps {
  booking: Booking;
  onPress: () => void;
  onRepeat: () => void;
  onReview: () => void;
  reviewAvailable?: boolean;
  reviewLabel?: string;
}

export function HistoryBookingCard({
  booking,
  onPress,
  onRepeat,
  onReview,
  reviewAvailable,
  reviewLabel,
}: HistoryBookingCardProps) {
  const { palette } = useAppTheme();
  const kind = historyKind(booking);
  const meta = historyMeta(kind);
  const start = parseISO(booking.start_date);
  const end = booking.end_date ? parseISO(booking.end_date) : null;
  const nights = end ? differenceInCalendarDays(end, start) : 0;
  const total = nights > 0 && booking.house?.price ? nights * booking.house.price : null;
  const statusColor = kind === 'completed' ? palette.success : palette.inkSecondary;
  const statusBackground = kind === 'completed' ? palette.successLight : palette.surfaceMuted;
  const statusIcon = kind === 'completed' ? 'checkmark-circle-outline' : kind === 'rejected' ? 'close-circle-outline' : 'return-down-back-outline';

  return (
    <MaterialSurface level="raised" radius={24} style={styles.card}>
      <TouchableOpacity
        accessibilityRole="button"
        activeOpacity={0.72}
        onPress={onPress}
        style={styles.main}>
        <View style={styles.topRow}>
          <View style={[styles.statusBadge, { backgroundColor: statusBackground }]}>
            <Ionicons name={statusIcon} size={14} color={statusColor} />
            <Text style={[styles.statusText, { color: statusColor }]}>{meta.label}</Text>
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
            <Text numberOfLines={2} style={[styles.title, { color: palette.ink }]}>
              {booking.house?.address ?? 'Объявление'}
            </Text>
            {booking.house?.city ? (
              <Text numberOfLines={1} style={[styles.subtitle, { color: palette.inkSecondary }]}>
                {booking.house.city}
              </Text>
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
            <Text numberOfLines={1} style={[styles.totalLabel, { color: palette.inkSecondary }]}>Итого за проживание</Text>
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
        <View style={styles.actionCell}>
          <Button icon="refresh-outline" label="Повторить" variant="secondary" size="md" onPress={onRepeat} />
        </View>
        {reviewAvailable ? (
          <View style={styles.actionCell}>
            <Button icon="star-outline" label={reviewLabel || 'Оставить отзыв'} size="md" onPress={onReview} />
          </View>
        ) : null}
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
  totalLabel: {
    flex: 1,
    minWidth: 0,
    fontSize: 11,
    lineHeight: 15,
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
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  actionCell: {
    flex: 1,
  },
});
