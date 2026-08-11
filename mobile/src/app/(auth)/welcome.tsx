import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { MotiView } from 'moti';
import { useEffect } from 'react';
import { ScrollView, Text, useWindowDimensions, View } from 'react-native';

import WelcomeImage from '@/assets/images/welcome_screen.png';
import BrandLogoDark from '@/assets/images/brand-logo-dark.png';
import BrandLogoLight from '@/assets/images/brand-logo-light.png';
import BrandMark from '@/assets/images/brand-mark.png';
import { Button, MaterialSurface, ScreenContainer } from '@/components/ui';
import { useSessionStore } from '@/store/session';
import { useAppTheme } from '@/theme/useAppTheme';

export default function WelcomeScreen() {
  const { fromBooking } = useLocalSearchParams<{ fromBooking?: string }>();
  const status = useSessionStore((s) => s.status);
  const continueAsGuest = useSessionStore((s) => s.continueAsGuest);
  const { height } = useWindowDimensions();
  const { palette, isDark } = useAppTheme();
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
          <Image
            source={isDark ? BrandLogoDark : BrandLogoLight}
            accessibilityLabel="ВИГАЖ"
            style={{ width: 126, height: 30 }}
            contentFit="contain"
          />

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
            Жильё рядом — для посуточной аренды{"\n"}и удобного бронирования
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
              <Image
                source={BrandMark}
                accessibilityIgnoresInvertColors
                style={{ width: 13, height: 15 }}
                contentFit="contain"
              />
              <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '700' }}>
                ВИГАЖ
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
