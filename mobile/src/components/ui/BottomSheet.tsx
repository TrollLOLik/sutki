import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Modal,
  Pressable,
  useWindowDimensions,
  View,
  type DimensionValue,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DialogHeader, type DialogTone } from '@/components/ui/DialogHeader';
import { ComponentMarker } from '@/components/debug/ComponentMarker';
import { useAppTheme } from '@/theme/useAppTheme';

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  height?: DimensionValue;
  title?: ReactNode;
  subtitle?: ReactNode;
  icon?: keyof typeof Ionicons.glyphMap;
  tone?: DialogTone;
  footer?: ReactNode;
  closeOnBackdrop?: boolean;
  showClose?: boolean;
  bodyStyle?: StyleProp<ViewStyle>;
}

type TransitionState = 'closed' | 'opening' | 'open' | 'closing';

export function BottomSheet({
  visible,
  onClose,
  children,
  height,
  title,
  subtitle,
  icon,
  tone = 'primary',
  footer,
  closeOnBackdrop = true,
  showClose = true,
  bodyStyle,
}: BottomSheetProps) {
  const { palette } = useAppTheme();
  const insets = useSafeAreaInsets();
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
      <KeyboardAvoidingView behavior="height" automaticOffset className="flex-1 items-center justify-end">
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
          <Pressable
            disabled={!closeOnBackdrop}
            style={{ flex: 1 }}
            onPress={onClose}
          />
        </Animated.View>

        <Animated.View
          style={[
            {
              transform: [{ translateY }],
              width: '100%',
              maxWidth: 680,
              maxHeight: '92%',
              overflow: 'hidden',
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
        >
          <ComponentMarker kind="modal" name="BottomSheet" />
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{
              width: 38,
              height: 4,
              borderRadius: 2,
              backgroundColor: palette.line,
              alignSelf: 'center',
              marginTop: 12,
              marginBottom: title ? 8 : 14,
            }}
          />
          {title ? (
            <DialogHeader
              title={title}
              description={subtitle}
              icon={icon}
              tone={tone}
              onClose={onClose}
              showClose={showClose}
            />
          ) : null}
          <View
            style={[
              {
                minHeight: 0,
                paddingHorizontal: 16,
                paddingTop: title ? 16 : 0,
                paddingBottom: footer ? 16 : Math.max(32, insets.bottom + 12),
              },
              height ? { flex: 1 } : null,
              bodyStyle,
            ]}>
            {children}
          </View>
          {footer ? (
            <View
              style={{
                width: '100%',
                borderTopWidth: 1,
                borderTopColor: palette.line,
                paddingHorizontal: 16,
                paddingTop: 12,
                paddingBottom: Math.max(16, insets.bottom + 8),
                backgroundColor: palette.surface,
              }}>
              {footer}
            </View>
          ) : null}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
