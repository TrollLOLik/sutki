import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useIsFocused } from 'expo-router';
import type { PropsWithChildren } from 'react';
import { useEffect } from 'react';
import { Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

interface PromotionHighlightSurfaceProps extends PropsWithChildren {
  active: boolean;
  radius?: number;
}

export function PromotionHighlightSurface({
  active,
  radius = 20,
  children,
}: PromotionHighlightSurfaceProps) {
  const reduceMotion = useReducedMotion();
  const isFocused = useIsFocused();
  const { width } = useWindowDimensions();
  const shimmer = useSharedValue(0);

  useEffect(() => {
    shimmer.value = 0;
    if (!active || reduceMotion || !isFocused) return;

    shimmer.value = withRepeat(
      withSequence(
        withDelay(900, withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.quad) })),
        withTiming(0, { duration: 0 }),
        withDelay(2200, withTiming(0, { duration: 0 })),
      ),
      -1,
      false,
    );

    return () => {
      cancelAnimation(shimmer);
      shimmer.value = 0;
    };
  }, [active, isFocused, reduceMotion, shimmer]);

  const shimmerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(shimmer.value, [0, 0.08, 0.92, 1], [0, 0.72, 0.72, 0]),
    transform: [
      { translateX: interpolate(shimmer.value, [0, 1], [-120, width + 80]) },
      { rotate: '12deg' },
    ],
  }));

  if (!active) return <>{children}</>;

  return (
    <View
      style={{
        borderRadius: radius,
        shadowColor: '#FF6438',
        shadowOpacity: 0.24,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 8 },
        elevation: Platform.OS === 'android' ? 0 : 5,
      }}
    >
      <LinearGradient
        colors={['#FF5B35', '#FFB13B', '#FF426E', '#FF5B35']}
        locations={[0, 0.36, 0.72, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ borderRadius: radius, padding: 1.5 }}
      >
        <View style={{ borderRadius: radius - 1.5, overflow: 'hidden' }}>
          {children}
          {!reduceMotion ? (
            <Animated.View pointerEvents="none" style={[styles.shimmer, shimmerStyle]}>
              <LinearGradient
                colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.22)', 'rgba(255,255,255,0)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
          ) : null}
        </View>
      </LinearGradient>
    </View>
  );
}

interface PromotionBadgeProps {
  highlighted: boolean;
}

export function PromotionBadge({ highlighted }: PromotionBadgeProps) {
  if (highlighted) {
    return (
      <LinearGradient
        colors={['#FF5B35', '#FF8A34', '#FF426E']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.highlightBadge}
      >
        <Ionicons name="sparkles" size={11} color="#FFFFFF" />
        <Text style={styles.badgeText}>Яркая карточка</Text>
      </LinearGradient>
    );
  }

  return (
    <View style={styles.promotionBadge}>
      <Ionicons name="trending-up" size={11} color="#FFFFFF" />
      <Text style={styles.badgeText}>Продвигается</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  shimmer: {
    position: 'absolute',
    top: -40,
    bottom: -40,
    width: 76,
    zIndex: 20,
  },
  highlightBadge: {
    minHeight: 25,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  promotionBadge: {
    minHeight: 25,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    backgroundColor: '#FF6438',
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    lineHeight: 12,
  },
});
