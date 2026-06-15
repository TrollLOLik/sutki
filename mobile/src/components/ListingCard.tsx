import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Pressable, Text, View } from 'react-native';

import { formatPricePerNight, formatRooms } from '@/lib/format';
import { palette } from '@/theme/tokens';
import type { ListingCard as ListingCardModel } from '@/types/listing';

interface ListingCardProps {
  listing: ListingCardModel;
  onPress?: () => void;
  /** When set, a heart toggle is shown over the cover photo. */
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
}

export function ListingCard({ listing, onPress, isFavorite, onToggleFavorite }: ListingCardProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className="mb-4 overflow-hidden rounded-card border border-line bg-surface active:opacity-90">
      <View className="h-44 bg-surface-skeleton">
        {listing.cover_url ? (
          <Image
            source={{ uri: listing.cover_url }}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            transition={150}
          />
        ) : (
          <View className="flex-1 items-center justify-center">
            <Ionicons name="image-outline" size={40} color={palette.inkMuted} />
          </View>
        )}
        {onToggleFavorite ? (
          <Pressable
            onPress={onToggleFavorite}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={isFavorite ? 'Убрать из избранного' : 'В избранное'}
            className="absolute right-2 top-2 h-9 w-9 items-center justify-center rounded-full bg-surface active:opacity-80">
            <Ionicons
              name={isFavorite ? 'heart' : 'heart-outline'}
              size={18}
              color={isFavorite ? palette.primary : palette.ink}
            />
          </Pressable>
        ) : null}
      </View>

      <View className="gap-1 p-3">
        <Text numberOfLines={1} className="text-base font-semibold text-ink">
          {listing.address}
        </Text>

        <View className="flex-row items-center gap-1">
          <Ionicons name="location-outline" size={14} color={palette.inkSecondary} />
          <Text className="text-sm text-ink-secondary">{listing.city}</Text>
          <Text className="text-sm text-ink-muted">· {formatRooms(listing.rooms)}</Text>
          {listing.area > 0 ? (
            <Text className="text-sm text-ink-muted">· {listing.area} м²</Text>
          ) : null}
        </View>

        <View className="mt-1 flex-row items-center justify-between">
          <Text className="text-lg font-bold text-primary">
            {formatPricePerNight(listing.price)}
          </Text>
          <View className="flex-row items-center gap-1">
            <Ionicons name="eye-outline" size={14} color={palette.inkMuted} />
            <Text className="text-xs text-ink-muted">{listing.views}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}
