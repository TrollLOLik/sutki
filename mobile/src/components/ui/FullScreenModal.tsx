import type { PropsWithChildren } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Modal,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useAppTheme } from '@/theme/useAppTheme';

export type FullScreenModalTransition = 'fade' | 'slide';

export interface FullScreenModalProps extends PropsWithChildren {
  visible: boolean;
  onClose: () => void;
  onShow?: () => void;
  transition?: FullScreenModalTransition;
  contentStyle?: StyleProp<ViewStyle>;
}

type TransitionState = 'closed' | 'opening' | 'open' | 'closing';

/**
 * Keeps the native modal mounted until its exit animation has finished.
 * This prevents the underlying map or screen from disappearing for one frame.
 */
export function FullScreenModal({
  visible,
  onClose,
  onShow,
  transition = 'fade',
  contentStyle,
  children,
}: FullScreenModalProps) {
  const { palette } = useAppTheme();
  const { height: screenHeight } = useWindowDimensions();
  const [mounted, setMounted] = useState(visible);
  const [reduceMotion, setReduceMotion] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;
  const state = useRef<TransitionState>('closed');
  const visibleRef = useRef(visible);
  const frame = useRef<number | null>(null);
  const showNotified = useRef(false);

  useEffect(() => {
    visibleRef.current = visible;
  }, [visible]);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => subscription.remove();
  }, []);

  const stopAnimation = useCallback(() => {
    if (frame.current != null) {
      cancelAnimationFrame(frame.current);
      frame.current = null;
    }
    progress.stopAnimation();
  }, [progress]);

  const animateOpen = useCallback(() => {
    if (!visibleRef.current || state.current === 'opening' || state.current === 'open') return;
    stopAnimation();
    state.current = 'opening';
    if (!showNotified.current) {
      showNotified.current = true;
      onShow?.();
    }

    if (reduceMotion) {
      progress.setValue(1);
      state.current = 'open';
      return;
    }

    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      if (!visibleRef.current) return;
      Animated.timing(progress, {
        toValue: 1,
        duration: transition === 'slide' ? 280 : 190,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!finished || !visibleRef.current) return;
        state.current = 'open';
      });
    });
  }, [onShow, progress, reduceMotion, stopAnimation, transition]);

  useEffect(() => {
    if (visible) {
      if (!mounted) {
        stopAnimation();
        progress.setValue(0);
        state.current = 'closed';
        setMounted(true);
      } else if (state.current === 'closing') {
        animateOpen();
      }
      return;
    }

    if (!mounted || state.current === 'closing') return;
    if (state.current === 'closed') {
      setMounted(false);
      return;
    }

    stopAnimation();
    state.current = 'closing';
    showNotified.current = false;
    if (reduceMotion) {
      progress.setValue(0);
      state.current = 'closed';
      setMounted(false);
      return;
    }

    Animated.timing(progress, {
      toValue: 0,
      duration: transition === 'slide' ? 230 : 150,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished || visibleRef.current) return;
      state.current = 'closed';
      setMounted(false);
    });
  }, [animateOpen, mounted, progress, reduceMotion, stopAnimation, transition, visible]);

  useEffect(() => () => stopAnimation(), [stopAnimation]);

  if (!mounted) return null;

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      navigationBarTranslucent
      hardwareAccelerated
      onShow={animateOpen}
      onRequestClose={onClose}>
      <Animated.View
        accessibilityViewIsModal
        style={[
          {
            flex: 1,
            backgroundColor: palette.surface,
            opacity: progress,
            transform: transition === 'slide'
              ? [{
                  translateY: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [Math.max(screenHeight, 1), 0],
                  }),
                }]
              : undefined,
          },
          contentStyle,
        ]}>
        {children}
      </Animated.View>
    </Modal>
  );
}
