import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';

import { ResilientImage } from '@/components/ResilientImage';
import { formatRating, formatRub } from '@/lib/format';
import { useAppTheme } from '@/theme/useAppTheme';
import type { ListingCard as ListingCardModel } from '@/types/listing';

interface ListingCardProps {
  listing: ListingCardModel;
  onPress?: () => void;
  /** When set, a heart toggle is shown. */
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  onPromote?: () => void;
  onUnpublish?: () => void;
  onPublish?: () => void;
  showOwnerStats?: boolean;
}

/**
 * Owner-facing moderation states. `status` is only present in /listings/mine
 * responses, so public cards never render these badges.
 */
const MODERATION_BADGES: Record<string, { label: string; bg: string; fg: string }> = {
  pending_moderation: { label: 'На проверке', bg: '#FFF4E0', fg: '#B25E00' },
  moderation_review: { label: 'На ручной проверке', bg: '#FFF4E0', fg: '#B25E00' },
  rejected: { label: 'Отклонено', bg: '#FDEBEC', fg: '#C0362C' },
  unpublished: { label: 'Снято с публикации', bg: '#EEF0F3', fg: '#606873' },
};

export function ListingCard({ listing, onPress, isFavorite, onToggleFavorite, onPromote, onUnpublish, onPublish, showOwnerStats = false }: ListingCardProps) {
  const { palette } = useAppTheme();
  const { width: screenWidth } = useWindowDimensions();

  // card: screen - 16px margin each side - 12px padding each side = screenWidth - 56
  // image column: 45% of that, aspect ratio 4:3
  const cardInnerWidth = screenWidth - 56;
  const imgWidth = cardInnerWidth * 0.45;
  const imgHeight = imgWidth * (3 / 4);

  const promotionTypes = listing.promotion_types ?? [];
  const isPromoted = promotionTypes.length > 0;
  const isHighlighted = promotionTypes.includes('highlight');

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

  const moderationBadge =
    listing.status && listing.status !== 'active' ? MODERATION_BADGES[listing.status] : undefined;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className="mb-3 rounded-card border bg-surface p-3 active:opacity-95"
      style={{
        borderColor: isHighlighted ? palette.primary : palette.line,
        borderWidth: isHighlighted ? 2 : 1,
      }}
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
          {isPromoted ? (
            <View style={{ position:'absolute',left:8,top:8,borderRadius:999,backgroundColor:palette.primary,paddingHorizontal:10,paddingVertical:4,zIndex:10 }}>
              <Text style={{fontSize:9,fontWeight:'700',color:'#fff',lineHeight:12}}>Продвигается</Text>
            </View>
          ) : null}

          <ResilientImage
            uri={listing.cover_url}
            style={{ width: imgWidth, height: imgHeight }}
            fallbackSize={32}
            transition={150}
          />
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
                <Ionicons name="eye-outline" size={12} color={palette.inkMuted} />
                <Text className="text-[10px] text-ink-secondary">{listing.views}</Text>
              </View>
              <View className="flex-row items-center gap-0.5">
                <Ionicons name="layers-outline" size={12} color={palette.inkMuted} />
                <Text className="text-[10px] text-ink-secondary">{(listing.id % 9) + 1} этаж</Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* Owner-only moderation status (my listings screen) */}
      {moderationBadge ? (
        <View className="mt-3 gap-1">
          <View
            className="self-start flex-row items-center gap-1.5 rounded-full px-3 py-1.5"
            style={{ backgroundColor: moderationBadge.bg }}
          >
            <Ionicons
              name={listing.status === 'rejected' ? 'close-circle' : listing.status === 'unpublished' ? 'eye-off-outline' : 'time-outline'}
              size={13}
              color={moderationBadge.fg}
            />
            <Text style={{ fontSize: 11, fontWeight: '700', color: moderationBadge.fg }}>
              {moderationBadge.label}
            </Text>
          </View>
          {(listing.status === 'rejected' || listing.status === 'moderation_review') && listing.rejection_reason ? (
            <Text numberOfLines={3} className="text-[11px] text-ink-secondary leading-4">
              {listing.status === 'rejected' ? 'Причина' : 'Комментарий'}: {listing.rejection_reason}
              {listing.status === 'rejected' ? '. Отредактируйте объявление, чтобы отправить его на повторную проверку.' : ''}
            </Text>
          ) : null}
        </View>
      ) : null}

      {showOwnerStats && listing.views_30d != null ? (
        <View className="mt-3 flex-row items-center gap-1.5 border-t border-line pt-3">
          <Ionicons name="analytics-outline" size={15} color={palette.primary} />
          <Text className="text-xs font-semibold text-ink-secondary">
            {listing.views_30d} просмотров за 30 дней
          </Text>
        </View>
      ) : null}

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
      {onPromote ? (
        <Pressable onPress={(event)=>{event.stopPropagation();onPromote();}} className="mt-3 h-10 flex-row items-center justify-center gap-2 rounded-field bg-primary-light active:opacity-85">
          <Ionicons name="rocket-outline" size={17} color={palette.primary}/><Text className="text-sm font-bold text-primary">Продвигать</Text>
        </Pressable>
      ) : null}
      {onUnpublish ? (
        <Pressable onPress={(event)=>{event.stopPropagation();onUnpublish();}} className="mt-2 h-10 flex-row items-center justify-center gap-2 rounded-field border border-line bg-surface-muted active:opacity-85">
          <Ionicons name="eye-off-outline" size={17} color={palette.inkSecondary}/><Text className="text-sm font-bold text-ink-secondary">Снять с публикации</Text>
        </Pressable>
      ) : null}
      {onPublish ? (
        <Pressable onPress={(event)=>{event.stopPropagation();onPublish();}} className="mt-2 h-10 flex-row items-center justify-center gap-2 rounded-field bg-primary active:opacity-85">
          <Ionicons name="cloud-upload-outline" size={17} color="#fff"/><Text className="text-sm font-bold text-white">Опубликовать снова</Text>
        </Pressable>
      ) : null}
    </Pressable>
  );
}
