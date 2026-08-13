import { Ionicons } from '@expo/vector-icons';
import { Image, type ImageProps } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useAppTheme } from '@/theme/useAppTheme';

interface ResilientImageProps extends Omit<ImageProps, 'source' | 'style'> {
  uri?: string | null;
  style: StyleProp<ViewStyle>;
  fallbackSize?: number;
}

/**
 * Remote image that always keeps its layout and shows a themed placeholder
 * when the URL is empty, expired, forbidden, or otherwise unavailable.
 */
export function ResilientImage({
  uri,
  style,
  fallbackSize = 32,
  contentFit = 'cover',
  cachePolicy = 'memory-disk',
  recyclingKey = uri ?? undefined,
  onError,
  ...imageProps
}: ResilientImageProps) {
  const { palette } = useAppTheme();
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [uri]);

  return (
    <View style={[style, styles.container, { backgroundColor: palette.surfaceSkeleton }]}>
      {uri && !failed ? (
        <Image
          {...imageProps}
          source={{ uri }}
          contentFit={contentFit}
          cachePolicy={cachePolicy}
          recyclingKey={recyclingKey}
          style={StyleSheet.absoluteFill}
          onError={(event) => {
            setFailed(true);
            onError?.(event);
          }}
        />
      ) : (
        <View style={styles.fallback}>
          <Ionicons name="image-outline" size={fallbackSize} color={palette.inkMuted} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  fallback: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
