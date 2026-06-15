import { Ionicons } from '@expo/vector-icons';
import { parseISO } from 'date-fns';
import { Image } from 'expo-image';
import { Pressable, Text, View } from 'react-native';

import { Badge } from '@/components/ui';
import { bookingStatusMeta } from '@/lib/booking-status';
import { formatDateRangeRu } from '@/lib/format';
import { palette } from '@/theme/tokens';
import type { Booking } from '@/types/booking';

export function BookingCard({ booking, onPress }: { booking: Booking; onPress: () => void }) {
  const status = bookingStatusMeta(booking.status);
  const cover = booking.house?.cover_url;
  const start = parseISO(booking.start_date);
  const end = booking.end_date ? parseISO(booking.end_date) : null;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="mb-3 flex-row gap-3 rounded-card border border-line bg-surface p-3 active:opacity-80">
      <View className="h-20 w-20 overflow-hidden rounded-field bg-surface-skeleton">
        {cover ? (
          <Image source={{ uri: cover }} style={{ flex: 1 }} contentFit="cover" transition={150} />
        ) : (
          <View className="flex-1 items-center justify-center">
            <Ionicons name="image-outline" size={24} color={palette.inkMuted} />
          </View>
        )}
      </View>
      <View className="flex-1 justify-between py-0.5">
        <View className="gap-0.5">
          <Text numberOfLines={1} className="text-base font-semibold text-ink">
            {booking.house?.address ?? 'Объявление'}
          </Text>
          {booking.house?.city ? (
            <Text className="text-sm text-ink-secondary">{booking.house.city}</Text>
          ) : null}
          <Text className="text-sm text-ink-muted">{formatDateRangeRu(start, end)}</Text>
        </View>
        <Badge label={status.label} tone={status.tone} />
      </View>
    </Pressable>
  );
}
