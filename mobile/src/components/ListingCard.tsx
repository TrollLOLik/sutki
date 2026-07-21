import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { ResilientImage } from '@/components/ResilientImage';
import {
  PromotionBadge,
  PromotionHighlightSurface,
} from '@/components/promotion/PromotionHighlightSurface';
import { materialSurfaceColor } from '@/components/ui';
import { formatRating, formatRub } from '@/lib/format';
import { useAppTheme } from '@/theme/useAppTheme';
import type { ListingCard as ListingCardModel } from '@/types/listing';

interface ListingCardProps {
  listing: ListingCardModel;
  onPress?: () => void;
  /** When set, a heart toggle is shown. */
  isFavorite?: boolean;
  isOwn?: boolean;
  isViewed?: boolean;
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

export function ListingCard({ listing, onPress, isFavorite, isOwn, isViewed, onToggleFavorite, onPromote, onUnpublish, onPublish, showOwnerStats = false }: ListingCardProps) {
  const { palette, isDark } = useAppTheme();
  const { width: screenWidth } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const pressScale = useSharedValue(1);
  const animatedCardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  // card: screen - 16px margin each side - 12px padding each side = screenWidth - 56
  // image column: 45% of that, aspect ratio 4:3
  const cardInnerWidth = screenWidth - 56;
  const imgWidth = cardInnerWidth * 0.45;
  const imgHeight = imgWidth * (3 / 4);

  const promotionTypes = listing.promotion_types ?? [];
  const isPromoted = promotionTypes.length > 0;
  const isHighlighted = promotionTypes.includes('highlight');
  const cardBackground = materialSurfaceColor(isDark, 'raised');

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

  const moderationBadge =
    listing.status && listing.status !== 'active' ? MODERATION_BADGES[listing.status] : undefined;

  return (
    <Animated.View style={[{ marginBottom: 12 }, animatedCardStyle]}>
      <PromotionHighlightSurface active={isHighlighted} radius={20}>
        <Pressable
          onPress={onPress}
          onPressIn={() => {
            pressScale.value = reduceMotion
              ? 1
              : withSpring(0.985, { damping: 22, stiffness: 340, mass: 0.6 });
          }}
          onPressOut={() => {
            pressScale.value = reduceMotion
              ? 1
              : withSpring(1, { damping: 18, stiffness: 260, mass: 0.7 });
          }}
          accessibilityRole="button"
          className="border p-3 active:opacity-95"
          style={{
            borderRadius: isHighlighted ? 18.5 : 20,
            backgroundColor: cardBackground,
            borderColor: isHighlighted ? 'transparent' : palette.line,
            borderWidth: isHighlighted ? 0 : 1,
            shadowColor: '#000000',
            shadowOpacity: isHighlighted ? 0 : isDark ? 0.14 : 0.05,
            shadowRadius: 14,
            shadowOffset: { width: 0, height: 7 },
            elevation: isHighlighted ? 0 : isDark ? 1 : 2,
          }}
        >
      {/* Top Part: Image on Left, Details on Right */}
      <View className="flex-row gap-3">
        {/* Left: Image with explicit numeric size */}
        <View
          style={{
            width: imgWidth,
            height: imgHeight,
            borderRadius: 14,
            overflow: 'hidden',
            backgroundColor: palette.surfaceSkeleton,
          }}
        >
          {isPromoted ? (
            <View style={{ position: 'absolute', left: 8, top: 8, zIndex: 10 }}>
              <PromotionBadge highlighted={isHighlighted} />
            </View>
          ) : null}

          {isOwn || isViewed ? (
            <View
              className="absolute bottom-2 left-2 z-10 flex-row items-center gap-1 rounded-full px-2 py-1"
              style={{
                backgroundColor: isOwn ? palette.primary : palette.surface,
                borderColor: isOwn ? palette.primary : palette.line,
                borderWidth: 1,
              }}
            >
              <Ionicons
                name={isOwn ? 'home-outline' : 'eye-outline'}
                size={11}
                color={isOwn ? '#FFFFFF' : palette.inkSecondary}
              />
              <Text
                style={{
                  color: isOwn ? '#FFFFFF' : palette.inkSecondary,
                  fontSize: 10,
                  fontWeight: '800',
                }}
              >
                {isOwn ? 'Ваше' : 'Просмотрено'}
              </Text>
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
            <Text numberOfLines={2} className="text-[15px] font-extrabold leading-5 text-ink">
              {getCardTitle()}
            </Text>

            {/* Address */}
            <Text numberOfLines={1} className="text-xs text-ink-secondary">
              {listing.address}
            </Text>

            <View className="mt-0.5 flex-row items-center gap-1">
              <Ionicons name="location-outline" size={12} color={palette.primary} />
              <Text numberOfLines={1} className="text-[11px] text-ink-secondary">
                {listing.city}
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
          hitSlop={6}
          className="min-h-11 flex-row items-center gap-0.5 px-2 active:opacity-70"
        >
          <Text className="text-sm font-bold text-primary">Открыть</Text>
          <Ionicons name="chevron-forward" size={16} color={palette.primary} />
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
      </PromotionHighlightSurface>
    </Animated.View>
  );
}
