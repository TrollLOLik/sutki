import { Redirect, router } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { useAppTheme } from '@/theme/useAppTheme';
import { env } from '@/lib/env';

export default function PaymentReturnScreen() {
  if (!env.paymentsEnabled) {
    return <Redirect href={'/(tabs)/profile' as any} />;
  }

  return <EnabledPaymentReturnScreen />;
}

function EnabledPaymentReturnScreen() {
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
