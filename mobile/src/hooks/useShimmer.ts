import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';

/**
 * Reusable animation hook for the shimmering sweep reflection effect (TZ §2).
 */
export function useShimmer(duration = 3000, delay = 1000) {
  const shimmerAnim = useRef(new Animated.Value(-1)).current;

  useEffect(() => {
    shimmerAnim.setValue(-1);
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1.5,
          duration,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.delay(delay),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [shimmerAnim, duration, delay]);

  return shimmerAnim;
}
