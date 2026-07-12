import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/theme/useAppTheme';

interface CityClusterBubbleProps {
  count: number;
}

function clusterDiameter(count: number) {
  return Math.round(Math.min(78, 38 + Math.log2(Math.max(1, count) + 1) * 9));
}

export function CityClusterBubble({ count }: CityClusterBubbleProps) {
  const { palette } = useAppTheme();
  const size = clusterDiameter(count);
  const styles = useMemo(() => StyleSheet.create({
    bubble: {
      width: size,
      height: size,
      borderRadius: size / 2,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: palette.surface,
      borderWidth: 4,
      borderColor: palette.primary,
      shadowColor: palette.primary,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.35,
      shadowRadius: 7,
      elevation: 9,
    },
    count: {
      color: palette.ink,
      fontSize: Math.min(20, 12 + Math.log2(Math.max(1, count) + 1) * 2),
      fontWeight: '800',
    },
  }), [count, palette, size]);

  return (
    <View style={styles.bubble}>
      <Text style={styles.count}>{count}</Text>
    </View>
  );
}
