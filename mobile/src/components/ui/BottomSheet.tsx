import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  useWindowDimensions,
  View,
  type DimensionValue,
} from 'react-native';

import { useAppTheme } from '@/theme/useAppTheme';

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  height?: DimensionValue;
}

type TransitionState = 'closed' | 'opening' | 'open' | 'closing';

export function BottomSheet({ visible, onClose, children, height }: BottomSheetProps) {
  const { palette } = useAppTheme();
  const { height: screenHeight } = useWindowDimensions();
  const [mounted, setMounted] = useState(visible);
  const [reduceMotion, setReduceMotion] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;
  const transition = useRef<TransitionState>('closed');
  const visibleRef = useRef(visible);
  const openFrame = useRef<number | null>(null);

  useEffect(() => {
    visibleRef.current = visible;
  }, [visible]);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub.remove();
  }, []);

  const cancelPendingAnimation = useCallback(() => {
    if (openFrame.current != null) {
      cancelAnimationFrame(openFrame.current);
      openFrame.current = null;
    }
    progress.stopAnimation();
  }, [progress]);

  const animateOpen = useCallback(() => {
    if (!visibleRef.current || transition.current === 'opening' || transition.current === 'open') return;
    cancelPendingAnimation();
    transition.current = 'opening';

    if (reduceMotion) {
      progress.setValue(1);
      transition.current = 'open';
      return;
    }

    // Wait for the native modal to paint once. Starting before onShow is what
    // caused a transparent/fully-open frame to flash on Android.
    openFrame.current = requestAnimationFrame(() => {
      openFrame.current = null;
      if (!visibleRef.current) return;
      Animated.spring(progress, {
        toValue: 1,
        damping: 25,
        stiffness: 250,
        mass: 0.9,
        overshootClamping: false,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished && visibleRef.current) transition.current = 'open';
      });
    });
  }, [cancelPendingAnimation, progress, reduceMotion]);

  useEffect(() => {
    if (visible) {
      if (!mounted) {
        cancelPendingAnimation();
        progress.setValue(0);
        transition.current = 'closed';
        setMounted(true);
      } else if (transition.current === 'closing') {
        animateOpen();
      }
      return;
    }

    if (!mounted || transition.current === 'closing' || transition.current === 'closed') return;
    cancelPendingAnimation();
    transition.current = 'closing';

    if (reduceMotion) {
      progress.setValue(0);
      transition.current = 'closed';
      setMounted(false);
      return;
    }

    Animated.timing(progress, {
      toValue: 0,
      duration: 180,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !visibleRef.current) {
        transition.current = 'closed';
        setMounted(false);
      }
    });
  }, [animateOpen, cancelPendingAnimation, mounted, progress, reduceMotion, visible]);

  useEffect(
    () => () => {
      cancelPendingAnimation();
    },
    [cancelPendingAnimation],
  );

  if (!mounted) return null;

  const backdropOpacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.46],
  });
  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [Math.max(screenHeight, 1), 0],
  });

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      hardwareAccelerated
      onShow={animateOpen}
      onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 justify-end">
        <Animated.View
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            backgroundColor: 'black',
            opacity: backdropOpacity,
          }}>
          <Pressable style={{ flex: 1 }} onPress={onClose} />
        </Animated.View>

        <Animated.View
          style={[
            {
              transform: [{ translateY }],
              backgroundColor: palette.surface,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              borderWidth: 1,
              borderBottomWidth: 0,
              borderColor: palette.line,
              shadowColor: '#000',
              shadowOpacity: 0.18,
              shadowRadius: 24,
              shadowOffset: { width: 0, height: -8 },
              elevation: 12,
            },
            height ? { height } : null,
          ]}
          className="px-4 pb-8 pt-3">
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{
              width: 38,
              height: 4,
              borderRadius: 2,
              backgroundColor: palette.line,
              alignSelf: 'center',
              marginBottom: 14,
            }}
          />
          {children}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
