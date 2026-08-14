import type { PropsWithChildren } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  FadeInDown,
  FadeOutUp,
  LinearTransition,
  useReducedMotion,
} from 'react-native-reanimated';

interface AnimatedListItemProps {
  style?: StyleProp<ViewStyle>;
}

/** Shared restrained enter/remove/layout motion for domain list rows. */
export function AnimatedListItem({
  children,
  style,
}: PropsWithChildren<AnimatedListItemProps>) {
  const reduceMotion = useReducedMotion();

  return (
    <Animated.View
      layout={reduceMotion ? undefined : LinearTransition.springify().damping(22).stiffness(260)}
      style={style}>
      <Animated.View
        entering={reduceMotion ? undefined : FadeInDown.duration(180).springify().damping(22)}
        exiting={reduceMotion ? undefined : FadeOutUp.duration(135)}>
        {children}
      </Animated.View>
    </Animated.View>
  );
}
