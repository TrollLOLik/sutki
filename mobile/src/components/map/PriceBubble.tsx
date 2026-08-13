import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { formatRub } from '@/lib/format';
import { useAppTheme } from '@/theme/useAppTheme';
import type { Palette } from '@/theme/tokens';

interface PriceBubbleProps {
  /** Nightly price in rubles. */
  price: number;
  /** When true, renders the inverted (selected) variant. */
  selected?: boolean;
  promoted?: boolean;
  highlighted?: boolean;
  favorite?: boolean;
  viewed?: boolean;
  own?: boolean;
}

/**
 * Price-tag bubble rendered inside a <Marker> via ClusteredYamap's
 * `renderMarker`. The selected variant inverts the colors so the tapped pin
 * stands out against the others.
 *
 * NOTE: these are React views snapshotted to bitmaps by the native layer, which
 * is fine for tens of pins. When the map grows to hundreds/thousands of pins,
 * switch to server-side clustering + static-image bubbles to avoid jank.
 */
export function PriceBubble({ price, selected, promoted, highlighted, favorite, viewed, own }: PriceBubbleProps) {
  const { palette } = useAppTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const isViewedOnly = Boolean(viewed && !favorite && !own);
  return (
    <View
      style={[
        styles.bubble,
        own && styles.bubbleOwn,
        (favorite || promoted) && styles.bubbleAccent,
        promoted && styles.bubblePromoted,
        highlighted && styles.bubbleHighlighted,
        isViewedOnly && styles.bubbleViewed,
        selected && styles.bubbleSelected,
      ]}
    >
      {highlighted ? (
        <Ionicons name="sparkles" size={12} color={selected ? palette.primary : '#FFFFFF'} />
      ) : favorite ? (
        <Ionicons name="heart" size={12} color={selected ? palette.primary : '#FFFFFF'} />
      ) : own ? (
        <Ionicons name="home-outline" size={12} color={palette.primary} />
      ) : viewed ? (
        <Ionicons name="eye-outline" size={12} color={selected ? palette.primary : palette.inkMuted} />
      ) : null}
      <Text
        style={[
          styles.text,
          own && styles.textOwn,
          (favorite || promoted) && styles.textAccent,
          isViewedOnly && styles.textViewed,
          selected && styles.textSelected,
        ]}
      >
        {`${formatRub(price)}\u00A0₽`}
      </Text>
    </View>
  );
}

const makeStyles = (palette: Palette) =>
  StyleSheet.create({
    bubble: {
      alignSelf: 'center',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: palette.surface,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: palette.line,
      shadowColor: '#1A1A1A',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 4,
    },
    bubbleSelected: {
      backgroundColor: palette.surface,
      borderColor: palette.primary,
      shadowColor: '#1A1A1A',
    },
    bubbleViewed: {
      backgroundColor: palette.surfaceMuted,
      borderColor: palette.line,
      shadowOpacity: 0.08,
      elevation: 2,
    },
    bubbleOwn: {
      backgroundColor: palette.surface,
      borderColor: palette.primary,
    },
    bubbleAccent: {
      backgroundColor: palette.primary,
      borderColor: palette.surface,
      shadowColor: palette.primary,
    },
    bubblePromoted: {
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderWidth: 2.5,
      shadowOpacity: 0.4,
      elevation: 7,
    },
    bubbleHighlighted: {
      borderWidth: 3,
      borderColor: '#FFD5C6',
      shadowOpacity: 0.5,
      shadowRadius: 7,
      elevation: 9,
    },
    text: {
      color: palette.ink,
      fontSize: 12,
      fontWeight: 'bold',
    },
    textSelected: {
      color: palette.primary,
    },
    textViewed: {
      color: palette.inkMuted,
    },
    textOwn: {
      color: palette.primary,
    },
    textAccent: {
      color: '#FFFFFF',
    },
  });
