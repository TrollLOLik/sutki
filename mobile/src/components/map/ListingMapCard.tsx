import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { AnimatePresence, MotiView } from 'moti';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ResilientImage } from '@/components/ResilientImage';
import { formatRating, formatRooms, formatRub } from '@/lib/format';
import { useAppTheme } from '@/theme/useAppTheme';
import type { Palette } from '@/theme/tokens';
import type { ListingCard } from '@/types/listing';

interface ListingMapCardProps {
  listing: ListingCard | null;
  onClose: () => void;
  isFavorite?: boolean;
  isViewed?: boolean;
  isOwn?: boolean;
}

/**
 * Bottom mini-card shown when a price bubble is tapped on the map. Tapping the
 * card navigates to the listing detail; the close button dismisses it.
 *
 * Positioned above the tab bar and bottom "search here" pill so it never
 * overlaps them.
 */
export function ListingMapCard({ listing, onClose, isFavorite, isViewed, isOwn }: ListingMapCardProps) {
  const { palette } = useAppTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const promoted = (listing?.promotion_types ?? []).length > 0;
  const highlighted = (listing?.promotion_types ?? []).includes('highlight');

  return (
    <AnimatePresence>
      {listing ? (
        <MotiView
          key={listing.id}
          pointerEvents="box-none"
          from={{ opacity: 0, translateY: 24, scale: 0.98 }}
          animate={{ opacity: 1, translateY: 0, scale: 1 }}
          exit={{ opacity: 0, translateY: 24, scale: 0.97 }}
          transition={{ type: 'spring', damping: 20, stiffness: 230, mass: 0.8 }}
          exitTransition={{ type: 'timing', duration: 220 }}
          style={[styles.container, { marginBottom: insets.bottom + 96 }]}
        >
          <Pressable
            onPress={() => router.push(`/listing/${listing.id}`)}
            style={[styles.card, highlighted && styles.cardHighlighted]}
          >
            <ResilientImage uri={listing.cover_url} style={styles.image} fallbackSize={30} />

            <View style={styles.details}>
              {promoted || isFavorite || isOwn || isViewed ? (
                <View style={styles.badgesRow}>
                  {promoted ? (
                    <View style={styles.promotionBadge}>
                      <Ionicons name="sparkles" size={12} color={palette.primary} />
                      <Text style={styles.promotionText}>Продвигается</Text>
                    </View>
                  ) : null}
                  {isOwn || isViewed ? (
                    <View style={[styles.stateBadge, isOwn && styles.stateBadgeOwn]}>
                      <Ionicons
                        name={isOwn ? 'home-outline' : 'eye-outline'}
                        size={11}
                        color={isOwn ? '#FFFFFF' : palette.inkSecondary}
                      />
                      <Text style={[styles.stateBadgeText, isOwn && styles.stateBadgeTextOwn]}>
                        {isOwn ? 'Ваше' : 'Просмотрено'}
                      </Text>
                    </View>
                  ) : null}
                  {isFavorite ? <Ionicons name="heart" size={16} color={palette.primary} /> : null}
                </View>
              ) : null}
              <View style={styles.header}>
                <Text style={styles.price}>{formatRub(listing.price)} ₽</Text>
                {listing.rating > 0 ? (
                  <View style={styles.ratingRow}>
                    <Ionicons name="star" size={13} color={palette.star} style={{ marginRight: 2 }} />
                    <Text style={styles.ratingText}>
                      {formatRating(listing.rating).replace('.', ',')}
                    </Text>
                  </View>
                ) : null}
              </View>

              <Text numberOfLines={1} style={styles.title}>
                {formatRooms(listing.rooms)} · {listing.area} м²
              </Text>

              <Text numberOfLines={1} style={styles.address}>
                {listing.address}
              </Text>
              <View style={styles.viewsRow}>
                <Ionicons name="eye-outline" size={13} color={palette.inkMuted} />
                <Text style={styles.viewsText}>{listing.views}</Text>
              </View>
            </View>

            <Pressable
              hitSlop={10}
              onPress={onClose}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={17} color={palette.inkSecondary} />
            </Pressable>
          </Pressable>
        </MotiView>
      ) : null}
    </AnimatePresence>
  );
}

const makeStyles = (palette: Palette) =>
  StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 16,
    right: 16,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.surfaceMuted,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: palette.line,
    overflow: 'hidden',
    height: 128,
    padding: 9,
    shadowColor: '#1A1A1A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 10,
  },
  cardHighlighted: {
    borderWidth: 2,
    borderColor: palette.primary,
    shadowColor: palette.primary,
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 14,
  },
  image: {
    width: 110,
    height: 110,
    borderRadius: 18,
  },
  details: {
    flex: 1,
    paddingLeft: 12,
    paddingRight: 28,
    paddingVertical: 3,
    justifyContent: 'center',
  },
  promotionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: palette.primaryLight,
  },
  promotionText: {
    color: palette.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  badgesRow: {
    minHeight: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 5,
  },
  stateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.surface,
  },
  stateBadgeOwn: {
    borderColor: palette.primary,
    backgroundColor: palette.primary,
  },
  stateBadgeText: {
    color: palette.inkSecondary,
    fontSize: 10,
    fontWeight: '700',
  },
  stateBadgeTextOwn: {
    color: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  price: {
    fontSize: 19,
    fontWeight: '800',
    color: palette.primary,
    fontVariant: ['tabular-nums'],
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.surfaceMuted,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  ratingText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: palette.ink,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: palette.ink,
    marginBottom: 3,
  },
  address: {
    fontSize: 12,
    color: palette.inkSecondary,
  },
  viewsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 3,
  },
  viewsText: {
    fontSize: 11,
    color: palette.inkMuted,
  },
  closeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.line,
  },
});
