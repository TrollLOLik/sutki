import NetInfo from '@react-native-community/netinfo';
import { Ionicons } from '@expo/vector-icons';
import { onlineManager } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { queryClient } from '@/lib/query';
import { useAppTheme } from '@/theme/useAppTheme';

type BannerState = 'hidden' | 'offline' | 'restored';

export function NetworkStatusBanner() {
  const { palette } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<BannerState>('hidden');
  const visibility = useRef(new Animated.Value(0)).current;
  const wasOffline = useRef(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((networkState) => {
      const offline = networkState.isConnected === false || networkState.isInternetReachable === false;
      onlineManager.setOnline(!offline);

      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
        hideTimer.current = null;
      }

      if (offline) {
        wasOffline.current = true;
        setState('offline');
        return;
      }

      if (wasOffline.current) {
        wasOffline.current = false;
        setState('restored');
        void queryClient.resumePausedMutations().then(() => {
          void queryClient.refetchQueries({ type: 'active' });
        });
        hideTimer.current = setTimeout(() => setState('hidden'), 2200);
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
      duration: state === 'hidden' ? 180 : 240,
      easing: state === 'hidden' ? Easing.in(Easing.ease) : Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [state, visibility]);

  const restored = state === 'restored';
  const color = restored ? palette.success : palette.danger;
  const backgroundColor = restored ? palette.successLight : palette.dangerLight;

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      importantForAccessibility={state === 'hidden' ? 'no-hide-descendants' : 'yes'}
      style={{
        position: 'absolute',
        zIndex: 10000,
        elevation: 20,
        top: insets.top + 8,
        left: 16,
        right: 16,
        opacity: visibility,
        transform: [
          {
            translateY: visibility.interpolate({
              inputRange: [0, 1],
              outputRange: [-18, 0],
            }),
          },
        ],
      }}>
      <View
        style={{
          minHeight: 48,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 18,
          borderWidth: 1,
          borderColor: color,
          backgroundColor,
          paddingHorizontal: 16,
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 5 },
          shadowOpacity: 0.18,
          shadowRadius: 12,
        }}>
        <Ionicons
          name={restored ? 'checkmark-circle-outline' : 'cloud-offline-outline'}
          size={21}
          color={color}
        />
        <Text style={{ marginLeft: 9, color, fontSize: 14, lineHeight: 19, fontWeight: '800' }}>
          {restored ? 'Соединение восстановлено' : 'Нет подключения к интернету'}
        </Text>
      </View>
    </Animated.View>
  );
}
