import { useRef, useEffect, useCallback } from 'react';

interface Point {
  lat: number;
  lng: number;
}

interface VisibleRegion {
  bottomLeft: { lat: number; lon: number };
  topRight: { lat: number; lon: number };
}

interface BboxAutoReloadParams {
  onReload: (bbox: string) => void;
  isProgrammaticRef: React.RefObject<boolean>;
  debounceMs?: number;
}

function getBboxPrecision(zoom: number): number {
  if (zoom < 12) return 2;
  if (zoom < 15) return 3;
  return 4;
}

function roundTo(num: number, precision: number): number {
  const factor = Math.pow(10, precision);
  return Math.round(num * factor) / factor;
}

export function useBboxAutoReload({
  onReload,
  isProgrammaticRef,
  debounceMs = 600,
}: BboxAutoReloadParams) {
  const timerRef = useRef<any>(null);
  
  // Keep track of the last loaded viewport center and zoom to threshold updates
  const lastCenterRef = useRef<Point | null>(null);
  const lastZoomRef = useRef<number | null>(null);

  // Clear debounce timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const triggerReload = useCallback(
    (region: VisibleRegion, zoom: number, reason?: string) => {
      // 1. Guard against programmatic transitions (FAB locate, fitBounds, autocomplete select)
      if (isProgrammaticRef.current) return;

      // 2. Extra guard on gesture reason (reason must be GESTURES if present, else fallback)
      if (reason !== undefined && reason !== 'GESTURES') return;

      if (!region?.bottomLeft || !region?.topRight) return;

      // Clear any pending debounced requests
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      // 3. Set debounce timer
      timerRef.current = setTimeout(() => {
        const bottomLeft = region.bottomLeft;
        const topRight = region.topRight;

        const centerLng = (bottomLeft.lon + topRight.lon) / 2;
        const centerLat = (bottomLeft.lat + topRight.lat) / 2;
        const width = Math.abs(topRight.lon - bottomLeft.lon);
        const height = Math.abs(topRight.lat - bottomLeft.lat);

        let shouldLoad = false;

        if (lastCenterRef.current === null || lastZoomRef.current === null) {
          shouldLoad = true;
        } else {
          // Check if zoom level changed significantly (rounded change)
          const zoomChanged = Math.round(zoom) !== Math.round(lastZoomRef.current);
          
          // Check if center moved more than 30% of current viewport width/height
          const dx = Math.abs(centerLng - lastCenterRef.current.lng);
          const dy = Math.abs(centerLat - lastCenterRef.current.lat);
          const movedSignificantly = dx > width * 0.3 || dy > height * 0.3;

          shouldLoad = zoomChanged || movedSignificantly;
        }

        if (shouldLoad) {
          // 4. Grid deduplication with dynamic precision based on zoom
          const precision = getBboxPrecision(zoom);
          const minLng = roundTo(bottomLeft.lon, precision);
          const minLat = roundTo(bottomLeft.lat, precision);
          const maxLng = roundTo(topRight.lon, precision);
          const maxLat = roundTo(topRight.lat, precision);

          const roundedBbox = `${minLng},${minLat},${maxLng},${maxLat}`;

          onReload(roundedBbox);

          lastCenterRef.current = { lat: centerLat, lng: centerLng };
          lastZoomRef.current = zoom;
        }
      }, debounceMs);
    },
    [onReload, isProgrammaticRef, debounceMs]
  );

  return { triggerReload };
}
