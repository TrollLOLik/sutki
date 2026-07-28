import NetInfo from '@react-native-community/netinfo';
import { Ionicons } from '@expo/vector-icons';
import { onlineManager } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { queryClient } from '@/lib/query';
import { useAppTheme } from '@/theme/useAppTheme';

type BannerState = 'hidden' | 'offline' | 'restored';

export function NetworkStatusBanner() {
  const { palette } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<BannerState>('hidden');
  const visibility = useRef(new Animated.Value(0)).current;
  const wasOffline = useRef<boolean | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((networkState) => {
      const offline = networkState.isConnected === false || networkState.isInternetReachable === false;
      onlineManager.setOnline(!offline);

      if (offline) {
        if (hideTimer.current) {
          clearTimeout(hideTimer.current);
          hideTimer.current = null;
        }
        wasOffline.current = true;
        setState('offline');
        return;
      }

      if (wasOffline.current === true) {
        wasOffline.current = false;
        setState('restored');
        void queryClient.resumePausedMutations().then(() => {
          void queryClient.refetchQueries({ type: 'active' });
        });
        hideTimer.current = setTimeout(() => {
          hideTimer.current = null;
          setState('hidden');
        }, 1800);
        return;
      }

      if (wasOffline.current === null) {
        wasOffline.current = false;
        setState('hidden');
      }
    });

    return () => {
      unsubscribe();
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  useEffect(() => {
    Animated.timing(visibility, {
      toValue: state === 'hidden' ? 0 : 1,
      duration: state === 'hidden' ? 170 : 220,
      easing: state === 'hidden' ? Easing.in(Easing.ease) : Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [state, visibility]);

  const restored = state === 'restored';
  const color = '#FFFFFF';
  const backgroundColor = restored ? palette.success : palette.danger;
  const contentHeight = 30;
  const safeBottom = Math.min(insets.bottom, 8);

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      importantForAccessibility={state === 'hidden' ? 'no-hide-descendants' : 'yes'}
      style={[
        styles.clip,
        {
          height: visibility.interpolate({
            inputRange: [0, 1],
            outputRange: [0, contentHeight + safeBottom],
          }),
          backgroundColor,
          paddingBottom: safeBottom,
        },
      ]}>
      <Animated.View
        style={[
          styles.content,
          {
            minHeight: contentHeight,
            opacity: visibility,
            transform: [
              {
                translateY: visibility.interpolate({
                  inputRange: [0, 1],
                  outputRange: [contentHeight, 0],
                }),
              },
            ],
          },
        ]}>
        <Ionicons
          name={restored ? 'checkmark-circle-outline' : 'cloud-offline-outline'}
          size={15}
          color={color}
        />
        <Text style={[styles.label, { color }]}>
          {restored ? 'Соединение восстановлено' : 'Нет подключения'}
        </Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  clip: {
    flexShrink: 0,
    overflow: 'hidden',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  label: {
    marginLeft: 6,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
});
