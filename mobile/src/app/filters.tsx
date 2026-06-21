import { Ionicons } from '@expo/vector-icons';
import { format, parseISO, addDays } from 'date-fns';
import { ru } from 'date-fns/locale';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CalendarRange, type DateRange } from '@/components/CalendarRange';
import { Button, Chip, BottomSheet } from '@/components/ui';
import { CityPickerSheet } from '@/components/CityPickerSheet';
import { useServices } from '@/lib/api/create-listing';
import { filtersToListParams, useListings } from '@/lib/api/listings';
import { useFiltersStore, type RoomFilter, type SearchFilters } from '@/store/filters';
import { palette } from '@/theme/tokens';

const ROOM_OPTIONS: { label: string; value: RoomFilter }[] = [
  { label: 'Студия', value: 'studio' },
  { label: '1', value: '1' },
  { label: '2', value: '2' },
  { label: '3+', value: '3plus' },
];

const PRICE_PRESETS: { label: string; min: number | null; max: number | null }[] = [
  { label: 'до 2 000', min: null, max: 2000 },
  { label: '2 000 – 4 000', min: 2000, max: 4000 },
  { label: '4 000 – 7 000', min: 4000, max: 7000 },
  { label: 'от 7 000', min: 7000, max: null },
];

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function dateRangeLabel(checkIn: string | null, checkOut: string | null): string {
  if (!checkIn || !checkOut) return 'Любые даты';
  try {
    const start = parseISO(checkIn);
    const end = parseISO(checkOut);
    const sm = format(start, 'MMM', { locale: ru }).replace('.', '');
    const em = format(end, 'MMM', { locale: ru }).replace('.', '');
    if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
      return `${start.getDate()} — ${end.getDate()} ${sm}`;
    }
    return `${start.getDate()} ${sm} — ${end.getDate()} ${em}`;
  } catch {
    return 'Любые даты';
  }
}

export default function FiltersScreen() {
  const store = useFiltersStore();
  const { data: services } = useServices();

  // Local draft state; only committed to the store on "Показать".
  const [city, setCity] = useState<string | null>(store.city);
  const [checkIn, setCheckIn] = useState<string | null>(store.checkIn);
  const [checkOut, setCheckOut] = useState<string | null>(store.checkOut);
  const [rooms, setRooms] = useState<RoomFilter[]>(store.rooms);
  const [serviceIds, setServiceIds] = useState<number[]>(store.serviceIds);
  const [priceMin, setPriceMin] = useState(store.priceMin?.toString() ?? '');
  const [priceMax, setPriceMax] = useState(store.priceMax?.toString() ?? '');
  const [guests, setGuests] = useState(store.guests);
  const [petsAllowed, setPetsAllowed] = useState(store.petsAllowed);
  const [childrenAllowed, setChildrenAllowed] = useState(store.childrenAllowed);
  const [eventsAllowed, setEventsAllowed] = useState(store.eventsAllowed);

  // Pickers
  const [citySheet, setCitySheet] = useState(false);
  const [dateSheet, setDateSheet] = useState(false);
  const [tempRange, setTempRange] = useState<DateRange>({ start: null, end: null });

  const draftFilters: SearchFilters = useMemo(
    () => ({
      city,
      checkIn,
      checkOut,
      guests,
      priceMin: priceMin !== '' ? Number(priceMin) : null,
      priceMax: priceMax !== '' ? Number(priceMax) : null,
      rooms,
      serviceIds,
      favoritesOnly: false,
      petsAllowed,
      childrenAllowed,
      eventsAllowed,
    }),
    [city, checkIn, checkOut, guests, priceMin, priceMax, rooms, serviceIds, petsAllowed, childrenAllowed, eventsAllowed],
  );

  // Live result count for the CTA. limit:1 keeps the payload small; total is
  // the full match count.
  const countParams = useMemo(
    () => filtersToListParams(draftFilters, '', { limit: 1 }),
    [draftFilters],
  );
  const { data: countData, isFetching: countLoading } = useListings(countParams);
  const total = countData?.total;

  const priceActive = (min: number | null, max: number | null) =>
    (priceMin !== '' ? Number(priceMin) : null) === min &&
    (priceMax !== '' ? Number(priceMax) : null) === max;

  const apply = () => {
    store.setFilters({
      city,
      checkIn,
      checkOut,
      rooms,
      serviceIds,
      guests,
      priceMin: priceMin !== '' ? Number(priceMin) : null,
      priceMax: priceMax !== '' ? Number(priceMax) : null,
      petsAllowed,
      childrenAllowed,
      eventsAllowed,
    });
    router.back();
  };

  const reset = () => {
    setCity(null);
    setCheckIn(null);
    setCheckOut(null);
    setRooms([]);
    setServiceIds([]);
    setPriceMin('');
    setPriceMax('');
    setGuests(2);
    setPetsAllowed(false);
    setChildrenAllowed(false);
    setEventsAllowed(false);
  };

  const openDateSheet = () => {
    setTempRange({
      start: checkIn ? parseISO(checkIn) : null,
      end: checkOut ? parseISO(checkOut) : null,
    });
    setDateSheet(true);
  };

  const applyDates = () => {
    if (tempRange.start) {
      const startStr = format(tempRange.start, 'yyyy-MM-dd');
      const endStr = tempRange.end
        ? format(tempRange.end, 'yyyy-MM-dd')
        : format(addDays(tempRange.start, 1), 'yyyy-MM-dd');
      setCheckIn(startStr);
      setCheckOut(endStr);
    } else {
      setCheckIn(null);
      setCheckOut(null);
    }
    setDateSheet(false);
  };

  const ctaLabel = countLoading
    ? 'Загрузка…'
    : total != null
      ? `Показать ${total} ${pluralVariants(total)}`
      : 'Показать варианты';

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-surface">
      <View className="flex-row items-center justify-between px-4 py-2">
        <Text className="text-lg font-bold text-ink">Фильтры</Text>
        <Pressable
          accessibilityLabel="Закрыть"
          onPress={() => router.back()}
          className="h-10 w-10 items-center justify-center rounded-full bg-surface-muted">
          <Ionicons name="close" size={22} color={palette.ink} />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="gap-6 px-4 py-4">
        {/* City */}
        <View className="gap-2">
          <Text className="text-base font-semibold text-ink">Город</Text>
          <Pressable
            onPress={() => {
              setCitySheet(true);
            }}
            className="h-12 flex-row items-center justify-between rounded-field border border-line px-3 active:bg-surface-muted">
            <View className="flex-row items-center gap-2">
              <Ionicons name="location-outline" size={18} color={palette.primary} />
              <Text className={`text-base ${city ? 'text-ink' : 'text-ink-muted'}`}>
                {city ?? 'Любой город'}
              </Text>
            </View>
            {city ? (
              <Pressable accessibilityLabel="Очистить город" onPress={() => setCity(null)} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color={palette.inkMuted} />
              </Pressable>
            ) : (
              <Ionicons name="chevron-forward" size={18} color={palette.inkMuted} />
            )}
          </Pressable>
        </View>

        {/* Dates */}
        <View className="gap-2">
          <Text className="text-base font-semibold text-ink">Даты</Text>
          <Pressable
            onPress={openDateSheet}
            className="h-12 flex-row items-center justify-between rounded-field border border-line px-3 active:bg-surface-muted">
            <View className="flex-row items-center gap-2">
              <Ionicons name="calendar-outline" size={18} color={palette.primary} />
              <Text className={`text-base ${checkIn ? 'text-ink' : 'text-ink-muted'}`}>
                {dateRangeLabel(checkIn, checkOut)}
              </Text>
            </View>
            {checkIn ? (
              <Pressable
                accessibilityLabel="Очистить даты"
                onPress={() => {
                  setCheckIn(null);
                  setCheckOut(null);
                }}
                hitSlop={8}>
                <Ionicons name="close-circle" size={18} color={palette.inkMuted} />
              </Pressable>
            ) : (
              <Ionicons name="chevron-forward" size={18} color={palette.inkMuted} />
            )}
          </Pressable>
        </View>

        {/* Price */}
        <View className="gap-2">
          <Text className="text-base font-semibold text-ink">Цена за сутки, ₽</Text>
          <View className="flex-row items-center gap-3">
            <View className="h-12 flex-1 flex-row items-center rounded-field border border-line px-3">
              <Text className="mr-1 text-base text-ink-muted">от</Text>
              <TextInput
                value={priceMin}
                onChangeText={(t) => setPriceMin(t.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={palette.inkMuted}
                className="flex-1 text-base text-ink"
              />
            </View>
            <View className="h-12 flex-1 flex-row items-center rounded-field border border-line px-3">
              <Text className="mr-1 text-base text-ink-muted">до</Text>
              <TextInput
                value={priceMax}
                onChangeText={(t) => setPriceMax(t.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                placeholder="∞"
                placeholderTextColor={palette.inkMuted}
                className="flex-1 text-base text-ink"
              />
            </View>
          </View>
          <View className="flex-row flex-wrap gap-2">
            {PRICE_PRESETS.map((p) => (
              <Chip
                key={p.label}
                label={p.label}
                selected={priceActive(p.min, p.max)}
                onPress={() => {
                  if (priceActive(p.min, p.max)) {
                    setPriceMin('');
                    setPriceMax('');
                  } else {
                    setPriceMin(p.min != null ? String(p.min) : '');
                    setPriceMax(p.max != null ? String(p.max) : '');
                  }
                }}
              />
            ))}
          </View>
        </View>

        {/* Rooms */}
        <View className="gap-2">
          <Text className="text-base font-semibold text-ink">Комнаты</Text>
          <View className="flex-row flex-wrap gap-2">
            {ROOM_OPTIONS.map((o) => (
              <Chip
                key={o.value}
                label={o.label}
                selected={rooms.includes(o.value)}
                onPress={() => setRooms((prev) => toggle(prev, o.value))}
              />
            ))}
          </View>
        </View>

        {/* Guests */}
        <View className="gap-2">
          <Text className="text-base font-semibold text-ink">Гостей</Text>
          <View className="flex-row items-center gap-4">
            <Pressable
              accessibilityLabel="Меньше гостей"
              onPress={() => setGuests((g) => Math.max(1, g - 1))}
              className="h-10 w-10 items-center justify-center rounded-full border border-line">
              <Ionicons name="remove" size={20} color={palette.ink} />
            </Pressable>
            <Text className="min-w-6 text-center text-base font-semibold text-ink">{guests}</Text>
            <Pressable
              accessibilityLabel="Больше гостей"
              onPress={() => setGuests((g) => g + 1)}
              className="h-10 w-10 items-center justify-center rounded-full border border-line">
              <Ionicons name="add" size={20} color={palette.ink} />
            </Pressable>
          </View>
        </View>

        {/* House Rules */}
        <View className="gap-2">
          <Text className="text-base font-semibold text-ink">Правила дома</Text>
          <View className="flex-row flex-wrap gap-2">
            <Chip
              label="Можно с животными"
              selected={petsAllowed}
              onPress={() => setPetsAllowed(!petsAllowed)}
            />
            <Chip
              label="Можно с детьми"
              selected={childrenAllowed}
              onPress={() => setChildrenAllowed(!childrenAllowed)}
            />
            <Chip
              label="Разрешены мероприятия"
              selected={eventsAllowed}
              onPress={() => setEventsAllowed(!eventsAllowed)}
            />
          </View>
        </View>

        {/* Amenities (from the /services catalog) */}
        <View className="gap-2">
          <Text className="text-base font-semibold text-ink">Удобства</Text>
          {services == null ? (
            <ActivityIndicator color={palette.primary} />
          ) : (
            <View className="flex-row flex-wrap gap-2">
              {services.map((s) => (
                <Chip
                  key={s.id}
                  label={s.name}
                  selected={serviceIds.includes(s.id)}
                  onPress={() => setServiceIds((prev) => toggle(prev, s.id))}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      <View className="flex-row gap-3 border-t border-line px-4 py-3">
        <View className="flex-1">
          <Button label="Сбросить" variant="secondary" onPress={reset} />
        </View>
        <View className="flex-[2]">
          <Button label={ctaLabel} onPress={apply} />
        </View>
      </View>

      {/* City picker bottom sheet */}
      <CityPickerSheet
        visible={citySheet}
        onClose={() => setCitySheet(false)}
        onSelect={(selectedCity) => {
          setCity(selectedCity);
          setCitySheet(false);
        }}
        selectedCity={city}
        allowAnyCity={true}
      />

      {/* Date picker bottom sheet */}
      <BottomSheet visible={dateSheet} onClose={() => setDateSheet(false)}>
        <View className="mb-4 flex-row items-center justify-between border-b border-line pb-4">
          <Pressable onPress={() => setTempRange({ start: null, end: null })}>
            <Text className="text-sm font-semibold text-primary">Сбросить</Text>
          </Pressable>
          <Text className="text-lg font-bold text-ink">Выберите даты</Text>
          <Pressable onPress={() => setDateSheet(false)} hitSlop={8}>
            <Ionicons name="close" size={24} color={palette.ink} />
          </Pressable>
        </View>
        <CalendarRange value={tempRange} onChange={setTempRange} />
        <View className="mt-4">
          <Button label="Применить" onPress={applyDates} />
        </View>
      </BottomSheet>
    </SafeAreaView>
  );
}

function pluralVariants(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'вариант';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'варианта';
  return 'вариантов';
}
