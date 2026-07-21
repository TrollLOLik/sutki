import React, { useEffect, useRef, useState } from 'react';
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
} from 'react-native';

import { useAppTheme } from '@/theme/useAppTheme';

interface BottomSheetProps {
  /**
   * Visibility state of the bottom sheet.
   */
  visible: boolean;
  /**
   * Callback fired when the user requests to close the sheet (backdrop press, hardware back).
   * IMPORTANT: The parent component MUST update its state to set `visible` to `false` in this callback.
   * The close animation is driven solely by the parent's `visible` prop transitioning to `false`.
   */
  onClose: () => void;
  children: React.ReactNode;
  height?: string | number;
}

export function BottomSheet({ visible, onClose, children, height }: BottomSheetProps) {
  const { palette } = useAppTheme();
  const { height: screenHeight } = useWindowDimensions();
  const [localVisible, setLocalVisible] = useState(visible);
  const [reduceMotion, setReduceMotion] = useState(false);

  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(screenHeight)).current;

  // Track the actual animation target state to avoid duplicate triggers
  const animState = useRef<'hidden' | 'showing' | 'hiding'>('hidden');
  const isOpened = useRef(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub.remove();
  }, []);

  // Sync visible -> localVisible (mount/unmount animation trigger)
  useEffect(() => {
    if (visible) {
      // Synchronously set initial values on cold opens to ensure layout paints them hidden on frame 1
      if (!isOpened.current) {
        fade.setValue(0);
        slide.setValue(screenHeight);
      }
      setLocalVisible(true);
    } else if (localVisible && animState.current !== 'hiding') {
      animState.current = 'hiding';
      if (reduceMotion) {
        setLocalVisible(false);
        animState.current = 'hidden';
        isOpened.current = false;
      } else {
        Animated.parallel([
          Animated.timing(fade, { toValue: 0, duration: 200, useNativeDriver: true }),
          Animated.timing(slide, {
            toValue: screenHeight,
            duration: 200,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
          }),
        ]).start(() => {
          setLocalVisible(false);
          animState.current = 'hidden';
          isOpened.current = false;
        });
      }
    }
  }, [visible, reduceMotion, screenHeight, localVisible]);

  // Handle entry animation once mounted
  useEffect(() => {
    if (localVisible && visible && animState.current !== 'showing') {
      animState.current = 'showing';
      if (reduceMotion) {
        fade.setValue(0.4);
        slide.setValue(0);
        isOpened.current = true;
      } else {
        // Double requestAnimationFrame guarantees layout paint before starting the slide animation
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            isOpened.current = true;
            Animated.parallel([
              Animated.timing(fade, { toValue: 0.4, duration: 250, useNativeDriver: true }),
              Animated.spring(slide, {
                toValue: 0,
                damping: 26,
                stiffness: 260,
                mass: 1,
                useNativeDriver: true,
              }),
            ]).start();
          });
        });
      }
    }
  }, [localVisible, visible, reduceMotion, screenHeight]);

  const handleClose = () => {
    onClose();
  };

  if (!localVisible) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 justify-end"
      >
        {/* Animated Backdrop */}
        <Animated.View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'black',
            opacity: fade,
          }}
        >
          <Pressable style={{ flex: 1 }} onPress={handleClose} />
        </Animated.View>

        {/* Sliding Sheet Card */}
        <Animated.View
          style={[
            {
              transform: [{ translateY: slide }],
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
            height ? { height: height as any } : null,
          ]}
          className="px-4 pb-8 pt-3"
        >
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
