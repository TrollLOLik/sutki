import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

import { Button, ScreenContainer } from '@/components/ui';
import { confirmMockPayment, usePaymentProducts, usePaymentStatus } from '@/lib/api/payments';
import { useListingPromotions, usePromotionCheckout } from '@/lib/api/promotions';
import { formatRub } from '@/lib/format';
import { useListing } from '@/lib/api/listings';
import { useAppTheme } from '@/theme/useAppTheme';
import { goBackOrReplace } from '@/lib/navigation';

function uuid() {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const value = Math.floor(Math.random() * 16);
    return (char === 'x' ? value : (value & 3) | 8).toString(16);
  });
}

export default function PromoteListingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const houseId = Number(id);
  const { palette } = useAppTheme();
  const queryClient = useQueryClient();
  const products = usePaymentProducts();
  const listing = useListing(Number.isFinite(houseId) ? houseId : undefined);
  const promotions = useListingPromotions(houseId);
  const checkout = usePromotionCheckout(houseId);
  const options = useMemo(
    () => products.data?.items.filter((product) => product.purpose === 'listing_promotion') ?? [],
    [products.data],
  );
  const [selectedType, setSelectedType] = useState<'boost' | 'highlight'>('boost');
  const [selectedDays, setSelectedDays] = useState(7);
  const [paymentId, setPaymentId] = useState<number | null>(null);
  const [provider, setProvider] = useState<'mock' | 'yookassa' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const idempotencyKey = useRef(uuid());
  const payment = usePaymentStatus(paymentId);
  const succeeded = payment.data?.status === 'succeeded';
  const connectedTypes = useMemo(
    () => new Set<string>(
      (promotions.data?.items ?? [])
        .filter((promotion) => ['active', 'paused'].includes(promotion.status))
        .map((promotion) => promotion.type),
    ),
    [promotions.data],
  );
  const pendingTypes = useMemo(
    () => new Set<string>(
      (promotions.data?.items ?? [])
        .filter((promotion) => promotion.status === 'pending_payment')
        .map((promotion) => promotion.type),
    ),
    [promotions.data],
  );
  const durations = useMemo(
    () => [...new Set(options
      .filter((option) => option.service_type === selectedType)
      .map((option) => Math.round((option.duration_seconds ?? 0) / 86400))
      .filter((days) => days > 0))].sort((a, b) => a - b),
    [options, selectedType],
  );
  const selectedProduct = options.find(
    (option) => option.service_type === selectedType
      && Math.round((option.duration_seconds ?? 0) / 86400) === selectedDays,
  ) ?? options.find((option) => option.service_type === selectedType);
  const selectedCode = selectedProduct?.code ?? '';
  const selectedTypeConnected = connectedTypes.has(selectedType);
  const selectedTypePending = pendingTypes.has(selectedType);
  const promotionReady = selectedTypeConnected;
  const listingStatus = listing.data?.status;
  const promotionBlocked = listingStatus === 'rejected' || listingStatus === 'unpublished';

  useEffect(() => {
    if (durations.length > 0 && !durations.includes(selectedDays)) {
      setSelectedDays(durations[0]);
    }
  }, [durations, selectedDays]);

  useEffect(() => {
    if (paymentId == null && selectedCode) {
      idempotencyKey.current = uuid();
    }
  }, [paymentId, selectedCode]);

  useEffect(() => {
    if (!succeeded) return;
    queryClient.invalidateQueries({ queryKey: ['listings'] });
    queryClient.invalidateQueries({ queryKey: ['listing-promotions', houseId] });
  }, [houseId, queryClient, succeeded]);

  useEffect(() => {
    if (!succeeded || promotionReady) return;
    const timer = setInterval(() => promotions.refetch(), 1000);
    return () => clearInterval(timer);
  }, [promotionReady, promotions, succeeded]);

  if (promotionBlocked) {
    return (
      <ScreenContainer centered>
        <View className="flex-row items-center justify-between py-3">
          <Pressable onPress={() => goBackOrReplace({ pathname: '/listing/[id]', params: { id } })} accessibilityLabel="Назад" className="h-11 w-11 items-center justify-center rounded-full active:bg-surface-muted">
            <Ionicons name="chevron-back" size={26} color={palette.ink} />
          </Pressable>
          <Text className="text-lg font-bold text-ink">Продвижение</Text>
          <View className="h-11 w-11" />
        </View>
        <View className="flex-1 items-center justify-center px-6">
          <View className="h-16 w-16 items-center justify-center rounded-full bg-surface-muted">
            <Ionicons name="rocket-outline" size={30} color={palette.inkSecondary} />
          </View>
          <Text className="mt-5 text-center text-xl font-bold text-ink">Продвижение недоступно</Text>
          <Text className="mt-2 text-center text-sm leading-5 text-ink-secondary">
            {listingStatus === 'rejected'
              ? 'Сначала исправьте замечания модерации и отправьте объявление на повторную проверку.'
              : 'Сначала опубликуйте объявление снова.'}
          </Text>
          <Button label="Вернуться к объявлению" onPress={() => goBackOrReplace({ pathname: '/listing/[id]', params: { id } })} className="mt-6 w-full" />
        </View>
      </ScreenContainer>
    );
  }

  const start = async () => {
    if (!selectedCode) return;
    setError(null);
    try {
      const result = await checkout.mutateAsync({
        productCode: selectedCode,
        idempotencyKey: idempotencyKey.current,
      });
      setPaymentId(result.payment.payment_id);
      setProvider(result.payment.provider);
      if (result.payment.provider === 'yookassa' && result.payment.confirmation_url) {
        await WebBrowser.openAuthSessionAsync(
          result.payment.confirmation_url,
          Linking.createURL('payments/return'),
          { showInRecents: true },
        );
      }
    } catch {
      setError('Не удалось создать оплату продвижения.');
    }
  };

  const confirm = async () => {
    if (paymentId == null) return;
    try {
      await confirmMockPayment(paymentId);
      await payment.refetch();
    } catch {
      setError('Не удалось подтвердить тестовую оплату.');
    }
  };

  return (
    <ScreenContainer centered>
      <View className="flex-row items-center justify-between py-3">
        <Pressable onPress={() => goBackOrReplace({ pathname: '/listing/[id]', params: { id } })} accessibilityLabel="Назад" className="h-11 w-11 items-center justify-center rounded-full active:bg-surface-muted">
          <Ionicons name="chevron-back" size={26} color={palette.ink} />
        </Pressable>
        <Text className="text-lg font-bold text-ink">Продвижение</Text>
        <View className="h-11 w-11" />
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <Text className="mt-3 text-xl font-black text-ink">Как продвигать</Text>
        <Text className="mt-2 text-sm leading-5 text-ink-secondary">
          Выберите способ и срок. Продвижение начнётся после одобрения объявления модерацией.
        </Text>
        {products.isLoading || promotions.isLoading ? (
          <ActivityIndicator color={palette.primary} className="mt-10" />
        ) : (
          <View className="mt-5">
            <View className="flex-row gap-2">
              {(['boost', 'highlight'] as const).map((type) => {
                const active = selectedType === type;
                const existing = connectedTypes.has(type);
                const pending = pendingTypes.has(type);
                return (
                  <Pressable
                    key={type}
                    disabled={paymentId != null}
                    onPress={() => setSelectedType(type)}
                    className="flex-1 border bg-surface p-3 active:opacity-85"
                    style={{ borderRadius: 8, borderColor: active ? palette.primary : palette.line }}>
                    <Ionicons name={type === 'boost' ? 'trending-up' : 'color-wand-outline'} size={22} color={active ? palette.primary : palette.inkSecondary} />
                    <Text className="mt-2 text-sm font-bold text-ink">{type === 'boost' ? 'Выше в поиске' : 'Яркая карточка'}</Text>
                    <Text className="mt-1 text-xs leading-4 text-ink-secondary">{type === 'boost' ? 'Приоритет в промо-позициях' : 'Рамка и заметная метка'}</Text>
                    {existing ? <Text className="mt-2 text-xs font-semibold text-primary">Подключено</Text> : null}
                    {pending ? <Text className="mt-2 text-xs font-semibold text-primary">Оплата не завершена</Text> : null}
                  </Pressable>
                );
              })}
            </View>

            <Text className="mb-2 mt-6 text-sm font-bold text-ink">Срок продвижения</Text>
            <View className="flex-row rounded-field bg-surface-muted p-1">
              {durations.map((days) => (
                <Pressable
                  key={days}
                  disabled={paymentId != null}
                  onPress={() => setSelectedDays(days)}
                  className="h-10 flex-1 items-center justify-center rounded-field"
                  style={{ backgroundColor: selectedDays === days ? palette.surface : 'transparent' }}>
                  <Text style={{ color: selectedDays === days ? palette.ink : palette.inkSecondary, fontWeight: '700' }}>
                    {days} {days === 1 ? 'день' : 'дней'}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text className="mb-2 mt-6 text-sm font-bold text-ink">Так увидят гости</Text>
            <View
              className="flex-row overflow-hidden bg-surface"
              style={{ borderRadius: 8, borderWidth: selectedType === 'highlight' ? 2 : 1, borderColor: selectedType === 'highlight' ? palette.primary : palette.line }}>
              <Image source={listing.data?.cover_url} style={{ width: 112, minHeight: 108, backgroundColor: palette.surfaceMuted }} contentFit="cover" />
              <View className="flex-1 p-3">
                <View className="self-start rounded-field bg-primary px-2 py-1">
                  <Text className="text-xs font-bold text-white">Продвигается</Text>
                </View>
                <Text className="mt-2 text-base font-black text-ink">{listing.data ? `${formatRub(listing.data.price)} ₽ за сутки` : 'Ваше объявление'}</Text>
                <Text className="mt-1 text-xs text-ink-secondary" numberOfLines={2}>{listing.data?.address ?? 'После публикации здесь будет превью карточки'}</Text>
              </View>
            </View>

            {selectedProduct ? (
              <View className="mt-5 flex-row items-center justify-between border-t border-line pt-4">
                <Text className="text-sm text-ink-secondary">Итого за {selectedDays} {selectedDays === 1 ? 'день' : 'дней'}</Text>
                <Text className="text-xl font-black text-ink">{formatRub(selectedProduct.amount_kopecks / 100)} ₽</Text>
              </View>
            ) : null}
            {selectedTypeConnected ? <Text className="mt-3 text-sm text-primary">Этот тип продвижения уже подключён.</Text> : null}
            {selectedTypePending ? <Text className="mt-3 text-sm text-primary">Можно продолжить ранее начатую оплату.</Text> : null}
          </View>
        )}
        {paymentId != null ? (
          <View className="mt-8 items-center gap-3 border-t border-line pt-7">
            <Ionicons name={promotionReady ? 'checkmark-circle' : 'time-outline'} size={52} color={promotionReady ? palette.success : palette.primary} />
            <Text className="text-xl font-bold text-ink">{promotionReady ? 'Продвижение подключено' : succeeded ? 'Подключаем продвижение' : 'Ожидаем подтверждение'}</Text>
            {provider === 'mock' && !succeeded ? <Button label="Подтвердить тестовую оплату" onPress={confirm} /> : null}
          </View>
        ) : null}
        {error ? <Text className="mt-4 text-center text-sm text-danger">{error}</Text> : null}
      </ScrollView>
      <View className="border-t border-line py-4">
        {promotionReady ? <Button label="Готово" onPress={() => goBackOrReplace({ pathname: '/listing/[id]', params: { id } })} /> : paymentId == null ? <Button label={selectedTypePending ? 'Продолжить оплату' : 'Перейти к оплате'} onPress={start} loading={checkout.isPending} disabled={!selectedCode || selectedTypeConnected} /> : null}
      </View>
    </ScreenContainer>
  );
}
