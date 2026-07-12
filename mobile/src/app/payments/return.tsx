import { router } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { useAppTheme } from '@/theme/useAppTheme';

export default function PaymentReturnScreen() {
  const { palette } = useAppTheme();
  useEffect(() => {
    router.replace('/payments/checkout');
  }, []);
  return (
    <View className="flex-1 items-center justify-center bg-surface">
      <ActivityIndicator color={palette.primary} />
    </View>
  );
}
