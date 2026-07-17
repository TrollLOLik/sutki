import { parseISO } from 'date-fns';
import { Pressable, Text, View } from 'react-native';

import { ResilientImage } from '@/components/ResilientImage';
import { Badge, Button } from '@/components/ui';
import { historyKind, historyMeta } from '@/lib/booking-history';
import { formatDateRangeRu } from '@/lib/format';
import type { Booking } from '@/types/booking';

interface HistoryBookingCardProps {
  booking: Booking;
  onPress: () => void;
  /** "Повторить" — start a new request for the same listing. */
  onRepeat: () => void;
  /** "Оставить отзыв" — only offered for completed stays. */
  onReview: () => void;
  reviewAvailable?: boolean;
  reviewLabel?: string;
}

export function HistoryBookingCard({ booking, onPress, onRepeat, onReview, reviewAvailable, reviewLabel }: HistoryBookingCardProps) {
  const kind = historyKind(booking);
  const meta = historyMeta(kind);
  const cover = booking.house?.cover_url;
  const start = parseISO(booking.start_date);
  const end = booking.end_date ? parseISO(booking.end_date) : null;

  return (
    <View className="mb-3 rounded-card border border-line bg-surface p-3">
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        className="flex-row gap-3 active:opacity-80">
        <View className="h-20 w-20 overflow-hidden rounded-field bg-surface-skeleton">
          <ResilientImage uri={cover} style={{ flex: 1 }} fallbackSize={24} transition={150} />
        </View>
        <View className="flex-1 justify-between py-0.5">
          <View className="gap-0.5">
            <Text numberOfLines={1} className="text-base font-semibold text-ink">
              {booking.house?.address ?? 'Объявление'}
            </Text>
            {booking.house?.city ? (
              <Text numberOfLines={1} className="text-sm text-ink-secondary">
                {booking.house.city}
              </Text>
            ) : null}
            <Text className="text-sm text-ink-muted">{formatDateRangeRu(start, end)}</Text>
          </View>
          <Badge label={meta.label} tone={meta.tone} />
        </View>
      </Pressable>

      <View className="mt-3 flex-row gap-2">
        <View className="flex-1">
          <Button label="Повторить" variant="secondary" size="md" onPress={onRepeat} />
        </View>
        {reviewAvailable ? (
          <View className="flex-1">
            <Button label={reviewLabel || "Оставить отзыв"} size="md" onPress={onReview} />
          </View>
        ) : null}
      </View>
    </View>
  );
}
