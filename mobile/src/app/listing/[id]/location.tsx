import React, { useMemo } from 'react';
import { View, Text, Linking, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import Svg, { Path, Circle as SvgCircle } from 'react-native-svg';
import YaMap, { Marker, Circle } from 'react-native-yamap-plus';

import { useListing } from '@/lib/api/listings';
import { useAppTheme } from '@/theme/useAppTheme';
import type { Palette } from '@/theme/tokens';
import { goBackOrReplace } from '@/lib/navigation';
import { NavigationBackButton } from '@/components/NavigationBackButton';
import { Button, MaterialSurface } from '@/components/ui';
import { EmptyState } from '@/components/EmptyState';

function OrangePin() {
  return (
    <View style={pinStyles.pinContainer}>
      {/* Subtle Halo */}
      <View style={pinStyles.pinHalo} />
      {/* Pin SVG */}
      <Svg width="36" height="42" viewBox="0 0 36 42" fill="none">
        <Path
          d="M18 42C18 42 36 26.51 36 18C36 8.05887 27.9411 0 18 0C8.05887 0 0 8.05887 0 18C0 26.51 18 42 18 42Z"
          fill="#FF5A1F"
        />
        <Path
          d="M18 40.5C18 40.5 34.5 25.419 34.5 18C34.5 8.8873 27.1127 1.5 18 1.5C8.8873 1.5 1.5 8.8873 1.5 18C1.5 25.419 18 40.5 18 40.5Z"
          stroke="white"
          strokeWidth="3"
        />
        <SvgCircle cx="18" cy="18" r="5" fill="white" />
      </Svg>
    </View>
  );
}

export default function LocationScreen() {
  const { palette, isDark } = useAppTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading, error } = useListing(id ? Number(id) : undefined);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF5A1F" />
      </SafeAreaView>
    );
  }

  if (error || !data || data.lat == null || data.lng == null) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <View style={{ width: '100%', maxWidth: 360, gap: 20 }}>
          <EmptyState
            icon="location-outline"
            title="Не удалось загрузить расположение"
            subtitle="Вернитесь к объявлению и попробуйте открыть карту ещё раз."
          />
          <Button
            label="Вернуться к объявлению"
            variant="secondary"
            onPress={() => goBackOrReplace({ pathname: '/listing/[id]', params: { id } })}
          />
        </View>
      </SafeAreaView>
    );
  }

  const isFuzzed = data.radius > 0;

  const handleBuildRoute = async () => {
    if (data.lat == null || data.lng == null) return;
    
    // We try to open native yandexmaps app first, fallback to browser
    const nativeUrl = `yandexmaps://maps.yandex.ru/?rtext=~${data.lat},${data.lng}&rtt=auto`;
    const webUrl = `https://yandex.ru/maps/?rtext=~${data.lat},${data.lng}&rtt=auto`;

    try {
      const canOpen = await Linking.canOpenURL('yandexmaps://');
      if (canOpen) {
        await Linking.openURL(nativeUrl);
      } else {
        await Linking.openURL(webUrl);
      }
    } catch (e) {
      // Fallback
      await Linking.openURL(webUrl).catch(() => {});
    }
  };

  return (
    <View style={styles.container}>
      {/* Map Header Overlay */}
      <SafeAreaView edges={['top']} style={styles.headerOverlay}>
        <NavigationBackButton
          fallback={{ pathname: '/listing/[id]', params: { id } }}
          size={48}
          variant="material">
          <Ionicons name="close" size={24} color={palette.ink} />
        </NavigationBackButton>
      </SafeAreaView>

      {/* Yandex Map */}
      <YaMap
        showUserPosition={false}
        nightMode={isDark}
        style={styles.map}
        initialRegion={{ lat: data.lat, lon: data.lng, zoom: 15 }}
      >
        {isFuzzed ? (
          <Circle
            center={{ lat: data.lat, lon: data.lng }}
            radius={data.radius}
            fillColor="rgba(255, 90, 31, 0.12)"
            strokeColor="rgba(255, 90, 31, 0.4)"
            strokeWidth={1.5}
          />
        ) : (
          <Marker point={{ lat: data.lat, lon: data.lng }}>
            <OrangePin />
          </Marker>
        )}
      </YaMap>

      {/* Floating location material */}
      <MotiView
        from={{ opacity: 0, translateY: 28, scale: 0.97 }}
        animate={{ opacity: 1, translateY: 0, scale: 1 }}
        transition={{ type: 'spring', damping: 21, stiffness: 220, mass: 0.85 }}
        style={{ position: 'absolute', left: 12, right: 12, bottom: Math.max(insets.bottom, 12) }}>
        <MaterialSurface level="floating" radius={24} style={styles.bottomSheet}>
          <View style={styles.dragHandle} />

          <View style={styles.content}>
            <View style={styles.headerRow}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={styles.title}>Расположение</Text>
                <View style={{ marginTop: 6, flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
                  <Ionicons name="location-outline" size={17} color={palette.inkMuted} style={{ marginTop: 1 }} />
                  <Text style={styles.addressText} numberOfLines={2}>
                    {data.city}, {data.address}
                  </Text>
                </View>
              </View>
              <View style={[styles.badge, isFuzzed ? styles.badgeFuzzed : styles.badgeExact]}>
                <Text
                  numberOfLines={1}
                  ellipsizeMode="tail"
                  style={[styles.badgeText, isFuzzed ? styles.badgeTextFuzzed : styles.badgeTextExact]}>
                  {isFuzzed ? 'Приблизительно' : 'Точный адрес'}
                </Text>
              </View>
            </View>

            {isFuzzed && (
              <View style={styles.privacyNotice}>
                <View style={styles.noticeIcon}>
                  <Ionicons name="shield-checkmark-outline" size={17} color={palette.primary} />
                </View>
                <Text style={styles.privacyNoticeText}>
                  Точный адрес и инструкции появятся после подтверждения бронирования.
                </Text>
              </View>
            )}

            <Button label="Построить маршрут" icon="navigate-outline" onPress={handleBuildRoute} />
          </View>
        </MaterialSurface>
      </MotiView>
    </View>
  );
}

const pinStyles = StyleSheet.create({
  pinContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    height: 44,
  },
  pinHalo: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 90, 31, 0.15)',
  },
});

const makeStyles = (palette: Palette) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.surface,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.surface,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: palette.surface,
  },
  map: {
    flex: 1,
  },
  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: 16,
    paddingTop: 8,
    pointerEvents: 'box-none',
  },
  bottomSheet: {
    paddingTop: 10,
    paddingBottom: 18,
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.line,
    alignSelf: 'center',
    marginBottom: 13,
  },
  content: {
    paddingHorizontal: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: palette.ink,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeFuzzed: {
    backgroundColor: 'rgba(255, 90, 31, 0.08)',
  },
  badgeExact: {
    backgroundColor: 'rgba(46, 204, 113, 0.08)',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  badgeTextFuzzed: {
    color: '#FF5A1F',
  },
  badgeTextExact: {
    color: '#2ECC71',
  },
  addressText: {
    flex: 1,
    fontSize: 13,
    color: palette.inkSecondary,
    lineHeight: 18,
  },
  privacyNotice: {
    flexDirection: 'row',
    backgroundColor: palette.surfaceMuted,
    alignItems: 'center',
    borderRadius: 16,
    padding: 12,
    marginBottom: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.line,
  },
  noticeIcon: {
    width: 32,
    height: 32,
    marginRight: 10,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.primaryLight,
  },
  privacyNoticeText: {
    flex: 1,
    fontSize: 13,
    color: palette.inkSecondary,
    lineHeight: 18,
  },
});
