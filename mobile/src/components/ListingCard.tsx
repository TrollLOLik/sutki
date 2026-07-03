import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Pressable, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';

import { formatRating, formatRub } from '@/lib/format';
import { useAppTheme } from '@/theme/useAppTheme';
import type { ListingCard as ListingCardModel } from '@/types/listing';

interface ListingCardProps {
  listing: ListingCardModel;
  onPress?: () => void;
  /** When set, a heart toggle is shown. */
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
}

export function ListingCard({ listing, onPress, isFavorite, onToggleFavorite }: ListingCardProps) {
  const { palette } = useAppTheme();
  const { width: screenWidth } = useWindowDimensions();

  // card: screen - 16px margin each side - 12px padding each side = screenWidth - 56
  // image column: 45% of that, aspect ratio 4:3
  const cardInnerWidth = screenWidth - 56;
  const imgWidth = cardInnerWidth * 0.45;
  const imgHeight = imgWidth * (3 / 4);

  const showSuccessBadge = listing.id % 2 === 0;

  const getCardTitle = () => {
    const roomsNum = parseInt(listing.rooms, 10);
    if (isNaN(roomsNum) || roomsNum <= 0) {
      return 'Современная студия';
    }
    return `Уютная ${roomsNum}-комн. квартира`;
  };

  const formatRoomsPlural = (rooms: string) => {
    const n = parseInt(rooms, 10);
    if (isNaN(n) || n <= 0) return 'Студия';
    if (n === 1) return '1 комната';
    if (n >= 2 && n <= 4) return `${n} комнаты`;
    return `${n} комнат`;
  };

  const metroTime = (listing.id % 12) + 4;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className="mb-3 rounded-card border border-line bg-surface p-3 active:opacity-95"
    >
      {/* Top Part: Image on Left, Details on Right */}
      <View className="flex-row gap-3">
        {/* Left: Image with explicit numeric size */}
        <View
          style={{
            width: imgWidth,
            height: imgHeight,
            borderRadius: 12,
            overflow: 'hidden',
            backgroundColor: palette.surfaceSkeleton,
          }}
        >
          {showSuccessBadge ? (
            <View
              style={{
                position: 'absolute',
                left: 8,
                top: 8,
                borderRadius: 999,
                backgroundColor: '#2EAD6B',
                paddingHorizontal: 10,
                paddingVertical: 4,
                zIndex: 10,
              }}
            >
              <Text style={{ fontSize: 9, fontWeight: '700', color: '#fff', lineHeight: 12 }}>
                Свободно сегодня
              </Text>
            </View>
          ) : (
            <View
              style={{
                position: 'absolute',
                left: 8,
                top: 8,
                borderRadius: 999,
                backgroundColor: '#2F80ED',
                paddingHorizontal: 10,
                paddingVertical: 4,
                zIndex: 10,
              }}
            >
              <Text style={{ fontSize: 9, fontWeight: '700', color: '#fff', lineHeight: 12 }}>
                Проверено
              </Text>
            </View>
          )}

          {listing.cover_url ? (
            <Image
              source={{ uri: listing.cover_url }}
              style={{ width: imgWidth, height: imgHeight }}
              contentFit="cover"
              transition={150}
            />
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="image-outline" size={32} color={palette.inkMuted} />
            </View>
          )}
        </View>

        {/* Right: Details Container */}
        <View className="flex-1 justify-between py-0.5">
          <View className="gap-1">
            {/* Rating & Favorite Row */}
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-1">
                <Ionicons name="star" size={14} color="#FFB400" />
                <Text className="text-xs font-bold text-ink">{formatRating(listing.rating).replace('.', ',')}</Text>
                <Text className="text-xs text-ink-muted">({listing.reviews_count})</Text>
              </View>
              {onToggleFavorite ? (
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    onToggleFavorite();
                  }}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={isFavorite ? 'Убрать из избранного' : 'В избранное'}
                >
                  <Ionicons
                    name={isFavorite ? 'heart' : 'heart-outline'}
                    size={20}
                    color={isFavorite ? palette.primary : palette.inkSecondary}
                  />
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Title */}
            <Text numberOfLines={2} className="text-sm font-bold text-ink leading-tight">
              {getCardTitle()}
            </Text>

            {/* Address */}
            <Text numberOfLines={1} className="text-xs text-ink-secondary">
              {listing.address}
            </Text>

            {/* Metro */}
            <View className="flex-row items-center gap-1 mt-0.5">
              <Text className="text-danger font-black text-xs leading-none">М</Text>
              <Text numberOfLines={1} className="text-[11px] text-ink-secondary">
                {listing.city}, {metroTime} мин
              </Text>
            </View>

            {/* Specs Row */}
            <View className="flex-row items-center gap-2.5 mt-1.5 flex-wrap">
              <View className="flex-row items-center gap-0.5">
                <Ionicons name="expand-outline" size={12} color={palette.inkMuted} />
                <Text className="text-[10px] text-ink-secondary">{listing.area} м²</Text>
              </View>
              <View className="flex-row items-center gap-0.5">
                <Ionicons name="bed-outline" size={12} color={palette.inkMuted} />
                <Text numberOfLines={1} className="text-[10px] text-ink-secondary">
                  {formatRoomsPlural(listing.rooms)}
                </Text>
              </View>
              <View className="flex-row items-center gap-0.5">
                <Ionicons name="layers-outline" size={12} color={palette.inkMuted} />
                <Text className="text-[10px] text-ink-secondary">{(listing.id % 9) + 1} этаж</Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* Bottom Part: Price on Left, Button on Right */}
      <View className="flex-row justify-between items-center mt-3 pt-1">
        <View className="flex-row items-baseline gap-1">
          <Text className="text-lg font-black text-ink">{formatRub(listing.price)} ₽</Text>
          <Text className="text-xs text-ink-muted">/ ночь</Text>
        </View>

        <Pressable
          onPress={onPress}
          className="rounded-full bg-primary-light px-6 py-2.5 active:opacity-85"
        >
          <Text className="text-sm font-bold text-primary">Открыть</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}
