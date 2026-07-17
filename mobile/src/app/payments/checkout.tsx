import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

import { Button, ScreenContainer } from '@/components/ui';
import {
  confirmMockPayment,
  useCreateCheckout,
  usePaymentProducts,
  usePaymentStatus,
} from '@/lib/api/payments';
import { formatRub } from '@/lib/format';
import { useAppTheme } from '@/theme/useAppTheme';
import { goBackOrReplace } from '@/lib/navigation';
import { NavigationBackButton } from '@/components/NavigationBackButton';

function createIdempotencyKey() {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const value = Math.floor(Math.random() * 16);
    return (char === 'x' ? value : (value & 0x3) | 0x8).toString(16);
  });
}

export default function PaymentCheckoutScreen() {
  const { productCode } = useLocalSearchParams<{ productCode?: string }>();
  const { palette } = useAppTheme();
  const products = usePaymentProducts();
  const checkout = useCreateCheckout();
  const [selectedCode, setSelectedCode] = useState(productCode ?? '');
  const [paymentId, setPaymentId] = useState<number | null>(null);
  const [provider, setProvider] = useState<'mock' | 'yookassa' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mockConfirming, setMockConfirming] = useState(false);
  const idempotencyKey = useRef(createIdempotencyKey());
  const payment = usePaymentStatus(paymentId);

  const selected = useMemo(
    () => products.data?.items.find((item) => item.code === selectedCode),
    [products.data?.items, selectedCode],
  );

  useEffect(() => {
    if (!selectedCode && products.data?.items.length) setSelectedCode(products.data.items[0].code);
  }, [products.data?.items, selectedCode]);

  const startCheckout = async () => {
    if (!selectedCode) return;
    setError(null);
    try {
      const result = await checkout.mutateAsync({
        productCode: selectedCode,
        idempotencyKey: idempotencyKey.current,
      });
      setPaymentId(result.payment_id);
      setProvider(result.provider);
      if (result.provider === 'yookassa' && result.confirmation_url) {
        await WebBrowser.openAuthSessionAsync(
          result.confirmation_url,
          Linking.createURL('payments/return'),
          { showInRecents: true },
        );
      }
    } catch {
      setError('Не удалось создать оплату. Попробуйте ещё раз.');
    }
  };

  const confirmMock = async () => {
    if (paymentId == null) return;
    setMockConfirming(true);
    setError(null);
    try {
      await confirmMockPayment(paymentId);
      await payment.refetch();
    } catch {
      setError('Не удалось подтвердить тестовую оплату.');
    } finally {
      setMockConfirming(false);
    }
  };

  const status = payment.data?.status;
  const completed = status === 'succeeded';
  const canceled = status === 'canceled';

  return (
    <ScreenContainer centered>
      <View className="flex-row items-center justify-between py-3">
        <NavigationBackButton fallback="/(tabs)/profile" />
        <Text className="text-lg font-bold text-ink">Оплата</Text>
        <View className="h-11 w-11" />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
        {products.isLoading ? (
          <ActivityIndicator color={palette.primary} className="mt-12" />
        ) : (
          <View className="gap-3 pt-3">
            {products.data?.items.map((item) => {
              const active = item.code === selectedCode;
              return (
                <Pressable
                  key={item.code}
                  disabled={paymentId != null}
                  onPress={() => setSelectedCode(item.code)}
                  className="flex-row items-center border bg-surface p-4 active:opacity-85"
                  style={{ borderRadius: 8, borderColor: active ? palette.primary : palette.line }}>
                  <View className="flex-1 gap-1">
                    <Text className="text-base font-bold text-ink">{item.title}</Text>
                    <Text className="text-sm text-ink-secondary">{item.currency}</Text>
                  </View>
                  <Text className="text-lg font-black text-ink">
                    {formatRub(item.amount_kopecks / 100)} ₽
                  </Text>
                  <Ionicons
                    name={active ? 'radio-button-on' : 'radio-button-off'}
                    size={22}
                    color={active ? palette.primary : palette.inkMuted}
                    style={{ marginLeft: 12 }}
                  />
                </Pressable>
              );
            })}
          </View>
        )}

        {paymentId != null ? (
          <View className="mt-6 items-center gap-3 border-t border-line pt-7">
            <Ionicons
              name={completed ? 'checkmark-circle' : canceled ? 'close-circle' : 'time-outline'}
              size={52}
              color={completed ? palette.success : canceled ? palette.danger : palette.primary}
            />
            <Text className="text-xl font-bold text-ink">
              {completed ? 'Оплата прошла' : canceled ? 'Оплата отменена' : 'Ожидаем подтверждение'}
            </Text>
            {provider === 'mock' && !completed && !canceled ? (
              <Button label="Подтвердить тестовую оплату" onPress={confirmMock} loading={mockConfirming} />
            ) : null}
          </View>
        ) : null}

        {error ? <Text className="mt-4 text-center text-sm text-danger">{error}</Text> : null}
      </ScrollView>

      <View className="border-t border-line bg-surface py-4">
        {completed ? (
          <Button label="Готово" onPress={() => goBackOrReplace('/(tabs)/profile')} />
        ) : paymentId == null ? (
          <Button
            label={selected ? `Оплатить ${formatRub(selected.amount_kopecks / 100)} ₽` : 'Продолжить'}
            onPress={startCheckout}
            loading={checkout.isPending}
            disabled={!selected}
          />
        ) : null}
      </View>
    </ScreenContainer>
  );
}
