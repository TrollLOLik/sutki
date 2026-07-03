import React, { useMemo } from 'react';
import { View, Text, Pressable, Linking, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path, Circle as SvgCircle } from 'react-native-svg';
import YaMap, { Marker, Circle } from 'react-native-yamap-plus';

import { useListing } from '@/lib/api/listings';
import { useAppTheme } from '@/theme/useAppTheme';
import type { Palette } from '@/theme/tokens';

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
  const { palette } = useAppTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

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
        <Ionicons name="alert-circle-outline" size={48} color={palette.inkMuted} />
        <Text style={styles.errorText}>Не удалось загрузить координаты</Text>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>Назад</Text>
        </Pressable>
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
        <Pressable onPress={() => router.back()} style={styles.closeButton}>
          <Ionicons name="close" size={24} color={palette.ink} />
        </Pressable>
      </SafeAreaView>

      {/* Yandex Map */}
      <YaMap
        showUserPosition={false}
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

      {/* Info Card Bottom Sheet */}
      <View style={styles.bottomSheet}>
        {/* Drag handle decorator */}
        <View style={styles.dragHandle} />

        <View style={styles.content}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Расположение</Text>
            <View style={[styles.badge, isFuzzed ? styles.badgeFuzzed : styles.badgeExact]}>
              <Text style={[styles.badgeText, isFuzzed ? styles.badgeTextFuzzed : styles.badgeTextExact]}>
                {isFuzzed ? 'Приблизительное' : 'Точный адрес'}
              </Text>
            </View>
          </View>

          <Text style={styles.addressText}>
            {data.city}, {data.address}
          </Text>

          {isFuzzed && (
            <View style={styles.privacyNotice}>
              <Ionicons name="information-circle-outline" size={18} color="#FF5A1F" style={{ marginRight: 6 }} />
              <Text style={styles.privacyNoticeText}>
                Точный адрес и инструкции по заселению будут доступны после подтверждения бронирования.
              </Text>
            </View>
          )}

          <Pressable onPress={handleBuildRoute} style={styles.actionButton}>
            <Ionicons name="navigate-outline" size={20} color="white" style={{ marginRight: 8 }} />
            <Text style={styles.actionButtonText}>Построить маршрут</Text>
          </Pressable>
        </View>
      </View>
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
  errorText: {
    fontSize: 16,
    color: palette.inkSecondary,
    marginTop: 12,
    marginBottom: 24,
    textAlign: 'center',
  },
  backButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: '#FF5A1F',
  },
  backButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  map: {
    flex: 1,
    height: '55%',
  },
  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: 16,
    pointerEvents: 'box-none',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: palette.overlaySurface,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  bottomSheet: {
    backgroundColor: palette.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 10,
    paddingBottom: 34,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 16,
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.line,
    alignSelf: 'center',
    marginBottom: 16,
  },
  content: {
    paddingHorizontal: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: palette.ink,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
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
    fontSize: 15,
    color: palette.inkSecondary,
    lineHeight: 20,
    marginBottom: 16,
  },
  privacyNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: palette.surfaceMuted,
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  },
  privacyNoticeText: {
    flex: 1,
    fontSize: 13,
    color: palette.inkSecondary,
    lineHeight: 18,
  },
  actionButton: {
    flexDirection: 'row',
    height: 50,
    borderRadius: 16,
    backgroundColor: '#FF5A1F',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF5A1F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  actionButtonText: {
    color: 'white',
    fontSize: 15,
    fontWeight: 'bold',
  },
});
