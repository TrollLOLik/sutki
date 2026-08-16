import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Button, MaterialSurface, ScreenContainer, Skeleton } from '@/components/ui';
import { ListingCard } from '@/components/ListingCard';
import { confirmMockPayment, usePaymentProducts, usePaymentStatus } from '@/lib/api/payments';
import { useListingPromotions, usePromotionCheckout } from '@/lib/api/promotions';
import { formatRub } from '@/lib/format';
import { env } from '@/lib/env';
import { useListing } from '@/lib/api/listings';
import { useAppTheme } from '@/theme/useAppTheme';
import { goBackOrReplace } from '@/lib/navigation';
import { NavigationBackButton } from '@/components/NavigationBackButton';

function uuid() {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const value = Math.floor(Math.random() * 16);
    return (char === 'x' ? value : (value & 3) | 8).toString(16);
  });
}

function PromotionHeader({ id }: { id: string }) {
  return (
    <View style={styles.header}>
      <NavigationBackButton
        fallback={{ pathname: '/listing/[id]', params: { id } }}
        size={48}
        variant="material"
      />
      <Text style={styles.headerTitle} className="text-ink">Продвижение</Text>
      <View style={styles.headerSpacer} />
    </View>
  );
}

function PromotionLoadingState() {
  return (
    <View style={styles.loadingStack}>
      <View style={styles.loadingOptions}>
        {[0, 1].map((item) => (
          <MaterialSurface key={item} level="raised" radius={22} style={styles.loadingOption}>
            <Skeleton width={44} height={44} radius={22} />
            <Skeleton width="72%" height={16} radius={5} />
            <Skeleton width="92%" height={11} radius={4} />
            <Skeleton width="64%" height={11} radius={4} />
          </MaterialSurface>
        ))}
      </View>
      <Skeleton width="100%" height={54} radius={18} />
      <Skeleton width="100%" height={140} radius={22} />
    </View>
  );
}

type PromotionType = 'boost' | 'highlight';

interface PromotionTypeOptionProps {
  connected: boolean;
  disabled: boolean;
  pending: boolean;
  selected: boolean;
  type: PromotionType;
  onPress: () => void;
}

function PromotionTypeOption({
  connected,
  disabled,
  pending,
  selected,
  type,
  onPress,
}: PromotionTypeOptionProps) {
  const { isDark, palette } = useAppTheme();
  const reduceMotion = useReducedMotion();
  const selection = useSharedValue(selected ? 1 : 0);
  const isBoost = type === 'boost';

  useEffect(() => {
    selection.value = withTiming(selected ? 1 : 0, {
      duration: reduceMotion ? 0 : 210,
      easing: Easing.out(Easing.cubic),
    });
  }, [reduceMotion, selected, selection]);

  const cardStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      selection.value,
      [0, 1],
      [isDark ? '#202329' : '#F0F1F3', palette.primaryLight],
    ),
    borderColor: interpolateColor(
      selection.value,
      [0, 1],
      [isDark ? 'rgba(255,255,255,0.09)' : 'rgba(18,24,32,0.09)', palette.primary],
    ),
  }));
  const iconStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      selection.value,
      [0, 1],
      [palette.surfaceMuted, palette.primary],
    ),
    transform: [{ scale: interpolate(selection.value, [0, 1], [1, 1.04]) }],
  }));
  const checkStyle = useAnimatedStyle(() => ({
    opacity: selection.value,
    transform: [{ scale: interpolate(selection.value, [0, 1], [0.72, 1]) }],
    backgroundColor: palette.primary,
    borderColor: interpolateColor(selection.value, [0, 1], [palette.line, palette.primary]),
  }));

  return (
    <View style={styles.optionCell}>
      <Pressable
        accessibilityRole="radio"
        accessibilityState={{ checked: selected, disabled }}
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => [styles.optionPressable, pressed && styles.pressed]}>
        <Animated.View style={[styles.optionCard, cardStyle]}>
          <View style={styles.optionTop}>
            <Animated.View style={[styles.optionIcon, iconStyle]}>
              <Ionicons
                name={isBoost ? 'trending-up' : 'sparkles-outline'}
                size={21}
                color={selected ? '#FFFFFF' : palette.inkSecondary}
              />
            </Animated.View>
            <Animated.View style={[styles.selectionMark, checkStyle]}>
              <Ionicons name="checkmark" size={14} color="#FFFFFF" />
            </Animated.View>
          </View>

          <Text style={[styles.optionTitle, { color: palette.ink }]} numberOfLines={1}>
            {isBoost ? 'Выше в поиске' : 'Яркая карточка'}
          </Text>
          <Text
            style={[styles.optionDescription, { color: palette.inkSecondary }]}
            numberOfLines={3}>
            {isBoost
              ? 'Приоритет среди продвигаемых объявлений'
              : 'Эффект ЛУЧШЕЕ и заметное оформление'}
          </Text>

          {connected || pending ? (
            <View
              style={[
                styles.optionStatus,
                { backgroundColor: connected ? palette.successLight : palette.surfaceMuted },
              ]}>
              <Ionicons
                name={connected ? 'checkmark-circle' : 'time-outline'}
                size={13}
                color={connected ? palette.success : palette.inkSecondary}
              />
              <Text
                style={[
                  styles.optionStatusText,
                  { color: connected ? palette.success : palette.inkSecondary },
                ]}
                numberOfLines={1}>
                {connected ? 'Подключено' : 'Ожидает оплаты'}
              </Text>
            </View>
          ) : null}
        </Animated.View>
      </Pressable>
    </View>
  );
}

interface DurationOptionProps {
  days: number;
  disabled: boolean;
  selected: boolean;
  onPress: () => void;
}

function DurationOption({ days, disabled, selected, onPress }: DurationOptionProps) {
  const { palette } = useAppTheme();
  const reduceMotion = useReducedMotion();
  const selection = useSharedValue(selected ? 1 : 0);

  useEffect(() => {
    selection.value = withTiming(selected ? 1 : 0, {
      duration: reduceMotion ? 0 : 190,
      easing: Easing.out(Easing.cubic),
    });
  }, [reduceMotion, selected, selection]);

  const backgroundStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      selection.value,
      [0, 1],
      ['rgba(255,255,255,0)', palette.primary],
    ),
    transform: [{ scale: interpolate(selection.value, [0, 1], [0.98, 1]) }],
  }));
  const textStyle = useAnimatedStyle(() => ({
    color: interpolateColor(selection.value, [0, 1], [palette.inkSecondary, '#FFFFFF']),
  }));

  return (
    <View style={styles.durationCell}>
      <Pressable
        accessibilityRole="radio"
        accessibilityState={{ checked: selected, disabled }}
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => [styles.durationPressable, pressed && styles.pressed]}>
        <Animated.View style={[styles.durationOption, backgroundStyle]}>
          <Animated.Text style={[styles.durationText, textStyle]}>
            {days} {days === 1 ? 'день' : 'дней'}
          </Animated.Text>
        </Animated.View>
      </Pressable>
    </View>
  );
}

export default function PromoteListingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  if (!env.paymentsEnabled) {
    return (
      <Redirect
        href={{ pathname: '/listing/[id]', params: { id: String(id) } } as any}
      />
    );
  }

  return <EnabledPromoteListingScreen />;
}

function EnabledPromoteListingScreen() {
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
  const reduceMotion = useReducedMotion();
  const previewHighlight = useSharedValue(0);
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
    previewHighlight.value = withTiming(selectedType === 'highlight' ? 1 : 0, {
      duration: reduceMotion ? 0 : 220,
      easing: Easing.out(Easing.cubic),
    });
  }, [previewHighlight, reduceMotion, selectedType]);

  const highlightedPreviewStyle = useAnimatedStyle(() => ({
    opacity: previewHighlight.value,
  }));

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
        <PromotionHeader id={id} />
        <View style={styles.blockedContainer}>
          <MaterialSurface level="raised" radius={26} style={styles.blockedCard}>
            <View style={[styles.blockedIcon, { backgroundColor: palette.primaryLight }]}>
              <Ionicons name="rocket-outline" size={30} color={palette.primary} />
            </View>
            <Text style={[styles.blockedTitle, { color: palette.ink }]}>Продвижение недоступно</Text>
            <Text style={[styles.blockedText, { color: palette.inkSecondary }]}>
              {listingStatus === 'rejected'
                ? 'Сначала исправьте замечания модерации и отправьте объявление на повторную проверку.'
                : 'Сначала опубликуйте объявление снова.'}
            </Text>
            <Button
              label="Вернуться к объявлению"
              icon="arrow-back-outline"
              onPress={() => goBackOrReplace({ pathname: '/listing/[id]', params: { id } })}
              style={styles.blockedButton}
            />
          </MaterialSurface>
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
      <PromotionHeader id={id} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}>
        <View style={styles.intro}>
          <Text style={[styles.pageTitle, { color: palette.ink }]}>Сделайте объявление заметнее</Text>
          <Text style={[styles.pageSubtitle, { color: palette.inkSecondary }]}>
            Выберите способ и срок. Продвижение начнётся после одобрения объявления модерацией.
          </Text>
        </View>

        {products.isLoading || promotions.isLoading || listing.isLoading ? (
          <PromotionLoadingState />
        ) : (
          <View style={styles.contentStack}>
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: palette.ink }]}>Способ продвижения</Text>
              <View style={styles.optionRow}>
                {(['boost', 'highlight'] as const).map((type) => {
                  return (
                    <PromotionTypeOption
                      key={type}
                      connected={connectedTypes.has(type)}
                      disabled={paymentId != null}
                      pending={pendingTypes.has(type)}
                      selected={selectedType === type}
                      type={type}
                      onPress={() => setSelectedType(type)}
                    />
                  );
                })}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: palette.ink }]}>Срок продвижения</Text>
              <View
                style={[
                  styles.durationSurface,
                  {
                    backgroundColor: palette.surfaceMuted,
                    borderColor: palette.line,
                  },
                ]}>
                {durations.map((days) => {
                  return (
                    <DurationOption
                      key={days}
                      days={days}
                      disabled={paymentId != null}
                      selected={selectedDays === days}
                      onPress={() => setSelectedDays(days)}
                    />
                  );
                })}
              </View>
            </View>

            <View style={styles.section}>
              <View style={styles.previewHeading}>
                <View>
                  <Text style={[styles.sectionTitle, { color: palette.ink }]}>Так увидят гости</Text>
                  <Text style={[styles.sectionCaption, { color: palette.inkSecondary }]}>
                    Превью выбранного оформления
                  </Text>
                </View>
                <View style={[styles.previewBadge, { backgroundColor: palette.primaryLight }]}>
                  <Ionicons name="eye-outline" size={15} color={palette.primary} />
                  <Text style={[styles.previewBadgeText, { color: palette.primary }]}>Превью</Text>
                </View>
              </View>

              <View style={styles.previewTransition}>
                {listing.data ? (
                  <ListingCard
                    listing={{ ...listing.data, promotion_types: ['boost'] }}
                  />
                ) : (
                  <Skeleton width="100%" height={286} radius={20} />
                )}
                <Animated.View
                  pointerEvents="none"
                  style={[styles.highlightedPreviewLayer, highlightedPreviewStyle]}>
                  {listing.data ? (
                    <ListingCard
                      listing={{ ...listing.data, promotion_types: ['highlight'] }}
                    />
                  ) : null}
                </Animated.View>
              </View>
            </View>

            {selectedProduct ? (
              <MaterialSurface level="raised" radius={22} style={styles.summaryCard}>
                <View style={[styles.summaryIcon, { backgroundColor: palette.primaryLight }]}>
                  <Ionicons name="receipt-outline" size={21} color={palette.primary} />
                </View>
                <View style={styles.summaryCopy}>
                  <Text style={[styles.summaryLabel, { color: palette.inkSecondary }]}>
                    Итого за {selectedDays} {selectedDays === 1 ? 'день' : 'дней'}
                  </Text>
                  <Text style={[styles.summaryHint, { color: palette.inkMuted }]}>
                    Одно объявление
                  </Text>
                </View>
                <Text style={[styles.summaryPrice, { color: palette.ink }]}>
                  {formatRub(selectedProduct.amount_kopecks / 100)} ₽
                </Text>
              </MaterialSurface>
            ) : null}

            {selectedTypeConnected || selectedTypePending ? (
              <View
                style={[
                  styles.inlineNotice,
                  {
                    backgroundColor: selectedTypeConnected
                      ? palette.successLight
                      : palette.primaryLight,
                  },
                ]}>
                <Ionicons
                  name={selectedTypeConnected ? 'checkmark-circle-outline' : 'time-outline'}
                  size={20}
                  color={selectedTypeConnected ? palette.success : palette.primary}
                />
                <Text
                  style={[
                    styles.inlineNoticeText,
                    { color: selectedTypeConnected ? palette.success : palette.primary },
                  ]}>
                  {selectedTypeConnected
                    ? 'Этот тип продвижения уже подключён.'
                    : 'Можно продолжить ранее начатую оплату.'}
                </Text>
              </View>
            ) : null}

            {paymentId != null ? (
              <MaterialSurface level="raised" radius={24} style={styles.paymentState}>
                <View
                  style={[
                    styles.paymentStateIcon,
                    {
                      backgroundColor: promotionReady
                        ? palette.successLight
                        : palette.primaryLight,
                    },
                  ]}>
                  <Ionicons
                    name={promotionReady ? 'checkmark-circle' : 'time-outline'}
                    size={30}
                    color={promotionReady ? palette.success : palette.primary}
                  />
                </View>
                <Text style={[styles.paymentStateTitle, { color: palette.ink }]}>
                  {promotionReady
                    ? 'Продвижение подключено'
                    : succeeded
                      ? 'Подключаем продвижение'
                      : 'Ожидаем подтверждение'}
                </Text>
                <Text style={[styles.paymentStateText, { color: palette.inkSecondary }]}>
                  {promotionReady
                    ? 'Карточка уже участвует в продвижении.'
                    : 'Статус обновится автоматически после подтверждения оплаты.'}
                </Text>
                {provider === 'mock' && !succeeded ? (
                  <Button
                    label="Подтвердить тестовую оплату"
                    icon="checkmark-outline"
                    onPress={confirm}
                    style={styles.mockButton}
                  />
                ) : null}
              </MaterialSurface>
            ) : null}

            {error ? (
              <View style={[styles.errorNotice, { backgroundColor: palette.dangerLight }]}>
                <Ionicons name="alert-circle-outline" size={20} color={palette.danger} />
                <Text style={[styles.errorText, { color: palette.danger }]}>{error}</Text>
              </View>
            ) : null}
          </View>
        )}
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: palette.line }]}>
        {promotionReady ? (
          <Button
            label="Готово"
            icon="checkmark-outline"
            onPress={() => goBackOrReplace({ pathname: '/listing/[id]', params: { id } })}
          />
        ) : paymentId == null ? (
          <Button
            label={selectedTypePending ? 'Продолжить оплату' : 'Перейти к оплате'}
            icon="arrow-forward-outline"
            onPress={start}
            loading={checkout.isPending}
            disabled={!selectedCode || selectedTypeConnected}
          />
        ) : null}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    flex: 1,
    paddingHorizontal: 12,
    textAlign: 'center',
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '900',
  },
  headerSpacer: {
    width: 48,
    height: 48,
  },
  scrollContent: {
    paddingTop: 10,
    paddingBottom: 28,
  },
  intro: {
    gap: 7,
    paddingHorizontal: 2,
  },
  pageTitle: {
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '800',
  },
  pageSubtitle: {
    maxWidth: 470,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  contentStack: {
    gap: 24,
    paddingTop: 24,
  },
  section: {
    gap: 11,
  },
  sectionTitle: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '800',
  },
  sectionCaption: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  optionRow: {
    width: '100%',
    flexDirection: 'row',
    gap: 10,
  },
  optionCell: {
    minWidth: 0,
    flexBasis: 0,
    flexGrow: 1,
    flexShrink: 1,
    alignSelf: 'stretch',
  },
  optionPressable: {
    width: '100%',
    flex: 1,
  },
  optionCard: {
    width: '100%',
    minHeight: 168,
    overflow: 'hidden',
    borderWidth: 1,
    borderRadius: 22,
    padding: 14,
  },
  optionTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectionMark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionTitle: {
    marginTop: 13,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '800',
  },
  optionDescription: {
    width: '100%',
    flexShrink: 1,
    marginTop: 4,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '500',
  },
  optionStatus: {
    maxWidth: '100%',
    minHeight: 24,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 10,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  optionStatusText: {
    flexShrink: 1,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.975 }],
  },
  durationSurface: {
    width: '100%',
    flexDirection: 'row',
    gap: 6,
    borderWidth: 1,
    borderRadius: 20,
    padding: 6,
  },
  durationCell: {
    minWidth: 0,
    flexBasis: 0,
    flexGrow: 1,
    flexShrink: 1,
    alignSelf: 'stretch',
  },
  durationPressable: {
    width: '100%',
    flex: 1,
  },
  durationOption: {
    width: '100%',
    flex: 1,
    alignSelf: 'stretch',
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    paddingHorizontal: 8,
  },
  durationText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
  },
  previewHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  previewBadge: {
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 15,
    paddingHorizontal: 10,
  },
  previewBadgeText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
  },
  previewTransition: {
    position: 'relative',
  },
  highlightedPreviewLayer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  summaryCard: {
    minHeight: 82,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 15,
  },
  summaryIcon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryCopy: {
    minWidth: 0,
    flex: 1,
  },
  summaryLabel: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700',
  },
  summaryHint: {
    marginTop: 2,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '500',
  },
  summaryPrice: {
    fontSize: 21,
    lineHeight: 26,
    fontWeight: '900',
  },
  inlineNotice: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  inlineNoticeText: {
    minWidth: 0,
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  paymentState: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 22,
  },
  paymentStateIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentStateTitle: {
    marginTop: 13,
    textAlign: 'center',
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '900',
  },
  paymentStateText: {
    maxWidth: 360,
    marginTop: 5,
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
  },
  mockButton: {
    marginTop: 17,
  },
  errorNotice: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  errorText: {
    minWidth: 0,
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
    paddingBottom: 12,
  },
  blockedContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 40,
  },
  blockedCard: {
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingVertical: 26,
  },
  blockedIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blockedTitle: {
    marginTop: 16,
    textAlign: 'center',
    fontSize: 21,
    lineHeight: 27,
    fontWeight: '900',
  },
  blockedText: {
    marginTop: 7,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  blockedButton: {
    marginTop: 20,
  },
  loadingStack: {
    gap: 18,
    paddingTop: 24,
  },
  loadingOptions: {
    flexDirection: 'row',
    gap: 10,
  },
  loadingOption: {
    minHeight: 178,
    flex: 1,
    gap: 12,
    padding: 14,
  },
});
