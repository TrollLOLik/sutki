import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AnimatePresence, MotiView } from 'moti';
import * as Location from 'expo-location';
import {
  ClusteredYamap,
  Marker,
  Search,
  Animation,
  type InitialRegion,
  type Point,
} from 'react-native-yamap-plus';

import { ListingMapCard } from '@/components/map/ListingMapCard';
import { TAB_BAR_HEIGHT } from '@/components/CustomTabBar';
import { MapSearchOverlay } from '@/components/map/MapSearchOverlay';
import { PriceBubble } from '@/components/map/PriceBubble';
import { useListings, filtersToListParams } from '@/lib/api/listings';
import { useBboxAutoReload } from '@/hooks/useBboxAutoReload';
import { countActiveFilters, useFiltersStore } from '@/store/filters';
import { useSessionStore } from '@/store/session';
import { palette } from '@/theme/tokens';
import { env } from '@/lib/env';
import type { ListingCard } from '@/types/listing';

// Fallback center (Magnitogorsk) — only used when GPS, city and IP geolocation
// are all unavailable. Keeps the camera off the "whole world" default in every
// case, even before the async initial-center resolution completes.
const DEFAULT_CENTER = { lat: 53.4129, lon: 59.0019 };
const DEFAULT_ZOOM = 12;
const GPS_TIMEOUT_MS = 3000;

/**
 * Resolves the camera center on mount using a strict priority order:
 *   1. GPS coordinates (only if permission was already granted — we never prompt
 *      on mount), capped by a 3s timeout so it never blocks the start camera;
 *   2. the active search city (filters.city) or the user's profile city;
 *   3. the city detected from the client IP via the backend iplocate proxy;
 *   4. the hardcoded default (Magnitogorsk).
 *
 * Returns a full InitialRegion so it can feed <ClusteredYamap initialRegion>.
 */
async function resolveInitialCenter(
  hasLocationPermission: boolean,
  city: string | null,
): Promise<InitialRegion> {
  // 1. GPS (no prompt — only if already granted).
  if (hasLocationPermission) {
    try {
      const coords = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), GPS_TIMEOUT_MS)),
      ]);
      if (coords?.coords) {
        return { lat: coords.coords.latitude, lon: coords.coords.longitude, zoom: 13 };
      }
    } catch {
      // fall through to city / iplocate
    }
  }

  // 2 & 3. City → geocode, then IP geolocation → geocode.
  const cityName = (city ?? '').trim();
  if (cityName.length > 0) {
    const point = await safeGeocode(cityName);
    if (point) return { lat: point.lat, lon: point.lon, zoom: DEFAULT_ZOOM };
  } else {
    const ipCity = await detectCityByIP();
    if (ipCity) {
      const point = await safeGeocode(ipCity);
      if (point) return { lat: point.lat, lon: point.lon, zoom: DEFAULT_ZOOM };
    }
  }

  // 4. Hardcoded fallback.
  return { ...DEFAULT_CENTER, zoom: DEFAULT_ZOOM };
}

/** geocodeAddress wrapper that never throws (returns null on any failure). */
async function safeGeocode(address: string): Promise<Point | null> {
  try {
    const point = await Search.geocodeAddress(address);
    if (point && point.lat != null && point.lon != null) {
      return { lat: point.lat, lon: point.lon };
    }
  } catch (err) {
    console.log('[Map] city geocode error:', err);
  }
  return null;
}

/** City by IP via the backend DaData iplocate proxy. */
async function detectCityByIP(): Promise<string | null> {
  try {
    const res = await fetch(`${env.apiUrl}/api/v1/cities/iplocate`, {
      headers: { Accept: 'application/json' },
    });
    if (res.ok) {
      const data = await res.json();
      const city = data?.location?.data?.city;
      if (typeof city === 'string' && city.length > 0) return city;
    }
  } catch (err) {
    console.log('[Map] iplocate error:', err);
  }
  return null;
}

export default function MapScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<any>(null);
  const user = useSessionStore((state) => state.user);
  const filters = useFiltersStore();

  // ── Loading strategy ──────────────────────────────────────────────────────
  // Mount = city-list (no bbox — camera not yet settled). After "search in this
  // area" (stage 2) we switch to bbox-mode. `bbox` gates the query below.
  const [bbox, setBbox] = useState<string | undefined>(undefined);
  const [currentZoom, setCurrentZoom] = useState<number>(DEFAULT_ZOOM);

  const listParams = useMemo(() => {
    const params = filtersToListParams(filters, '', { limit: bbox ? 200 : 100 });
    if (bbox) params.bbox = bbox;
    return params;
  }, [filters, bbox]);

  // Disable network fetching when zoomed out past city level (zoom < 10)
  const isQueryEnabled = bbox == null || currentZoom >= 10;
  const { data, isLoading, isRefetching, isFetching } = useListings(listParams, {
    enabled: isQueryEnabled,
  });
  const listings = data?.items ?? [];

  // ── Initial camera ─────────────────────────────────────────────────────────
  // Compute once on mount. Start from the hardcoded default so the very first
  // paint shows a city (not the globe), then refine when resolution completes.
  const [initialRegion, setInitialRegion] = useState<InitialRegion>({
    ...DEFAULT_CENTER,
    zoom: DEFAULT_ZOOM,
  });
  // Guards against refitting after the very first successful load and against
  // treating our own programmatic moves as user gestures (used in stage 2).
  const initialFitDone = useRef(false);
  const isProgrammatic = useRef(false);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { status } = await Location.getForegroundPermissionsAsync();
      const center = await resolveInitialCenter(
        status === 'granted',
        filters.city ?? user?.city ?? null,
      );
      if (cancelled) return;
      setInitialRegion(center);
    })();
    return () => {
      cancelled = true;
    };
    // Run exactly once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Center camera when mapReady is true or initialRegion updates
  useEffect(() => {
    if (mapReady && mapRef.current) {
      isProgrammatic.current = true;
      mapRef.current.setCenter(
        { lat: initialRegion.lat, lon: initialRegion.lon },
        initialRegion.zoom ?? DEFAULT_ZOOM,
        0,
        0,
        0,
        'none'
      );
      // Wait a moment for layout to settle, then capture initial bbox
      setTimeout(() => {
        if (mapRef.current) {
          mapRef.current.getVisibleRegion((region: any) => {
            if (region?.bottomLeft && region?.topRight) {
              setBbox(`${region.bottomLeft.lon},${region.bottomLeft.lat},${region.topRight.lon},${region.topRight.lat}`);
            }
          });
        }
        isProgrammatic.current = false;
      }, 300);
    }
  }, [mapReady, initialRegion]);

  // ── Fit to loaded markers (one-shot) ───────────────────────────────────────
  useEffect(() => {
    if (initialFitDone.current) return;
    if (!mapReady || !mapRef.current || listings.length === 0) return;

    const points = listings
      .filter((l) => l.lat != null && l.lng != null)
      .map((l) => ({ lat: l.lat as number, lon: l.lng as number }));
    if (points.length === 0) return;

    initialFitDone.current = true;
    isProgrammatic.current = true;
    if (points.length === 1) {
      mapRef.current.setCenter(points[0], 13, 0, 0, 0.6, Animation.SMOOTH);
    } else {
      mapRef.current.fitMarkers(points, 0.7, Animation.SMOOTH);
    }
    // Re-enable gesture detection and update bbox after the animation finishes
    setTimeout(() => {
      if (mapRef.current) {
        mapRef.current.getVisibleRegion((region: any) => {
          if (region?.bottomLeft && region?.topRight) {
            setBbox(`${region.bottomLeft.lon},${region.bottomLeft.lat},${region.topRight.lon},${region.topRight.lat}`);
          }
        });
      }
      isProgrammatic.current = false;
    }, 900);
  }, [listings, mapReady]);

  // ── Selection (mini-card) ──────────────────────────────────────────────────
  const [selectedListing, setSelectedListing] = useState<ListingCard | null>(null);

  // ── Auto-reload by visible region ──────────────────────────────────────────
  const [isDragging, setIsDragging] = useState(false);

  const handleReload = useCallback((newBbox: string) => {
    setSelectedListing(null);
    setBbox(newBbox);
  }, []);

  const { triggerReload } = useBboxAutoReload({
    onReload: handleReload,
    isProgrammaticRef: isProgrammatic,
    debounceMs: 600,
  });

  const handleCameraPositionChange = useCallback((event: any) => {
    if (isProgrammatic.current) return;
    if (event?.nativeEvent?.reason === 'GESTURES') {
      setIsDragging(true);
    }
  }, []);

  const onCameraPositionChangeEnd = useCallback(
    (event: any) => {
      setIsDragging(false);

      const zoom = event?.nativeEvent?.zoom;
      if (zoom != null) {
        setCurrentZoom(zoom);
      }

      if (isProgrammatic.current) {
        return;
      }

      if (!mapRef.current) return;

      mapRef.current.getVisibleRegion((region: any) => {
        if (region) {
          triggerReload(region, zoom ?? currentZoom, event?.nativeEvent?.reason);
        }
      });
    },
    [triggerReload, currentZoom],
  );

  const renderMarker = useCallback(
    ({ point, data }: { point: Point; data: ListingCard }) => {
      const isSelected = selectedListing?.id === data.id;
      return (
        <Marker
          key={data.id}
          point={point}
          onPress={() => setSelectedListing(data)}
        >
          <PriceBubble price={data.price} selected={isSelected} />
        </Marker>
      );
    },
    [selectedListing],
  );

  const clusteredMarkers = useMemo(
    () =>
      listings
        .filter((l) => l.lat != null && l.lng != null)
        .map((l) => ({ point: { lat: l.lat as number, lon: l.lng as number }, data: l })),
    [listings],
  );

  // ── Search overlay (stage 3) ─────────────────────────────────────────────────
  const [searchVisible, setSearchVisible] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const activeFilters = countActiveFilters(filters);

  /** Helper to safely move camera and set isProgrammatic guard. */
  const moveCamera = useCallback(
    (center: Point, zoom: number, duration = 0.6) => {
      if (!mapRef.current) return;
      isProgrammatic.current = true;
      mapRef.current.setCenter(center, zoom, 0, 0, duration, Animation.SMOOTH);
      setTimeout(() => {
        if (mapRef.current) {
          mapRef.current.getVisibleRegion((region: any) => {
            if (region?.bottomLeft && region?.topRight) {
              setBbox(`${region.bottomLeft.lon},${region.bottomLeft.lat},${region.topRight.lon},${region.topRight.lat}`);
            }
          });
        }
        isProgrammatic.current = false;
      }, duration * 1000 + 300);
    },
    [],
  );

  const handleSearchSelectCity = useCallback(
    (city: string) => {
      filters.setFilters({ city });
      // Clear bbox so the next fetch is city-based, not region-based.
      setBbox(undefined);
      setSearchVisible(false);
      safeGeocode(city).then((point) => {
        if (point) moveCamera(point, DEFAULT_ZOOM);
      });
    },
    [filters, moveCamera],
  );

  const handleSearchSelectAddress = useCallback(
    (city: string, lat: number, lon: number) => {
      filters.setFilters({ city: null });
      moveCamera({ lat, lon }, 15);
    },
    [filters, moveCamera],
  );

  const handleSearchSubmitText = useCallback(
    (text: string) => {
      setSearchVisible(false);
      // Try geocoding the raw text (could be city or address).
      safeGeocode(text).then((point) => {
        if (point) moveCamera(point, text.length < 15 ? DEFAULT_ZOOM : 14);
      });
    },
    [moveCamera],
  );

  /** FAB "locate me" — requests GPS permission on tap, centers camera. */
  const handleLocateUser = useCallback(async () => {
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
        moveCamera(
          { lat: location.coords.latitude, lon: location.coords.longitude },
          14,
          0.8,
        );
      }
    } catch {
      // ignore — location may be unavailable
    } finally {
      setIsLocating(false);
    }
  }, [moveCamera]);

  /** Label shown inside the search bar (current city or placeholder). */
  const searchLabel = filters.city ?? 'Город или адрес';


  return (
    <View style={styles.container}>
      <ClusteredYamap
        ref={(ref) => {
          mapRef.current = ref;
          if (ref && !mapReady) {
            setMapReady(true);
          }
        }}
        initialRegion={initialRegion}
        showUserPosition
        clusteredMarkers={clusteredMarkers}
        renderMarker={renderMarker}
        clusterColor={palette.primary}
        clusterTextColor="#FFFFFF"
        onCameraPositionChange={handleCameraPositionChange}
        onCameraPositionChangeEnd={onCameraPositionChangeEnd}
        style={[styles.map, { paddingBottom: insets.bottom + TAB_BAR_HEIGHT }]}
      />

      {/* Top bar: search row + count chip */}
      <View pointerEvents="box-none" style={[styles.topContainer, { paddingTop: insets.top + 10 }]}>
        <View style={styles.searchRow}>
          {/* Search bar — opens MapSearchOverlay */}
          <Pressable
            onPress={() => setSearchVisible(true)}
            style={styles.searchBar}
          >
            <Ionicons name="search" size={20} color={palette.inkMuted} />
            <Text
              numberOfLines={1}
              style={[
                styles.searchBarText,
                filters.city ? styles.searchBarTextActive : styles.searchBarTextMuted,
              ]}
            >
              {searchLabel}
            </Text>
            {filters.city ? (
              <Pressable
                hitSlop={8}
                onPress={(e) => {
                  e.stopPropagation();
                  filters.setFilters({ city: null });
                }}
              >
                <Ionicons name="close-circle" size={18} color={palette.inkMuted} />
              </Pressable>
            ) : null}
          </Pressable>

          {/* Filters button */}
          <Pressable
            onPress={() => router.push('/filters')}
            style={styles.filtersButton}
          >
            <Ionicons name="options-outline" size={22} color={palette.primary} />
            {activeFilters > 0 ? (
              <View style={styles.filtersBadge}>
                <Text style={styles.filtersBadgeText}>{activeFilters}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>

        {/* Count chip */}
        <View style={styles.countChip}>
          {isLoading || isFetching ? (
            <ActivityIndicator size="small" color={palette.primary} style={{ marginRight: 4 }} />
          ) : (
            <Ionicons name="map" size={14} color={palette.primary} style={{ marginRight: 4 }} />
          )}
          <Text style={styles.countChipText}>
            {isLoading || isFetching
              ? 'Загрузка…'
              : `Найдено: ${listings.length}`}
          </Text>
        </View>
      </View>

      {/* FAB "locate me" */}
      <View pointerEvents="box-none" style={[styles.fabContainer, { bottom: insets.bottom + TAB_BAR_HEIGHT + 16 }]}>
        <Pressable onPress={handleLocateUser} style={styles.fab} disabled={isLocating}>
          {isLocating ? (
            <ActivityIndicator size="small" color={palette.primary} />
          ) : (
            <Ionicons name="navigate-outline" size={24} color={palette.primary} />
          )}
        </Pressable>
      </View>

      {/* Dynamic Map Warning Overlays (Zoom out, limit reach, empty results) */}
      <AnimatePresence>
        {bbox != null && !isDragging && (() => {
          if (currentZoom < 10) {
            return (
              <MotiView
                key="zoom-warning"
                from={{ opacity: 0, translateY: 15 }}
                animate={{ opacity: 1, translateY: 0 }}
                exit={{ opacity: 0, translateY: 15 }}
                transition={{ type: 'timing', duration: 180 }}
                pointerEvents="box-none"
                style={[styles.emptyContainer, { bottom: insets.bottom + TAB_BAR_HEIGHT + 16 }]}
              >
                <View style={styles.emptyBar}>
                  <Text style={styles.emptyText}>
                    Приблизьте карту, чтобы увидеть объявления
                  </Text>
                </View>
              </MotiView>
            );
          }
          if (!isLoading && listings.length === 0) {
            return (
              <MotiView
                key="empty-warning"
                from={{ opacity: 0, translateY: 15 }}
                animate={{ opacity: 1, translateY: 0 }}
                exit={{ opacity: 0, translateY: 15 }}
                transition={{ type: 'timing', duration: 180 }}
                pointerEvents="box-none"
                style={[styles.emptyContainer, { bottom: insets.bottom + TAB_BAR_HEIGHT + 16 }]}
              >
                <View style={styles.emptyBar}>
                  <Text style={styles.emptyText}>
                    В этой области нет объявлений — отдалите карту или измените фильтры
                  </Text>
                </View>
              </MotiView>
            );
          }
          if (!isLoading && listings.length >= 200) {
            return (
              <MotiView
                key="limit-warning"
                from={{ opacity: 0, translateY: 15 }}
                animate={{ opacity: 1, translateY: 0 }}
                exit={{ opacity: 0, translateY: 15 }}
                transition={{ type: 'timing', duration: 180 }}
                pointerEvents="box-none"
                style={[styles.emptyContainer, { bottom: insets.bottom + TAB_BAR_HEIGHT + 16 }]}
              >
                <View style={styles.emptyBar}>
                  <Text style={styles.emptyText}>
                    Показано 200+ объявлений. Приблизьте карту для точного поиска
                  </Text>
                </View>
              </MotiView>
            );
          }
          return null;
        })()}
      </AnimatePresence>

      {/* Bottom mini-card on pin tap */}
      <ListingMapCard
        listing={selectedListing}
        onClose={() => setSelectedListing(null)}
      />

      {/* City/address search overlay */}
      <MapSearchOverlay
        visible={searchVisible}
        onClose={() => setSearchVisible(false)}
        onSelectCity={handleSearchSelectCity}
        onSelectAddress={handleSearchSelectAddress}
        onSubmitText={handleSearchSubmitText}
      />
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
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 24,
    height: 48,
    paddingHorizontal: 12,
    marginRight: 10,
    shadowColor: palette.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  searchBarText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
    marginRight: 8,
  },
  searchBarTextActive: {
    color: palette.ink,
  },
  searchBarTextMuted: {
    color: palette.inkMuted,
  },
  filtersButton: {
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 24,
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: palette.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  filtersBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: palette.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  filtersBadgeText: {
    color: 'white',
    fontSize: 11,
    fontWeight: 'bold',
  },
  countChip: {
    flexDirection: 'row',
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: palette.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  countChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: palette.ink,
  },
  fabContainer: {
    position: 'absolute',
    right: 16,
    alignItems: 'center',
  },
  fab: {
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 24,
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: palette.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  topContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
  },
  topInfoBar: {
    flexDirection: 'row',
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignItems: 'center',
    shadowColor: palette.ink,
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
  searchHereContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignItems: 'center',
  },
  searchHerePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.primary,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    shadowColor: palette.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  searchHereText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
  },
  emptyContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignItems: 'center',
  },
  emptyBar: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: palette.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
    color: palette.inkSecondary,
  },
});
