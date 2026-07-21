import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, useWindowDimensions } from 'react-native';
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
import {
  getTabBarBottomOffset,
  getTabSlotCenterX,
  TAB_BAR_HEIGHT,
} from '@/components/CustomTabBar';
import { MapSearchOverlay } from '@/components/map/MapSearchOverlay';
import { PriceBubble } from '@/components/map/PriceBubble';
import { CityClusterBubble } from '@/components/map/CityClusterBubble';
import { useListings, useMapClusters, filtersToListParams, type MapCluster } from '@/lib/api/listings';
import { useFavoriteIds } from '@/lib/api/favorites';
import { useViewedListingIds } from '@/lib/api/viewed-listings';
import { useBboxAutoReload } from '@/hooks/useBboxAutoReload';
import { countActiveFilters, useFiltersStore } from '@/store/filters';
import { useSessionStore } from '@/store/session';
import { useAppTheme } from '@/theme/useAppTheme';
import type { Palette } from '@/theme/tokens';
import { env } from '@/lib/env';
import type { ListingCard } from '@/types/listing';

// Fallback center (Magnitogorsk) — only used when GPS, city and IP geolocation
// are all unavailable. Keeps the camera off the "whole world" default in every
// case, even before the async initial-center resolution completes.
const DEFAULT_CENTER = { lat: 53.4129, lon: 59.0019 };
const DEFAULT_ZOOM = 12;
const GPS_TIMEOUT_MS = 3000;
const CITY_CLUSTER_ZOOM = 10;
const LOCATION_BUTTON_SIZE = 52;
const PROFILE_TAB_INDEX = 4;
const USER_LOCATION_ICON = {
  uri: 'data:image/png;base64,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',
};

function pluralize(count: number, one: string, few: string, many: string) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

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
  const { palette, isDark } = useAppTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const mapRef = useRef<any>(null);
  const user = useSessionStore((state) => state.user);
  const { data: favoriteIds } = useFavoriteIds();
  const { data: viewedListingIds } = useViewedListingIds();
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

  // At regional zoom the lightweight city aggregates replace individual
  // listings, so there is no reason to keep the heavier bbox query running.
  const showCityClusters = currentZoom < CITY_CLUSTER_ZOOM;
  const isQueryEnabled = !showCityClusters;
  const { data, isLoading, isRefetching, isFetching } = useListings(listParams, {
    enabled: isQueryEnabled,
  });
  const listings = data?.items ?? [];
  // Keep aggregates warm before the user zooms out. This removes the blank
  // frame that previously appeared while switching map layers.
  const mapClusters = useMapClusters(true);
  const cityClusters = mapClusters.data?.items ?? [];
  const cityClusterTotal = useMemo(
    () => cityClusters.reduce((total, cluster) => total + cluster.count, 0),
    [cityClusters],
  );
  const isMapContentLoading = showCityClusters
    ? mapClusters.isLoading || mapClusters.isFetching
    : isLoading || isFetching;
  const mapCountLabel = showCityClusters
    ? `${cityClusters.length} ${pluralize(cityClusters.length, 'город', 'города', 'городов')} · ${cityClusterTotal} ${pluralize(cityClusterTotal, 'объявление', 'объявления', 'объявлений')}`
    : `Найдено: ${listings.length}`;



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
  const [selectedListingId, setSelectedListingId] = useState<number | null>(null);
  const selectionRevision = useRef(0);
  const selectedListing = useMemo(
    () => listings.find((item) => item.id === selectedListingId) ?? null,
    [listings, selectedListingId],
  );

  const selectListing = useCallback((id: number) => {
    const revision = ++selectionRevision.current;
    setSelectedListingId(null);
    requestAnimationFrame(() => {
      if (selectionRevision.current === revision) {
        setSelectedListingId(id);
      }
    });
  }, []);

  const closeSelectedListing = useCallback(() => {
    selectionRevision.current += 1;
    setSelectedListingId(null);
  }, []);

  // ── Auto-reload by visible region ──────────────────────────────────────────
  const [isDragging, setIsDragging] = useState(false);

  const handleReload = useCallback((newBbox: string) => {
    closeSelectedListing();
    setBbox(newBbox);
  }, [closeSelectedListing]);

  const { triggerReload } = useBboxAutoReload({
    onReload: handleReload,
    isProgrammaticRef: isProgrammatic,
    debounceMs: 600,
  });

  const handleCameraPositionChange = useCallback((event: any) => {
    if (isProgrammatic.current) return;
    const camera = event?.nativeEvent ?? event;
    if (camera?.reason === 'GESTURES') {
      setIsDragging(true);
    }
  }, []);

  const onCameraPositionChangeEnd = useCallback(
    (event: any) => {
      setIsDragging(false);

      const camera = event?.nativeEvent ?? event;
      const zoom = Number(camera?.zoom);
      if (Number.isFinite(zoom)) {
        setCurrentZoom(zoom);
      }

      if (isProgrammatic.current) {
        return;
      }

      if (!mapRef.current) return;

      mapRef.current.getVisibleRegion((region: any) => {
        if (region) {
          triggerReload(region, Number.isFinite(zoom) ? zoom : currentZoom, camera?.reason);
        }
      });
    },
    [triggerReload, currentZoom],
  );

  const renderMarker = useCallback(
    ({ point, data }: { point: Point; data: ListingCard }) => {
      const isSelected = selectedListingId === data.id;
      const isOwn = user?.id === data.owner_id;
      return (
        <Marker
          key={data.id}
          point={point}
          onPress={() => selectListing(data.id)}
        >
          <PriceBubble
            price={data.price}
            selected={isSelected}
            promoted={(data.promotion_types ?? []).length > 0}
            highlighted={(data.promotion_types ?? []).includes('highlight')}
            favorite={favoriteIds?.has(data.id) ?? false}
            viewed={!isOwn && (viewedListingIds?.has(data.id) ?? false)}
            own={isOwn}
          />
        </Marker>
      );
    },
    [favoriteIds, selectListing, selectedListingId, user?.id, viewedListingIds],
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
  const tabBarBottomOffset = getTabBarBottomOffset(insets.bottom);
  const locationButtonRight = Math.max(
    8,
    windowWidth - getTabSlotCenterX(windowWidth, PROFILE_TAB_INDEX) - LOCATION_BUTTON_SIZE / 2,
  );

  /** Helper to safely move camera and set isProgrammatic guard. */
  const moveCamera = useCallback(
    (center: Point, zoom: number, duration = 0.6) => {
      if (!mapRef.current) return;
      isProgrammatic.current = true;
      setCurrentZoom(zoom);
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

  const handleCityClusterPress = useCallback((cluster: MapCluster) => {
    filters.setFilters({ city: cluster.city });
    setBbox(undefined);
    closeSelectedListing();
    moveCamera({ lat: cluster.lat, lon: cluster.lng }, 11, 0.7);
  }, [closeSelectedListing, filters, moveCamera]);

  /** Label shown inside the search bar (current city or placeholder). */
  const searchLabel = filters.city ?? 'Город или адрес';

  // ── Warning state ──────────────────────────────────────────────────────────
  const [warningType, setWarningType] = useState<'empty' | 'limit' | null>(null);

  useEffect(() => {
    if (isDragging) {
      setWarningType(null);
      return;
    }

    if (showCityClusters) {
      if (!mapClusters.isLoading && !mapClusters.isFetching && cityClusters.length === 0) {
        setWarningType('empty');
      } else {
        setWarningType(null);
      }
      return;
    }

    if (bbox == null) {
      setWarningType(null);
      return;
    }

    const isFetchingAny = isLoading || isFetching || isRefetching;
    if (!isFetchingAny) {
      if (listings.length === 0) {
        setWarningType('empty');
      } else if (listings.length >= 200) {
        setWarningType('limit');
      } else {
        setWarningType(null);
      }
    } else {
      // Keep the previous content warning during refetch to prevent flickering.
    }
  }, [
    showCityClusters,
    mapClusters.isLoading,
    mapClusters.isFetching,
    cityClusters.length,
    isLoading,
    isFetching,
    isRefetching,
    listings.length,
    bbox,
    isDragging,
  ]);


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
        nightMode={isDark}
        showUserPosition
        userLocationIcon={USER_LOCATION_ICON}
        userLocationIconScale={0.72}
        userLocationAccuracyFillColor="rgba(47, 128, 237, 0.12)"
        userLocationAccuracyStrokeColor="rgba(47, 128, 237, 0.32)"
        userLocationAccuracyStrokeWidth={1}
        clusteredMarkers={showCityClusters ? [] : clusteredMarkers}
        renderMarker={renderMarker}
        clusterColor={palette.primary}
        clusterTextColor="#FFFFFF"
        onCameraPositionChange={handleCameraPositionChange}
        onCameraPositionChangeEnd={onCameraPositionChangeEnd}
        style={[styles.map, { paddingBottom: insets.bottom + TAB_BAR_HEIGHT }]}
      >
        {showCityClusters ? cityClusters.map((cluster) => (
          <Marker
            key={`city-${cluster.city}`}
            point={{ lat: cluster.lat, lon: cluster.lng }}
            onPress={() => handleCityClusterPress(cluster)}
            excludeFromCluster
          >
            <CityClusterBubble count={cluster.count} />
          </Marker>
        )) : null}
      </ClusteredYamap>

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
          {isMapContentLoading ? (
            <ActivityIndicator size="small" color={palette.primary} style={{ marginRight: 4 }} />
          ) : (
            <Ionicons
              name={showCityClusters ? 'business-outline' : 'map-outline'}
              size={14}
              color={palette.primary}
              style={{ marginRight: 4 }}
            />
          )}
          <Text style={styles.countChipText}>
            {isMapContentLoading ? 'Загрузка…' : mapCountLabel}
          </Text>
        </View>
      </View>

      {/* FAB "locate me" */}
      <View
        pointerEvents="box-none"
        style={[
          styles.fabContainer,
          {
            right: locationButtonRight,
            bottom: tabBarBottomOffset + TAB_BAR_HEIGHT + 10,
          },
        ]}
      >
        <Pressable
          onPress={handleLocateUser}
          style={styles.fab}
          disabled={isLocating}
        >
          {isLocating ? (
            <ActivityIndicator size="small" color={palette.primary} />
          ) : (
            <Ionicons name="locate-outline" size={23} color={palette.primary} />
          )}
        </Pressable>
      </View>

      {/* Dynamic Map Warning Overlays (Zoom out, limit reach, empty results) */}
      <AnimatePresence>
        {warningType === 'empty' && (
          <MotiView
            key="empty-warning"
            from={{ translateY: 10, opacity: 0 }}
            animate={{ translateY: 0, opacity: 1 }}
            exit={{ translateY: 5, opacity: 0 }}
            transition={{
              type: 'timing',
              duration: 180,
            }}
            pointerEvents="box-none"
            style={[styles.emptyContainer, { bottom: insets.bottom + TAB_BAR_HEIGHT + 80 }]}
          >
            <View style={styles.emptyBar}>
              <View style={styles.emptyIcon}>
                <Ionicons name="search-outline" size={18} color={palette.primary} />
              </View>
              <Text style={styles.emptyText}>
                В этой области нет объявлений — отдалите карту или измените фильтры
              </Text>
            </View>
          </MotiView>
        )}
        {warningType === 'limit' && (
          <MotiView
            key="limit-warning"
            from={{ translateY: 10, opacity: 0 }}
            animate={{ translateY: 0, opacity: 1 }}
            exit={{ translateY: 5, opacity: 0 }}
            transition={{
              type: 'timing',
              duration: 180,
            }}
            pointerEvents="box-none"
            style={[styles.emptyContainer, { bottom: insets.bottom + TAB_BAR_HEIGHT + 80 }]}
          >
            <View style={styles.emptyBar}>
              <View style={styles.emptyIcon}>
                <Ionicons name="scan-outline" size={18} color={palette.primary} />
              </View>
              <Text style={styles.emptyText}>
                Показано 200+ объявлений. Приблизьте карту для точного поиска
              </Text>
            </View>
          </MotiView>
        )}
      </AnimatePresence>

      {/* Bottom mini-card on pin tap */}
      <ListingMapCard
        key={selectedListing?.id ?? 'no-listing'}
        listing={selectedListing}
        onClose={closeSelectedListing}
        isFavorite={selectedListing ? favoriteIds?.has(selectedListing.id) ?? false : false}
        isOwn={selectedListing ? user?.id === selectedListing.owner_id : false}
        isViewed={
          selectedListing
            ? user?.id !== selectedListing.owner_id && (viewedListingIds?.has(selectedListing.id) ?? false)
            : false
        }
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

const makeStyles = (palette: Palette) =>
  StyleSheet.create({
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
    shadowColor: '#1A1A1A',
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
    shadowColor: '#1A1A1A',
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
    backgroundColor: palette.overlaySurface,
    borderWidth: 1,
    borderColor: palette.line,
    minHeight: 32,
    paddingVertical: 6,
    paddingHorizontal: 13,
    borderRadius: 17,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#1A1A1A',
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
    alignItems: 'center',
  },
  fab: {
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: LOCATION_BUTTON_SIZE / 2,
    width: LOCATION_BUTTON_SIZE,
    height: LOCATION_BUTTON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1A1A1A',
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
    backgroundColor: palette.overlaySurface,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignItems: 'center',
    shadowColor: '#1A1A1A',
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
    backgroundColor: palette.overlaySurface,
    borderWidth: 1,
    borderColor: palette.line,
    paddingVertical: 10,
    paddingHorizontal: 11,
    borderRadius: 22,
    alignSelf: 'stretch',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    shadowColor: '#1A1A1A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
    elevation: 6,
  },
  emptyIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.primaryLight,
  },
  emptyText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
    color: palette.ink,
  },
});
