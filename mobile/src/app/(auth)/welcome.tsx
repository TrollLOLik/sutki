import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { Image } from 'expo-image';

import { Button, ScreenContainer } from '@/components/ui';
import WelcomeImage from '@/assets/images/welcome_screen.png';

export default function WelcomeScreen() {
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
        <Button label="Продолжить через VK ID" variant="secondary" onPress={() => {}} />
      </View>
    </ScreenContainer>
  );
}
