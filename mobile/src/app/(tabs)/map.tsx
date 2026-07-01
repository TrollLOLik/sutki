import React, { useRef, useState, useEffect, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Location from 'expo-location';
import { ClusteredYamap, Marker, Search } from 'react-native-yamap-plus';

import { useListings, filtersToListParams } from '@/lib/api/listings';
import { useFiltersStore } from '@/store/filters';
import { useSessionStore } from '@/store/session';
import { formatRub, formatRating } from '@/lib/format';
import { palette } from '@/theme/tokens';
import type { ListingCard } from '@/types/listing';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function MapScreen() {
  const router = useRouter();
  const mapRef = useRef<any>(null);
  const user = useSessionStore((state) => state.user);
  
  // Local state
  const [bbox, setBbox] = useState<string | undefined>(undefined);
  const [selectedListing, setSelectedListing] = useState<ListingCard | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  // Active filters and query from index page
  const filters = useFiltersStore();
  
  // Construct search query params, merged with current bounding box
  const listParams = useMemo(() => {
    const params = filtersToListParams(filters, '', { limit: 100 });
    if (bbox) {
      params.bbox = bbox;
    }
    return params;
  }, [filters, bbox]);

  // Fetch listings within current bbox and filters
  const { data, isLoading, isRefetching } = useListings(listParams, {
    enabled: bbox !== undefined,
  });

  const listings = data?.items ?? [];

  // Center on Magnitogorsk/Moscow by default if no user position is fetched yet
  const defaultCenter = { lat: 53.4129, lon: 59.0019 }; // Magnitogorsk

  useEffect(() => {
    if (mapRef.current && mapReady) {
      if (user?.city && user.city.trim().length > 0) {
        Search.geocodeAddress(user.city.trim())
          .then((point) => {
            if (point && point.lat != null && point.lon != null) {
              if (mapRef.current) {
                mapRef.current.setCenter({ lat: point.lat, lon: point.lon }, 12, 0, 0, 0, 'none');
                setTimeout(() => {
                  updateBbox();
                }, 500);
              }
            } else {
              fallbackCenter();
            }
          })
          .catch((err) => {
            console.log('City geocoding error:', err);
            fallbackCenter();
          });
      } else {
        fallbackCenter();
      }
    }
  }, [user?.city, mapReady]);

  const fallbackCenter = () => {
    if (mapRef.current) {
      mapRef.current.setCenter(defaultCenter, 12, 0, 0, 0, 'none');
      setTimeout(() => {
        updateBbox();
      }, 500);
    }
  };

  const updateBbox = () => {
    if (!mapRef.current) return;
    try {
      mapRef.current.getVisibleRegion((region: any) => {
        if (region?.bottomLeft && region?.topRight) {
          const newBbox = `${region.bottomLeft.lon},${region.bottomLeft.lat},${region.topRight.lon},${region.topRight.lat}`;
          setBbox(newBbox);
        }
      });
    } catch (e) {
      console.log('Error getting visible region:', e);
    }
  };

  const handleCameraPositionChangeEnd = () => {
    updateBbox();
  };

  // Request permissions dynamically on FAB tap
  const handleLocateUser = async () => {
    setIsLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setIsLocating(false);
        return;
      }
      
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      if (mapRef.current && location.coords) {
        mapRef.current.setCenter(
          { lat: location.coords.latitude, lon: location.coords.longitude },
          14, // Zoom in
          0,
          0,
          0.8, // Duration in seconds
          'smooth'
        );
        // Bbox will update automatically at the end of camera animation
      }
    } catch (e) {
      console.log('Locating error:', e);
    } finally {
      setIsLocating(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Fullscreen Interactive Yandex Map with Native Clusterization */}
      <ClusteredYamap
        ref={(ref) => {
          mapRef.current = ref;
          if (ref && !mapReady) {
            setMapReady(true);
          }
        }}
        showUserPosition={true}
        onCameraPositionChangeEnd={handleCameraPositionChangeEnd}
        style={styles.map}
      >
        {listings.map((item) => {
          if (item.lat == null || item.lng == null) return null;
          const isSelected = selectedListing?.id === item.id;
          return (
            <Marker
              key={item.id}
              point={{ lat: item.lat, lon: item.lng }}
              onPress={() => setSelectedListing(item)}
            >
              <View style={[styles.bubble, isSelected && styles.bubbleSelected]}>
                <Text style={[styles.bubbleText, isSelected && styles.bubbleTextSelected]}>
                  {formatRub(item.price)}
                </Text>
              </View>
            </Marker>
          );
        })}
      </ClusteredYamap>

      {/* Top Glassmorphic Info Bar */}
      <SafeAreaView edges={['top']} style={styles.topContainer}>
        <View style={styles.topInfoBar}>
          <Ionicons name="map" size={20} color="#FF5A1F" style={{ marginRight: 8 }} />
          <Text style={styles.topInfoText}>
            {isLoading || isRefetching ? 'Обновление...' : `Найдено вариантов: ${listings.length}`}
          </Text>
          {(isLoading || isRefetching) && (
            <ActivityIndicator size="small" color="#FF5A1F" style={{ marginLeft: 8 }} />
          )}
        </View>
      </SafeAreaView>

      {/* FABs (Locate Me) */}
      <View style={[styles.fabContainer, selectedListing != null && { bottom: 180 }]}>
        <Pressable
          onPress={handleLocateUser}
          style={styles.fab}
          disabled={isLocating}
        >
          {isLocating ? (
            <ActivityIndicator size="small" color={palette.ink} />
          ) : (
            <Ionicons name="navigate-outline" size={24} color={palette.ink} />
          )}
        </Pressable>
      </View>

      {/* Bottom selected card overlay */}
      {selectedListing && (
        <View style={styles.cardContainer}>
          <Pressable
            onPress={() => router.push(`/listing/${selectedListing.id}`)}
            style={styles.listingCard}
          >
            <Image
              source={selectedListing.cover_url}
              style={styles.cardImage}
              contentFit="cover"
              transition={200}
            />
            
            <View style={styles.cardDetails}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardPrice}>{formatRub(selectedListing.price)}</Text>
                
                {selectedListing.rating > 0 && (
                  <View style={styles.ratingRow}>
                    <Ionicons name="star" size={14} color="#FFB000" style={{ marginRight: 2 }} />
                    <Text style={styles.ratingText}>{formatRating(selectedListing.rating)}</Text>
                  </View>
                )}
              </View>

              <Text numberOfLines={1} style={styles.cardTitle}>
                {selectedListing.rooms}-комнатная • {selectedListing.area} м²
              </Text>
              
              <Text numberOfLines={1} style={styles.cardAddress}>
                {selectedListing.address}
              </Text>
            </View>

            {/* Close card button */}
            <Pressable
              hitSlop={8}
              onPress={() => setSelectedListing(null)}
              style={styles.closeCardButton}
            >
              <Ionicons name="close-circle" size={24} color="rgba(0,0,0,0.4)" />
            </Pressable>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.surface,
  },
  map: {
    flex: 1,
  },
  topContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 10,
    pointerEvents: 'box-none',
  },
  topInfoBar: {
    flexDirection: 'row',
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  topInfoText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: palette.ink,
  },
  fabContainer: {
    position: 'absolute',
    right: 16,
    bottom: 30,
    zIndex: 5,
  },
  fab: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  cardContainer: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    zIndex: 10,
  },
  listingCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 20,
    overflow: 'hidden',
    height: 120,
    width: SCREEN_WIDTH - 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 10,
  },
  cardImage: {
    width: 120,
    height: '100%',
  },
  cardDetails: {
    flex: 1,
    padding: 12,
    justifyContent: 'center',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  cardPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FF5A1F',
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
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.ink,
    marginBottom: 2,
  },
  cardAddress: {
    fontSize: 12,
    color: palette.inkSecondary,
  },
  closeCardButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 12,
  },
  bubble: {
    backgroundColor: '#FF5A1F',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'white',
    shadowColor: '#FF5A1F',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  bubbleSelected: {
    backgroundColor: '#fff',
    borderColor: '#FF5A1F',
    shadowColor: '#000',
  },
  bubbleText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  bubbleTextSelected: {
    color: '#FF5A1F',
  },
});
