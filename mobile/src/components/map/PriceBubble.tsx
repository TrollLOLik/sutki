import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { formatRub } from '@/lib/format';
import { palette } from '@/theme/tokens';

interface PriceBubbleProps {
  /** Nightly price in rubles. */
  price: number;
  /** When true, renders the inverted (selected) variant. */
  selected?: boolean;
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
export function PriceBubble({ price, selected }: PriceBubbleProps) {
  return (
    <View style={[styles.bubble, selected && styles.bubbleSelected]}>
      <Text style={[styles.text, selected && styles.textSelected]}>
        {`${formatRub(price)}\u00A0₽`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    alignSelf: 'center',
    backgroundColor: palette.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'white',
    shadowColor: palette.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  bubbleSelected: {
    backgroundColor: 'white',
    borderColor: palette.primary,
    shadowColor: palette.ink,
  },
  text: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  textSelected: {
    color: palette.primary,
  },
});
