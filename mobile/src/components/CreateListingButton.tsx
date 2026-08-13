import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

interface CreateListingButtonProps {
  onPress: () => void;
  size?: number;
  accessibilityLabel?: string;
}

export function CreateListingButton({
  onPress,
  size = 48,
  accessibilityLabel = 'Разместить объявление',
}: CreateListingButtonProps) {
  const reduceMotion = useReducedMotion();
  const pulse = useSharedValue(0);
  const rotation = useSharedValue(0);
  const scale = useSharedValue(1);
  const iconRotation = useSharedValue(0);
  const shimmer = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;

    rotation.value = withRepeat(
      withTiming(360, { duration: 4000, easing: Easing.linear }),
      -1,
      false,
    );
    pulse.value = withRepeat(
      withTiming(1, { duration: 2000, easing: Easing.linear }),
      -1,
      false,
    );
    shimmer.value = withRepeat(
      withTiming(1, { duration: 2500, easing: Easing.ease }),
      -1,
      true,
    );

    return () => {
      cancelAnimation(rotation);
      cancelAnimation(pulse);
      cancelAnimation(shimmer);
    };
  }, [pulse, reduceMotion, rotation, shimmer]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse.value * 0.35 }],
    opacity: 0.6 * (1 - pulse.value),
  }));

  const rotationStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const scaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${iconRotation.value}deg` }],
  }));

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(shimmer.value, [0, 1], [-size * 1.25, size * 1.25]) },
      { rotate: '30deg' },
    ],
  }));

  const oversize = size * (80 / 48);
  const oversizeOffset = (size - oversize) / 2;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPressIn={() => {
        if (reduceMotion) return;
        scale.value = withSpring(0.88, { damping: 20, stiffness: 400 });
        iconRotation.value = withSpring(45, { damping: 20, stiffness: 400 });
      }}
      onPressOut={() => {
        if (reduceMotion) return;
        scale.value = withSpring(1, { damping: 12, stiffness: 250 });
        iconRotation.value = withSpring(0, { damping: 12, stiffness: 250 });
      }}
      onPress={onPress}
      style={styles.pressable}
    >
      <Animated.View
        style={[
          styles.pulse,
          { width: size, height: size, borderRadius: size / 2 },
          pulseStyle,
        ]}
      />

      <Animated.View
        style={[
          styles.gradientWrap,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            shadowRadius: size * (10 / 48),
          },
          scaleStyle,
        ]}
      >
        <Animated.View
          style={[
            styles.gradientOversize,
            {
              width: oversize,
              height: oversize,
              top: oversizeOffset,
              left: oversizeOffset,
            },
            rotationStyle,
          ]}
        >
          <LinearGradient
            colors={['#FF8E53', '#FF5A1F', '#FF2D55', '#FF8E53']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        {!reduceMotion ? (
          <Animated.View
            style={[
              styles.shimmer,
              { top: -size / 6, bottom: -size / 6, width: size * (22 / 48) },
              shimmerStyle,
            ]}
          >
            <LinearGradient
              colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.38)', 'rgba(255,255,255,0)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        ) : null}

        <Animated.View style={iconStyle}>
          <Ionicons name="add" size={size * (28 / 48)} color="#FFFFFF" />
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulse: {
    position: 'absolute',
    backgroundColor: '#FF5A1F',
  },
  gradientWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: '#FF5A1F',
    shadowColor: '#FF5A1F',
    shadowOpacity: 0.45,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  gradientOversize: {
    position: 'absolute',
  },
  shimmer: {
    position: 'absolute',
  },
});
