import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/theme/useAppTheme';

interface CityClusterBubbleProps {
  count: number;
}

function clusterDiameter(count: number) {
  return Math.round(Math.min(80, 42 + Math.log2(Math.max(1, count) + 1) * 8));
}

export function CityClusterBubble({ count }: CityClusterBubbleProps) {
  const { palette } = useAppTheme();
  const size = clusterDiameter(count);
  const styles = useMemo(() => StyleSheet.create({
    halo: {
      width: size + 10,
      height: size + 10,
      borderRadius: (size + 10) / 2,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: palette.overlaySurface,
      borderWidth: 1,
      borderColor: palette.line,
      shadowColor: '#1A1A1A',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.22,
      shadowRadius: 10,
      elevation: 10,
    },
    bubble: {
      width: size,
      height: size,
      borderRadius: size / 2,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: palette.primary,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.38)',
      shadowColor: palette.primary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.28,
      shadowRadius: 5,
      elevation: 5,
    },
    count: {
      color: '#FFFFFF',
      fontSize: Math.min(21, 13 + Math.log2(Math.max(1, count) + 1) * 1.8),
      fontWeight: '900',
      fontVariant: ['tabular-nums'],
    },
  }), [count, palette, size]);

  return (
    <View style={styles.halo}>
      <View style={styles.bubble}>
        <Text style={styles.count}>{count}</Text>
      </View>
    </View>
  );
}
