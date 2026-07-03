import React, { useState, useRef, useEffect, useMemo } from 'react';
import { StyleSheet, View, PanResponder } from 'react-native';

import { useAppTheme } from '@/theme/useAppTheme';
import type { Palette } from '@/theme/tokens';

interface RangeSliderProps {
  min: number;
  max: number;
  valueMin: number;
  valueMax: number;
  onValueChange: (range: { min: number; max: number }) => void;
  onSlidingComplete?: (range: { min: number; max: number }) => void;
  step?: number;
  minDistance?: number;
}

export function RangeSlider({
  min,
  max,
  valueMin,
  valueMax,
  onValueChange,
  onSlidingComplete,
  step = 100,
  minDistance = 500,
}: RangeSliderProps) {
  const { palette } = useAppTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const [trackWidth, setTrackWidth] = useState(0);
  const trackWidthRef = useRef(0);

  // Synchronous tracking of latest values for the PanResponder thread
  const latestValueMinRef = useRef(valueMin);
  const latestValueMaxRef = useRef(valueMax);

  useEffect(() => {
    latestValueMinRef.current = valueMin;
  }, [valueMin]);

  useEffect(() => {
    latestValueMaxRef.current = valueMax;
  }, [valueMax]);

  const onValueChangeRef = useRef(onValueChange);
  const onSlidingCompleteRef = useRef(onSlidingComplete);

  useEffect(() => {
    onValueChangeRef.current = onValueChange;
  }, [onValueChange]);

  useEffect(() => {
    onSlidingCompleteRef.current = onSlidingComplete;
  }, [onSlidingComplete]);

  // Keep latest values in ref to avoid capturing stale values in PanResponder closures
  const stateRef = useRef({ min, max, valueMin, valueMax, trackWidth, step, minDistance });
  useEffect(() => {
    stateRef.current = { min, max, valueMin, valueMax, trackWidth, step, minDistance };
  }, [min, max, valueMin, valueMax, trackWidth, step, minDistance]);

  const valueToPx = (val: number) => {
    if (stateRef.current.max === stateRef.current.min || trackWidthRef.current === 0) return 0;
    const ratio = (val - stateRef.current.min) / (stateRef.current.max - stateRef.current.min);
    return ratio * trackWidthRef.current;
  };

  const pxToValue = (px: number) => {
    if (trackWidthRef.current === 0) return stateRef.current.min;
    const ratio = Math.max(0, Math.min(1, px / trackWidthRef.current));
    const rawVal = stateRef.current.min + ratio * (stateRef.current.max - stateRef.current.min);
    return Math.round(rawVal / stateRef.current.step) * stateRef.current.step;
  };

  const minStartPx = useRef(0);
  const maxStartPx = useRef(0);

  const minThumbPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        minStartPx.current = valueToPx(latestValueMinRef.current);
      },
      onPanResponderMove: (_, gestureState) => {
        const newPx = Math.max(0, minStartPx.current + gestureState.dx);
        const newValue = pxToValue(newPx);
        const clampedValue = Math.max(
          stateRef.current.min,
          Math.min(latestValueMaxRef.current - stateRef.current.minDistance, newValue)
        );
        latestValueMinRef.current = clampedValue;
        if (onValueChangeRef.current) {
          onValueChangeRef.current({ min: clampedValue, max: latestValueMaxRef.current });
        }
      },
      onPanResponderRelease: () => {
        if (onSlidingCompleteRef.current) {
          onSlidingCompleteRef.current({ min: latestValueMinRef.current, max: latestValueMaxRef.current });
        }
      },
      onPanResponderTerminate: () => {
        if (onSlidingCompleteRef.current) {
          onSlidingCompleteRef.current({ min: latestValueMinRef.current, max: latestValueMaxRef.current });
        }
      },
    })
  ).current;

  const maxThumbPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        maxStartPx.current = valueToPx(latestValueMaxRef.current);
      },
      onPanResponderMove: (_, gestureState) => {
        const newPx = Math.max(0, maxStartPx.current + gestureState.dx);
        const newValue = pxToValue(newPx);
        const clampedValue = Math.min(
          stateRef.current.max,
          Math.max(latestValueMinRef.current + stateRef.current.minDistance, newValue)
        );
        latestValueMaxRef.current = clampedValue;
        if (onValueChangeRef.current) {
          onValueChangeRef.current({ min: latestValueMinRef.current, max: clampedValue });
        }
      },
      onPanResponderRelease: () => {
        if (onSlidingCompleteRef.current) {
          onSlidingCompleteRef.current({ min: latestValueMinRef.current, max: latestValueMaxRef.current });
        }
      },
      onPanResponderTerminate: () => {
        if (onSlidingCompleteRef.current) {
          onSlidingCompleteRef.current({ min: latestValueMinRef.current, max: latestValueMaxRef.current });
        }
      },
    })
  ).current;

  const minPx = valueToPx(valueMin);
  const maxPx = valueToPx(valueMax);

  return (
    <View
      style={styles.container}
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        setTrackWidth(w);
        trackWidthRef.current = w;
      }}
    >
      {/* Background Track */}
      <View style={styles.trackBackground} />

      {/* Active Selection Track */}
      <View
        style={[
          styles.trackActive,
          {
            left: minPx,
            width: Math.max(0, maxPx - minPx),
          },
        ]}
      />

      {/* Min Thumb */}
      <View
        {...minThumbPan.panHandlers}
        style={[
          styles.thumb,
          {
            left: minPx - 14,
          },
        ]}
      />

      {/* Max Thumb */}
      <View
        {...maxThumbPan.panHandlers}
        style={[
          styles.thumb,
          {
            left: maxPx - 14,
          },
        ]}
      />
    </View>
  );
}

const makeStyles = (palette: Palette) => ({
  container: {
    height: 36,
    justifyContent: 'center' as const,
    position: 'relative' as const,
    marginHorizontal: 14,
  },
  trackBackground: {
    height: 4,
    backgroundColor: palette.line,
    borderRadius: 2,
  },
  trackActive: {
    position: 'absolute' as const,
    height: 4,
    backgroundColor: '#FF5A1F',
    borderRadius: 2,
  },
  thumb: {
    position: 'absolute' as const,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.line,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 2.5,
  },
});
