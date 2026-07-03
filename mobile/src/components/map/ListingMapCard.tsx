import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { AnimatePresence, MotiView } from 'moti';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatRating, formatRub } from '@/lib/format';
import { palette } from '@/theme/tokens';
import type { ListingCard } from '@/types/listing';

interface ListingMapCardProps {
  listing: ListingCard | null;
  onClose: () => void;
}

/**
 * Bottom mini-card shown when a price bubble is tapped on the map. Slides up
 * via Moti (AnimatePresence handles the enter/exit animation). Tapping the card
 * navigates to the listing detail; the close button dismisses it.
 *
 * Positioned above the tab bar and bottom "search here" pill so it never
 * overlaps them.
 */
export function ListingMapCard({ listing, onClose }: ListingMapCardProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <AnimatePresence>
      {listing ? (
        <MotiView
          from={{ opacity: 0, translateY: 150 }}
          animate={{ opacity: 1, translateY: 0 }}
          exit={{ opacity: 0, translateY: 150 }}
          transition={{
            type: 'spring',
            damping: 20,
            stiffness: 140,
            mass: 0.8,
          }}
          pointerEvents="box-none"
          style={[styles.container, { marginBottom: insets.bottom + 96 }]}
        >
          <Pressable
            onPress={() => router.push(`/listing/${listing.id}`)}
            style={styles.card}
          >
            <Image
              source={listing.cover_url}
              style={styles.image}
              contentFit="cover"
              transition={200}
            />

            <View style={styles.details}>
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
                {listing.rooms}-комн. · {listing.area} м²
              </Text>

              <Text numberOfLines={1} style={styles.address}>
                {listing.address}
              </Text>
            </View>

            <Pressable hitSlop={10} onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close-circle" size={24} color="rgba(0,0,0,0.35)" />
            </Pressable>
          </Pressable>
        </MotiView>
      ) : null}
    </AnimatePresence>
  );
}

const styles = StyleSheet.create({
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
    shadowColor: palette.ink,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 10,
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
  closeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 12,
  },
});
