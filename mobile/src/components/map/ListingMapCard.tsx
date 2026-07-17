import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
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
}

/**
 * Bottom mini-card shown when a price bubble is tapped on the map. Tapping the
 * card navigates to the listing detail; the close button dismisses it.
 *
 * Positioned above the tab bar and bottom "search here" pill so it never
 * overlaps them.
 */
export function ListingMapCard({ listing, onClose }: ListingMapCardProps) {
  const { palette } = useAppTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const promoted = (listing?.promotion_types ?? []).length > 0;
  const highlighted = (listing?.promotion_types ?? []).includes('highlight');

  if (!listing) return null;

  return (
    <View
      key={listing.id}
      collapsable={false}
      pointerEvents="box-none"
      style={[styles.container, { marginBottom: insets.bottom + 96 }]}
    >
          <Pressable
            collapsable={false}
            onPress={() => router.push(`/listing/${listing.id}`)}
            style={[styles.card, highlighted && styles.cardHighlighted]}
          >
            <ResilientImage uri={listing.cover_url} style={styles.image} fallbackSize={30} />

            <View style={styles.details}>
              {promoted ? (
                <View style={styles.promotionBadge}>
                  <Ionicons name="sparkles" size={12} color={palette.primary} />
                  <Text style={styles.promotionText}>Продвигается</Text>
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

            <Pressable hitSlop={10} onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close-circle" size={24} color={palette.inkMuted} />
            </Pressable>
          </Pressable>
    </View>
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
    backgroundColor: palette.surface,
    borderRadius: 16,
    overflow: 'hidden',
    height: 116,
    shadowColor: '#1A1A1A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 10,
  },
  cardHighlighted: {
    borderWidth: 3,
    borderColor: palette.primary,
    shadowColor: palette.primary,
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 14,
  },
  image: {
    width: 116,
    height: '100%',
  },
  details: {
    flex: 1,
    padding: 12,
    justifyContent: 'center',
  },
  promotionBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  promotionText: {
    color: palette.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  price: {
    fontSize: 18,
    fontWeight: 'bold',
    color: palette.primary,
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
    fontWeight: '600',
    color: palette.ink,
    marginBottom: 2,
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
    top: 8,
    right: 8,
    zIndex: 12,
  },
});
