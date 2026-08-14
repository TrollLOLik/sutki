import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { ResilientImage } from '@/components/ResilientImage';
import { ListingOwnerActions } from '@/components/ListingOwnerActions';
import {
  PromotionBadge,
  PromotionHighlightSurface,
} from '@/components/promotion/PromotionHighlightSurface';
import { AnimatedListItem, AppIcon, AppText, IconButton, PressableScale, materialSurfaceColor } from '@/components/ui';
import { formatRating, formatRub } from '@/lib/format';
import { useAppTheme } from '@/theme/useAppTheme';
import type { ListingCard as ListingCardModel } from '@/types/listing';

interface ListingCardProps {
  listing: ListingCardModel;
  layout?: 'list' | 'grid';
  onPress?: () => void;
  /** When set, a heart toggle is shown. */
  isFavorite?: boolean;
  isOwn?: boolean;
  isViewed?: boolean;
  onToggleFavorite?: () => void;
  onEdit?: () => void;
  onPromote?: () => void;
  onUnpublish?: () => void;
  onPublish?: () => void;
  onBook?: () => void;
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

function ListingBookingAction({
  compact,
  onPress,
}: {
  compact: boolean;
  onPress: () => void;
}) {
  const { palette } = useAppTheme();

  return (
    <View
      style={{
        marginTop: compact ? 9 : 10,
        borderTopWidth: compact ? 1 : 0,
        borderTopColor: compact ? 'rgba(128,128,128,0.18)' : 'transparent',
        paddingTop: compact ? 8 : 0,
      }}>
      <PressableScale
        pressedScale={0.97}
        accessibilityRole="button"
        accessibilityLabel="Оставить заявку"
        onPress={(event) => {
          event.stopPropagation();
          onPress();
        }}>
        <View
          style={{
              minHeight: compact ? 36 : 42,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 5,
              borderRadius: compact ? 12 : 14,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.18)',
              backgroundColor: palette.primary,
              paddingHorizontal: compact ? 5 : 10,
              shadowColor: palette.primary,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.2,
              shadowRadius: 8,
              elevation: 3,
          }}>
          <AppIcon name="calendar-outline" size={compact ? 15 : 17} color="#FFFFFF" />
          <AppText
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
            style={{
              flexShrink: 1,
              color: '#FFFFFF',
              fontSize: compact ? 10 : 12,
              lineHeight: compact ? 13 : 16,
              fontWeight: '800',
            }}>
            Оставить заявку
          </AppText>
        </View>
      </PressableScale>
    </View>
  );
}

export function ListingCard({
  listing,
  layout = 'list',
  onPress,
  isFavorite,
  isOwn,
  isViewed,
  onToggleFavorite,
  onEdit,
  onPromote,
  onUnpublish,
  onPublish,
  onBook,
  showOwnerStats = false,
}: ListingCardProps) {
  const { palette, isDark } = useAppTheme();
  const { width: screenWidth } = useWindowDimensions();

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

  if (layout === 'grid') {
    return (
      <AnimatedListItem style={{ flex: 1, marginBottom: 12 }}>
        <PromotionHighlightSurface active={isHighlighted} radius={19}>
          <PressableScale
            motionVariant="surface"
            pressedScale={0.988}
            accessibilityRole="button"
            onPress={onPress}
            style={{
              minHeight: showOwnerStats ? 350 : 286,
              borderRadius: isHighlighted ? 17.5 : 19,
              borderWidth: isHighlighted ? 0 : 1,
              borderColor: isHighlighted ? 'transparent' : palette.line,
              backgroundColor: cardBackground,
              padding: 8,
              shadowColor: '#000000',
              shadowOpacity: isHighlighted ? 0 : isDark ? 0.14 : 0.05,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 6 },
              elevation: isHighlighted ? 0 : isDark ? 1 : 2,
            }}
          >
            <View
              style={{
                width: '100%',
                aspectRatio: 4 / 3,
                overflow: 'hidden',
                borderRadius: 13,
                backgroundColor: palette.surfaceSkeleton,
              }}
            >
              <ResilientImage
                uri={listing.cover_url}
                style={{ width: '100%', height: '100%' }}
                fallbackSize={30}
                transition={150}
              />

              {isPromoted ? (
                <View style={{ position: 'absolute', top: 7, left: 7, maxWidth: '72%' }}>
                  <PromotionBadge highlighted={isHighlighted} />
                </View>
              ) : null}

              {onToggleFavorite ? (
                <IconButton
                  accessibilityRole="button"
                  accessibilityLabel={isFavorite ? 'Убрать из избранного' : 'В избранное'}
                  hitSlop={6}
                  icon={isFavorite ? 'heart' : 'heart-outline'}
                  iconSize={19}
                  size={34}
                  tone="primary"
                  selected={isFavorite}
                  surface="floating"
                  onPress={(event) => {
                    event.stopPropagation();
                    onToggleFavorite();
                  }}
                  style={{
                    position: 'absolute',
                    top: 7,
                    right: 7,
                  }}
                />
              ) : null}

              {isOwn || isViewed ? (
                <Animated.View
                  key={listing.status}
                  entering={FadeIn.duration(150)}
                  exiting={FadeOut.duration(100)}
                  style={{
                    position: 'absolute',
                    bottom: 7,
                    left: 7,
                    maxWidth: '82%',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: isOwn ? palette.primary : palette.line,
                    backgroundColor: isOwn ? palette.primary : palette.overlaySurface,
                    paddingHorizontal: 7,
                    paddingVertical: 4,
                  }}
                >
                  <Ionicons
                    name={isOwn ? 'home-outline' : 'eye-outline'}
                    size={11}
                    color={isOwn ? '#FFFFFF' : palette.inkSecondary}
                  />
                  <Text
                    numberOfLines={1}
                    style={{
                      flexShrink: 1,
                      color: isOwn ? '#FFFFFF' : palette.inkSecondary,
                      fontSize: 9,
                      fontWeight: '800',
                    }}
                  >
                    {isOwn ? 'Ваше' : 'Просмотрено'}
                  </Text>
                </Animated.View>
              ) : null}
            </View>

            <View style={{ flex: 1, paddingHorizontal: 2, paddingTop: 9 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                <Text
                  numberOfLines={1}
                  style={{ flex: 1, color: palette.ink, fontSize: 17, fontWeight: '900' }}
                >
                  {formatRub(listing.price)} ₽
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                  <Ionicons name="star" size={13} color="#FFB400" />
                  <Text style={{ color: palette.ink, fontSize: 11, fontWeight: '800' }}>
                    {formatRating(listing.rating).replace('.', ',')}
                  </Text>
                </View>
              </View>

              <Text
                numberOfLines={2}
                style={{ minHeight: 38, marginTop: 5, color: palette.ink, fontSize: 14, lineHeight: 19, fontWeight: '800' }}
              >
                {getCardTitle()}
              </Text>
              <Text
                numberOfLines={1}
                style={{ marginTop: 3, color: palette.inkSecondary, fontSize: 11 }}
              >
                {listing.address}
              </Text>

              <View style={{ marginTop: 7, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                  <Ionicons name="expand-outline" size={12} color={palette.inkMuted} />
                  <Text style={{ color: palette.inkSecondary, fontSize: 10 }}>{listing.area} м²</Text>
                </View>
                <View style={{ minWidth: 0, flex: 1, flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                  <Ionicons name="bed-outline" size={12} color={palette.inkMuted} />
                  <Text numberOfLines={1} style={{ flexShrink: 1, color: palette.inkSecondary, fontSize: 10 }}>
                    {formatRoomsPlural(listing.rooms)}
                  </Text>
                </View>
              </View>

              {moderationBadge ? (
                <View
                  style={{
                    alignSelf: 'flex-start',
                    maxWidth: '100%',
                    marginTop: 8,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                    borderRadius: 999,
                    backgroundColor: moderationBadge.bg,
                    paddingHorizontal: 8,
                    paddingVertical: 5,
                  }}
                >
                  <Ionicons
                    name={listing.status === 'rejected' ? 'close-circle' : listing.status === 'unpublished' ? 'eye-off-outline' : 'time-outline'}
                    size={12}
                    color={moderationBadge.fg}
                  />
                  <Text numberOfLines={1} style={{ flexShrink: 1, color: moderationBadge.fg, fontSize: 9, fontWeight: '800' }}>
                    {moderationBadge.label}
                  </Text>
                </View>
              ) : null}

              {showOwnerStats && listing.views_30d != null ? (
                <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name="analytics-outline" size={13} color={palette.primary} />
                  <Text numberOfLines={1} style={{ color: palette.inkSecondary, fontSize: 10, fontWeight: '700' }}>
                    {listing.views_30d} за 30 дней
                  </Text>
                </View>
              ) : null}
            </View>

            <ListingOwnerActions
              compact
              onEdit={onEdit}
              onPromote={onPromote}
              onPublish={onPublish}
              onUnpublish={onUnpublish}
              style={{ marginTop: 9 }}
            />
            {onBook ? <ListingBookingAction compact onPress={onBook} /> : null}
          </PressableScale>
        </PromotionHighlightSurface>
      </AnimatedListItem>
    );
  }

  return (
    <AnimatedListItem style={{ marginBottom: 12 }}>
      <PromotionHighlightSurface active={isHighlighted} radius={20}>
        <PressableScale
          motionVariant="surface"
          pressedScale={0.988}
          onPress={onPress}
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
                <IconButton
                  icon={isFavorite ? 'heart' : 'heart-outline'}
                  iconSize={20}
                  size={32}
                  tone="primary"
                  selected={isFavorite}
                  surface="bare"
                  onPress={(e) => {
                    e.stopPropagation();
                    onToggleFavorite();
                  }}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={isFavorite ? 'Убрать из избранного' : 'В избранное'}
                />
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
          <Animated.View
            key={listing.status}
            entering={FadeIn.duration(150)}
            exiting={FadeOut.duration(100)}
            className="self-start flex-row items-center gap-1.5 rounded-full px-3 py-1.5"
            style={{ backgroundColor: moderationBadge.bg }}
          >
            <Ionicons
              name={listing.status === 'rejected' ? 'close-circle' : listing.status === 'unpublished' ? 'eye-off-outline' : 'time-outline'}
              size={13}
              color={moderationBadge.fg}
            />
            <Text
              numberOfLines={1}
              ellipsizeMode="tail"
              style={{ flexShrink: 1, fontSize: 11, fontWeight: '700', color: moderationBadge.fg }}>
              {moderationBadge.label}
            </Text>
          </Animated.View>
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
      <ListingOwnerActions
        onEdit={onEdit}
        onPromote={onPromote}
        onPublish={onPublish}
        onUnpublish={onUnpublish}
        style={{ marginTop: 10 }}
      />
      {onBook ? <ListingBookingAction compact={false} onPress={onBook} /> : null}
        </PressableScale>
      </PromotionHighlightSurface>
    </AnimatedListItem>
  );
}
