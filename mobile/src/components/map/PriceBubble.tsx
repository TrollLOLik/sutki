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
export function PriceBubble({ price, selected, promoted, highlighted }: PriceBubbleProps) {
  const { palette } = useAppTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  return (
    <View style={[styles.bubble, promoted && styles.bubblePromoted, highlighted && styles.bubbleHighlighted, selected && styles.bubbleSelected]}>
      {highlighted ? <Ionicons name="sparkles" size={12} color={selected ? palette.primary : '#FFFFFF'} /> : null}
      <Text style={[styles.text, selected && styles.textSelected]}>
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
      backgroundColor: palette.primary,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: palette.surface,
      shadowColor: palette.primary,
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
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: 'bold',
    },
    textSelected: {
      color: palette.primary,
    },
  });
