import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { MotiView } from 'moti';
import { useEffect } from 'react';
import { ScrollView, Text, useWindowDimensions, View } from 'react-native';

import WelcomeImage from '@/assets/images/welcome_screen.png';
import { Button, MaterialSurface, ScreenContainer } from '@/components/ui';
import { useSessionStore } from '@/store/session';
import { useAppTheme } from '@/theme/useAppTheme';

export default function WelcomeScreen() {
  const { fromBooking } = useLocalSearchParams<{ fromBooking?: string }>();
  const status = useSessionStore((s) => s.status);
  const continueAsGuest = useSessionStore((s) => s.continueAsGuest);
  const { height } = useWindowDimensions();
  const { palette } = useAppTheme();
  const heroHeight = Math.min(268, Math.max(190, Math.round(height * 0.27)));

  // Auto-redirect if user is already authenticated
  useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/(tabs)');
    }
  }, [status]);

  const handleGuest = async () => {
    await continueAsGuest();
    router.replace('/(tabs)');
  };

  return (
    <ScreenContainer centered>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingVertical: 20 }}>
        <MotiView
          from={{ opacity: 0, translateY: 16 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'spring', damping: 19, stiffness: 175 }}
          style={{ width: '100%', alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: 12,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: palette.primaryLight,
              }}>
              <Ionicons name="home-outline" size={19} color={palette.primary} />
            </View>
            <Text style={{ color: palette.ink, fontSize: 17, fontWeight: '800' }}>
              TiTop Аренда
            </Text>
          </View>

          <Text
            style={{
              width: '100%',
              marginTop: 24,
              color: palette.ink,
              textAlign: 'center',
              fontSize: 31,
              lineHeight: 37,
              fontWeight: '800',
              letterSpacing: 0,
            }}>
            Найдите квартиру{"\n"}или сдайте свою
          </Text>
          <Text
            style={{
              width: '100%',
              marginTop: 10,
              color: palette.inkSecondary,
              textAlign: 'center',
              fontSize: 16,
              lineHeight: 23,
            }}>
            Жильё рядом — для коротких поездок{"\n"}и новых бронирований
          </Text>

          <MaterialSurface
            level="raised"
            radius={28}
            style={{
              width: '100%',
              height: heroHeight,
              marginTop: 28,
              overflow: 'hidden',
            }}>
            <Image
              source={WelcomeImage}
              accessibilityLabel="Интерьер с диваном"
              style={{ width: '100%', height: '100%' }}
              contentFit="cover"
              transition={220}
            />
            <View
              style={{
                position: 'absolute',
                left: 14,
                bottom: 14,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 7,
                paddingHorizontal: 12,
                height: 36,
                borderRadius: 14,
                backgroundColor: 'rgba(13,14,17,0.78)',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.14)',
              }}>
              <Ionicons name="location-outline" size={17} color={palette.primary} />
              <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '700' }}>
                Дом рядом
              </Text>
            </View>
          </MaterialSurface>
        </MotiView>
      </ScrollView>

      <MotiView
        from={{ opacity: 0, translateY: 12 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'spring', damping: 20, stiffness: 180, delay: 100 }}
        style={{ width: '100%', gap: 10, paddingTop: 8, paddingBottom: 8 }}>
        <Button
          label="Войти по телефону"
          icon="call-outline"
          onPress={() => router.push({ pathname: '/phone', params: { fromBooking: fromBooking ?? '' } } as any)}
        />
        <Button
          label="Войти по email"
          icon="mail-outline"
          variant="secondary"
          onPress={() => router.push({ pathname: '/email', params: { fromBooking: fromBooking ?? '' } } as any)}
        />
        <Button label="Найти жильё" icon="search-outline" variant="ghost" onPress={handleGuest} />
      </MotiView>
    </ScreenContainer>
  );
}
