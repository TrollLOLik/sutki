import { Ionicons } from '@expo/vector-icons';
import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Pressable, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';

import { ResilientImage } from '@/components/ResilientImage';
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

const statusColors: Record<string, string> = {
  pending: '#FF9500',
  in_progress: '#FF9500',
  confirmed:   '#2EAD6B',
  active:      '#2EAD6B',
  cancelled:   '#9AA0A6',
  pending_verification: '#FF2D55',
};

export function BookingCard({
  booking,
  onPress,
  onRepeat,
  showRequester = false,
  onVerifyEmail,
  onChatPress,
}: BookingCardProps) {
  const { palette } = useAppTheme();
  const { width: screenWidth } = useWindowDimensions();

  // Image: fixed square size
  const imgSize = 90;

  const status = bookingStatusMeta(booking.status);
  const badgeColor = statusColors[booking.status] ?? '#9AA0A6';
  const cover = booking.house?.cover_url;

  const start = parseISO(booking.start_date);
  const end = booking.end_date ? parseISO(booking.end_date) : null;

  const nights = end ? differenceInCalendarDays(end, start) : 0;
  const totalPrice = nights > 0 && booking.house?.price
    ? booking.house.price * nights
    : null;

  const title = showRequester
    ? booking.name || 'Гость'
    : (booking.house?.address ?? 'Объявление');

  const subtitle = showRequester
    ? booking.house?.address
    : booking.house?.city;

  const createdAt = format(parseISO(booking.created_at), 'd MMM, HH:mm', { locale: ru });

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="mb-3 rounded-card border border-line bg-surface active:opacity-90"
      style={{ overflow: 'hidden' }}
    >
      {/* Top stripe: status badge left, booking number right */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingHorizontal: 12,
          paddingTop: 10,
          paddingBottom: 8,
          borderBottomWidth: 1,
          borderBottomColor: palette.line,
        }}
      >
        <View
          style={{
            backgroundColor: badgeColor + '22', // 13% opacity tint
            borderRadius: 999,
            paddingHorizontal: 10,
            paddingVertical: 4,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 5,
          }}
        >
          <View
            style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: badgeColor }}
          />
          <Text style={{ fontSize: 12, fontWeight: '600', color: badgeColor }}>
            {status.label}
          </Text>
        </View>

        <Text style={{ fontSize: 11, color: palette.inkMuted, fontWeight: '500' }}>
          №{booking.id}
        </Text>
      </View>

      {/* Main content row: image + details */}
      <View style={{ flexDirection: 'row', gap: 12, padding: 12 }}>
        {/* Image */}
        <View
          style={{
            width: imgSize,
            height: imgSize,
            borderRadius: 10,
            overflow: 'hidden',
            backgroundColor: palette.surfaceSkeleton,
            flexShrink: 0,
          }}
        >
          <ResilientImage
            uri={cover}
            style={{ width: imgSize, height: imgSize }}
            fallbackSize={28}
            transition={150}
          />
        </View>

        {/* Details */}
        <View style={{ flex: 1, gap: 3, justifyContent: 'center' }}>
          <Text
            numberOfLines={2}
            style={{ fontSize: 15, fontWeight: '700', color: palette.ink, lineHeight: 20 }}
          >
            {title}
          </Text>

          {subtitle ? (
            <Text
              numberOfLines={1}
              style={{ fontSize: 12, color: palette.inkSecondary }}
            >
              {subtitle}
            </Text>
          ) : null}

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
            <Ionicons name="calendar-outline" size={12} color={palette.inkMuted} />
            <Text style={{ fontSize: 12, color: palette.inkSecondary }}>
              {formatDateRangeRu(start, end)}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="people-outline" size={12} color={palette.inkMuted} />
            <Text style={{ fontSize: 12, color: palette.inkSecondary }}>
              {formatGuests(booking.count)}
            </Text>
          </View>

          {totalPrice != null ? (
            <Text
              style={{ fontSize: 16, fontWeight: '800', color: palette.ink, marginTop: 4 }}
            >
              {formatRub(totalPrice)} ₽
            </Text>
          ) : null}
        </View>
      </View>

      {/* Bottom section: two separate rows */}
      <View
        style={{
          borderTopWidth: 1,
          borderTopColor: palette.line,
          paddingHorizontal: 12,
          paddingTop: 8,
          paddingBottom: 10,
          gap: 10,
        }}
      >
        {/* Row 1: created date */}
        <Text style={{ fontSize: 11, color: palette.inkMuted }}>
          Создана {createdAt}
        </Text>

        {/* Row 2: action buttons */}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {booking.status === 'pending_verification' && onVerifyEmail ? (
            <TouchableOpacity
              onPress={(e) => { e.stopPropagation(); onVerifyEmail(); }}
              style={{
                flex: 1,
                backgroundColor: palette.primary,
                borderRadius: 999,
                paddingVertical: 9,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#fff' }}>
                Подтвердить почту
              </Text>
            </TouchableOpacity>
          ) : (
            <>
              {/* Открыть чат — always shown */}
              <TouchableOpacity
                onPress={(e) => { e.stopPropagation(); onChatPress ? onChatPress() : onPress(); }}
                style={{
                  flex: 1,
                  borderWidth: 1,
                  borderColor: palette.line,
                  borderRadius: 999,
                  paddingVertical: 9,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <Ionicons name="chatbubble-outline" size={14} color={palette.ink} />
                <Text style={{ fontSize: 13, fontWeight: '600', color: palette.ink }}>
                  Открыть чат
                </Text>
              </TouchableOpacity>

              {/* Повторить */}
              {onRepeat ? (
                <TouchableOpacity
                  onPress={(e) => { e.stopPropagation(); onRepeat(); }}
                  style={{
                    flex: 1,
                    backgroundColor: palette.primary,
                    borderRadius: 999,
                    paddingVertical: 9,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#fff' }}>
                    Повторить
                  </Text>
                </TouchableOpacity>
              ) : null}
            </>
          )}
        </View>
      </View>

    </Pressable>
  );
}

