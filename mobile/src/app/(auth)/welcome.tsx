import { router } from 'expo-router';
import { useEffect } from 'react';
import { Text, View } from 'react-native';
import { Image } from 'expo-image';

import { Button, ScreenContainer } from '@/components/ui';
import WelcomeImage from '@/assets/images/welcome_screen.png';
import { useSessionStore } from '@/store/session';

export default function WelcomeScreen() {
  const status = useSessionStore((s) => s.status);
  const continueAsGuest = useSessionStore((s) => s.continueAsGuest);

  // Auto-redirect if user is already authenticated or chosen guest mode
  useEffect(() => {
    if (status === 'authenticated' || status === 'guest') {
      router.replace('/(tabs)');
    }
  }, [status]);

  const handleGuest = async () => {
    await continueAsGuest();
    // The useEffect above will handle the redirect once status changes to 'guest'
  };

  return (
    <ScreenContainer centered className="justify-between items-center">
      <View className="flex-1 w-full justify-center items-center gap-8">
        <View className="w-full items-center">
          <Text className="w-full text-center text-3xl font-bold leading-tight text-ink">
            Найдите квартиру{"\n"}или сдайте свою
          </Text>
          <Text className="w-full mt-3 text-center text-base text-ink-secondary">
            Быстрая аренда жилья{"\n"}в вашем городе
          </Text>
        </View>

        <Image
          source={WelcomeImage}
          style={{ width: '100%', height: 320 }}
          contentFit="contain"
        />
      </View>

      <View className="w-full gap-3 pb-6">
        <Button label="Войти по email" onPress={() => router.push('/email')} />
        <Button label="Найти жилье" variant="secondary" onPress={handleGuest} />
      </View>
    </ScreenContainer>
  );
}
