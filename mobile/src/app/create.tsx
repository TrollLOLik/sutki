import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { MotiView } from 'moti';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Chip, Input } from '@/components/ui';
import {
  useCategories,
  useCreateListing,
  useServices,
  useUpdateListing,
  type NewListingInput,
} from '@/lib/api/create-listing';
import { useListing } from '@/lib/api/listings';
import { env } from '@/lib/env';
import { useCreateListingStore } from '@/store/create-listing';
import { palette } from '@/theme/tokens';

const TOTAL_STEPS = 6;
const LISTING_PRICE_RUB = 199;
const ROOM_OPTIONS = ['1', '2', '3', '4', '5+'];

const STEP_TITLES = [
  'Тип жилья',
  'Адрес',
  'Параметры',
  'Описание',
  'Фотографии',
  'Публикация',
];

async function fetchCitySuggestions(query: string): Promise<string[]> {
  try {
    const res = await fetch(`${env.apiUrl}/api/v1/cities/suggest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        query,
        from_bound: { value: 'city' },
        to_bound: { value: 'city' },
      }),
    });
    const data = await res.json();
    if (data?.suggestions) {
      return data.suggestions
        .map((s: any) => s.data.city)
        .filter((c: any) => c != null && c.length > 0)
        .filter((v: any, i: number, a: any[]) => a.indexOf(v) === i);
    }
  } catch (err) {
    console.error('City suggest error:', err);
  }
  return [];
}

export default function CreateListingScreen() {
  const draft = useCreateListingStore();
  const { data: categories } = useCategories();
  const { data: services } = useServices();
  const createListing = useCreateListing();

  const { editId } = useLocalSearchParams<{ editId?: string }>();
  const isEditing = editId != null && editId.length > 0;
  const editListingId = isEditing ? Number(editId) : undefined;

  const { data: editListing, isLoading: isEditLoading } = useListing(editListingId);
  const updateListing = useUpdateListing();

  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [published, setPublished] = useState(false);

  const [loadedEdit, setLoadedEdit] = useState(false);

  useEffect(() => {
    if (isEditing && editListing && !loadedEdit) {
      useCreateListingStore.setState({
        categoryIds: editListing.categories.map((c) => c.id),
        countRoom: editListing.rooms,
        city: editListing.city,
        street: editListing.street || '',
        houseNumber: editListing.house_number || '',
        area: String(editListing.area),
        price: String(editListing.price),
        serviceIds: editListing.services.map((s) => s.id),
        description: editListing.description,
        photos: editListing.photos.map((p) => p.url),
      });
      setLoadedEdit(true);
    }
  }, [isEditing, editListing, loadedEdit]);

  useEffect(() => {
    if (!isEditing) {
      draft.reset();
    }
  }, [isEditing]);

  // City autocomplete
  const [citySuggestions, setCitySuggestions] = useState<string[]>([]);
  const [cityFocused, setCityFocused] = useState(false);
  const cityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!cityFocused) return;
    if (cityTimer.current) clearTimeout(cityTimer.current);
    if (draft.city.trim().length < 2) {
      setCitySuggestions([]);
      return;
    }
    cityTimer.current = setTimeout(() => {
      fetchCitySuggestions(draft.city.trim()).then(setCitySuggestions);
    }, 300);
    return () => {
      if (cityTimer.current) clearTimeout(cityTimer.current);
    };
  }, [draft.city, cityFocused]);

  const close = () => {
    draft.reset();
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  };

  if (isEditing && isEditLoading) {
    return (
      <SafeAreaView className="flex-1 bg-surface justify-center items-center">
        <ActivityIndicator color={palette.primary} />
      </SafeAreaView>
    );
  }

  const validateStep = (s: number): string | null => {
    switch (s) {
      case 0:
        if (draft.categoryIds.length === 0) return 'Выберите тип жилья';
        if (!draft.countRoom) return 'Укажите количество комнат';
        return null;
      case 1:
        if (draft.city.trim().length < 2) return 'Укажите город';
        if (draft.street.trim().length < 2) return 'Укажите улицу';
        if (draft.houseNumber.trim().length < 1) return 'Укажите номер дома';
        return null;
      case 2:
        if (!(Number(draft.area) > 0)) return 'Укажите площадь';
        if (!(Number(draft.price) > 0)) return 'Укажите цену за ночь';
        return null;
      case 3:
        if (draft.description.trim().length < 10) return 'Добавьте описание (минимум 10 символов)';
        return null;
      default:
        return null;
    }
  };

  const goNext = () => {
    const err = validateStep(step);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  };

  const goBack = () => {
    setError(null);
    if (step === 0) close();
    else setStep((s) => s - 1);
  };

  const handlePublish = async () => {
    setError(null);
    const payload: NewListingInput = {
      city: draft.city.trim(),
      street: draft.street.trim(),
      house_number: draft.houseNumber.trim(),
      description: draft.description.trim(),
      price: Math.round(Number(draft.price)),
      count_room: draft.countRoom.replace('+', ''),
      area: Math.round(Number(draft.area)),
      service_ids: draft.serviceIds,
      category_ids: draft.categoryIds,
    };

    if (isEditing) {
      try {
        await updateListing.mutateAsync({ id: editListingId!, input: payload });
        setPublished(true);
      } catch (e) {
        setError('Не удалось сохранить изменения. Попробуйте ещё раз.');
      }
      return;
    }

    setPaying(true);
    // Payment is a front-end stub for the MVP (no YooKassa yet): simulate the
    // 199 ₽ charge, then create the listing.
    await new Promise((r) => setTimeout(r, 900));
    try {
      await createListing.mutateAsync(payload);
      setPaying(false);
      setPublished(true);
    } catch (e) {
      setPaying(false);
      setError('Не удалось опубликовать объявление. Попробуйте ещё раз.');
    }
  };

  const progress = useMemo(() => (step + 1) / TOTAL_STEPS, [step]);

  if (published) {
    return (
      <SafeAreaView className="flex-1 bg-surface">
        <View className="flex-1 items-center justify-center px-6">
          <MotiView
            from={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', damping: 12 }}
            className="h-20 w-20 items-center justify-center rounded-full bg-success-light">
            <Ionicons name="checkmark" size={44} color={palette.success} />
          </MotiView>
          <Text className="mt-6 text-center text-2xl font-bold text-ink">
            {isEditing ? 'Объявление обновлено!' : 'Объявление опубликовано!'}
          </Text>
          <Text className="mt-2 text-center text-base text-ink-secondary">
            {isEditing
              ? 'Изменения уже видны в поиске. Управлять им можно в разделе «Мои объявления».'
              : 'Оно уже доступно в поиске. Управлять им можно в разделе «Мои объявления».'}
          </Text>
          <View style={{ width: '100%', maxWidth: 320, gap: 12, marginTop: 32 }}>
            <Button
              label="Мои объявления"
              onPress={() => {
                draft.reset();
                router.replace('/my-listings' as any);
              }}
            />
            <Button
              label="На главную"
              variant="secondary"
              onPress={() => {
                draft.reset();
                router.replace('/(tabs)');
              }}
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top', 'bottom']}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 pb-2 pt-1">
        <Pressable onPress={goBack} className="h-10 w-10 items-center justify-center active:opacity-60">
          <Ionicons name={step === 0 ? 'close' : 'arrow-back'} size={26} color={palette.ink} />
        </Pressable>
        <Text className="text-base font-semibold text-ink">{STEP_TITLES[step]}</Text>
        <Text className="w-10 text-right text-sm font-medium text-ink-muted">
          {step + 1}/{TOTAL_STEPS}
        </Text>
      </View>

      {/* Progress bar */}
      <View className="mx-4 h-1.5 overflow-hidden rounded-pill bg-surface-muted">
        <MotiView
          animate={{ width: `${progress * 100}%` }}
          transition={{ type: 'timing', duration: 250 }}
          className="h-full rounded-pill bg-primary"
        />
      </View>

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 20, paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled">
          {step === 0 && (
            <View className="gap-6">
              <View className="gap-3">
                <Text className="text-base font-semibold text-ink">Какое жильё вы сдаёте?</Text>
                <View className="flex-row flex-wrap gap-2">
                  {(categories ?? []).map((c) => (
                    <Chip
                      key={c.id}
                      label={c.name}
                      selected={draft.categoryIds.includes(c.id)}
                      onPress={() => draft.toggleCategory(c.id)}
                    />
                  ))}
                  {categories == null && <ActivityIndicator color={palette.primary} />}
                </View>
              </View>
              <View className="gap-3">
                <Text className="text-base font-semibold text-ink">Количество комнат</Text>
                <View className="flex-row flex-wrap gap-2">
                  {ROOM_OPTIONS.map((r) => (
                    <Chip
                      key={r}
                      label={r}
                      selected={draft.countRoom === r}
                      onPress={() => draft.setField('countRoom', r)}
                    />
                  ))}
                </View>
              </View>
            </View>
          )}

          {step === 1 && (
            <View className="gap-5">
              <View className="gap-2">
                <Text className="text-sm font-medium text-ink-secondary">Город</Text>
                <Input
                  icon="location-outline"
                  placeholder="Например, Магнитогорск"
                  value={draft.city}
                  onChangeText={(t) => draft.setField('city', t)}
                  onFocus={() => setCityFocused(true)}
                  onBlur={() => setTimeout(() => setCityFocused(false), 150)}
                />
                {cityFocused && citySuggestions.length > 0 && (
                  <View className="overflow-hidden rounded-field border border-line bg-surface">
                    {citySuggestions.slice(0, 5).map((c) => (
                      <Pressable
                        key={c}
                        onPress={() => {
                          draft.setField('city', c);
                          setCitySuggestions([]);
                          setCityFocused(false);
                        }}
                        className="border-b border-line px-4 py-3 active:bg-surface-muted">
                        <Text className="text-sm text-ink">{c}</Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
              <View className="gap-2">
                <Text className="text-sm font-medium text-ink-secondary">Улица</Text>
                <Input
                  icon="map-outline"
                  placeholder="Улица"
                  value={draft.street}
                  onChangeText={(t) => draft.setField('street', t)}
                />
              </View>
              <View className="gap-2">
                <Text className="text-sm font-medium text-ink-secondary">Дом</Text>
                <Input
                  icon="home-outline"
                  placeholder="Номер дома"
                  value={draft.houseNumber}
                  onChangeText={(t) => draft.setField('houseNumber', t)}
                />
              </View>
            </View>
          )}

          {step === 2 && (
            <View className="gap-5">
              <View className="flex-row gap-3">
                <View className="flex-1 gap-2">
                  <Text className="text-sm font-medium text-ink-secondary">Площадь, м²</Text>
                  <Input
                    icon="resize-outline"
                    placeholder="45"
                    keyboardType="number-pad"
                    value={draft.area}
                    onChangeText={(t) => draft.setField('area', t.replace(/[^0-9]/g, ''))}
                  />
                </View>
                <View className="flex-1 gap-2">
                  <Text className="text-sm font-medium text-ink-secondary">Цена за ночь, ₽</Text>
                  <Input
                    icon="cash-outline"
                    placeholder="2500"
                    keyboardType="number-pad"
                    value={draft.price}
                    onChangeText={(t) => draft.setField('price', t.replace(/[^0-9]/g, ''))}
                  />
                </View>
              </View>
              <View className="gap-3">
                <Text className="text-base font-semibold text-ink">Удобства</Text>
                <View className="flex-row flex-wrap gap-2">
                  {(services ?? []).map((s) => (
                    <Chip
                      key={s.id}
                      label={s.name}
                      selected={draft.serviceIds.includes(s.id)}
                      onPress={() => draft.toggleService(s.id)}
                    />
                  ))}
                  {services == null && <ActivityIndicator color={palette.primary} />}
                </View>
              </View>
            </View>
          )}

          {step === 3 && (
            <View className="gap-3">
              <Text className="text-base font-semibold text-ink">Расскажите о жилье</Text>
              <View className="rounded-field border border-line bg-surface px-4 py-3">
                <TextInput
                  placeholder="Опишите квартиру, район, что рядом, правила заселения…"
                  placeholderTextColor={palette.inkMuted}
                  value={draft.description}
                  onChangeText={(t) => draft.setField('description', t)}
                  multiline
                  textAlignVertical="top"
                  style={{ minHeight: 160, fontSize: 15, color: palette.ink }}
                />
              </View>
              <Text className="text-xs text-ink-muted">{draft.description.trim().length} символов</Text>
            </View>
          )}

          {step === 4 && (
            <View className="gap-4">
              <Text className="text-base font-semibold text-ink">Фотографии</Text>
              <View className="items-center justify-center gap-3 rounded-card border border-dashed border-line bg-surface-muted px-6 py-10">
                <Ionicons name="images-outline" size={40} color={palette.inkMuted} />
                <Text className="text-center text-sm text-ink-secondary">
                  Загрузка фотографий появится в одном из следующих обновлений. Сейчас объявление
                  публикуется без фото — вы сможете добавить их позже.
                </Text>
              </View>
              <Text className="text-center text-xs text-ink-muted">Можно пропустить этот шаг.</Text>
            </View>
          )}

          {step === 5 && (
            <View className="gap-5">
              <Text className="text-base font-semibold text-ink">
                {isEditing ? 'Проверьте и сохраните' : 'Проверьте и опубликуйте'}
              </Text>
              <View className="gap-3 rounded-card border border-line bg-surface p-4">
                <SummaryRow label="Адрес" value={`${draft.city}, ${draft.street} ${draft.houseNumber}`} />
                <SummaryRow label="Комнат" value={draft.countRoom} />
                <SummaryRow label="Площадь" value={`${draft.area} м²`} />
                <SummaryRow label="Цена" value={`${draft.price} ₽ / ночь`} />
              </View>
              {!isEditing && (
                <View className="flex-row items-center justify-between rounded-card bg-primary-light p-4">
                  <View className="flex-1 pr-3">
                    <Text className="text-base font-semibold text-ink">Разовая плата за публикацию</Text>
                    <Text className="text-sm text-ink-secondary">
                      Объявление будет активно сразу после оплаты.
                    </Text>
                  </View>
                  <Text className="text-xl font-bold text-primary">{LISTING_PRICE_RUB} ₽</Text>
                </View>
              )}
            </View>
          )}

          {error && <Text className="mt-4 text-sm font-medium text-danger">{error}</Text>}
        </ScrollView>

        {/* Footer */}
        <View className="border-t border-line px-5 pb-2 pt-3">
          {step < TOTAL_STEPS - 1 ? (
            <Button label="Далее" onPress={goNext} />
          ) : (
            <Button
              label={
                isEditing
                  ? (updateListing.isPending ? 'Сохранение…' : 'Сохранить изменения')
                  : (paying ? 'Оплата…' : `Оплатить ${LISTING_PRICE_RUB} ₽ и опубликовать`)
              }
              variant="success"
              loading={isEditing ? updateListing.isPending : (paying || createListing.isPending)}
              onPress={handlePublish}
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between">
      <Text className="text-sm text-ink-secondary">{label}</Text>
      <Text className="flex-1 pl-4 text-right text-sm font-medium text-ink">{value}</Text>
    </View>
  );
}
