import { useEffect } from 'react';
import {
  Easing,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { selectionMotion } from '@/theme/tokens';

type SelectionTransition = 'timing' | 'spring';

export function useSelectionProgress(
  active: boolean,
  transition: SelectionTransition = 'timing',
) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    const target = active ? 1 : 0;
    if (reduceMotion) {
      progress.value = target;
      return;
    }

    progress.value = transition === 'spring'
      ? withSpring(target, selectionMotion.spring)
      : withTiming(target, {
          duration: selectionMotion.duration,
          easing: Easing.out(Easing.cubic),
        });
  }, [active, progress, reduceMotion, transition]);

  return progress;
}
