import NetInfo from '@react-native-community/netinfo';
import { Ionicons } from '@expo/vector-icons';
import { onlineManager } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { queryClient } from '@/lib/query';
import { useNetworkStatusStore } from '@/store/networkStatus';
import { useAppTheme } from '@/theme/useAppTheme';

type BannerState = 'hidden' | 'offline' | 'restored';

export function NetworkStatusBanner() {
  const { palette } = useAppTheme();
  const insets = useSafeAreaInsets();
  const networkStatus = useNetworkStatusStore((networkState) => networkState.status);
  const [state, setState] = useState<BannerState>('hidden');
  const visibility = useRef(new Animated.Value(0)).current;
  const wasOffline = useRef<boolean | null>(null);

  useEffect(() => {
    return NetInfo.addEventListener((nativeState) => {
      const offline =
        nativeState.isConnected === false || nativeState.isInternetReachable === false;
      if (offline) {
        useNetworkStatusStore.getState().reportOffline();
        return;
      }

      if (
        nativeState.isInternetReachable === true ||
        (nativeState.isConnected === true &&
          useNetworkStatusStore.getState().status === 'unknown')
      ) {
        useNetworkStatusStore.getState().reportOnline();
      }
    });
  }, []);

  useEffect(() => {
    if (networkStatus === 'unknown') return;

    const offline = networkStatus === 'offline';
    onlineManager.setOnline(!offline);

    if (offline) {
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
      return;
    }

    wasOffline.current = false;
    setState('hidden');
  }, [networkStatus]);

  // The restored banner owns its lifetime. Keeping this timer outside the
  // NetInfo callback prevents duplicate Android connectivity events from
  // cancelling or replacing the hide operation.
  useEffect(() => {
    if (state !== 'restored') return;

    const timer = setTimeout(() => {
      setState((current) => (current === 'restored' ? 'hidden' : current));
    }, 1800);

    return () => clearTimeout(timer);
  }, [state]);

  useEffect(() => {
    const animation = Animated.timing(visibility, {
      toValue: state === 'hidden' ? 0 : 1,
      duration: state === 'hidden' ? 170 : 220,
      easing: state === 'hidden' ? Easing.in(Easing.ease) : Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    animation.start(({ finished }) => {
      if (finished && state === 'hidden') {
        visibility.setValue(0);
      }
    });
    return () => animation.stop();
  }, [state, visibility]);

  const restored = state === 'restored';
  const backgroundColor = palette.surface;
  const textColor = palette.ink;
  const statusColor = restored ? palette.success : palette.danger;
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
        },
      ]}>
      <Animated.View
        style={[
          styles.content,
          {
            minHeight: contentHeight,
            backgroundColor,
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
          color={statusColor}
        />
        <Text style={[styles.label, { color: textColor }]}>
          {restored ? 'Соединение восстановлено' : 'Нет подключения'}
        </Text>
      </Animated.View>
      {safeBottom > 0 ? <View style={{ height: safeBottom }} /> : null}
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
