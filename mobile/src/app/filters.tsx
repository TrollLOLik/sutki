import { Ionicons } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState, useEffect } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { DatePickerSheet } from '@/components/DatePickerSheet';
import { Button, Chip, RangeSlider } from '@/components/ui';
import { CityPickerSheet } from '@/components/CityPickerSheet';
import { useCategories, useServices } from '@/lib/api/create-listing';
import { filtersToListParams, useListings } from '@/lib/api/listings';
import { useFiltersStore, type ListingSort, type RoomFilter, type SearchFilters } from '@/store/filters';
import { formatGuests } from '@/lib/format';
import { useAppTheme } from '@/theme/useAppTheme';


const ROOM_OPTIONS: { label: string; value: RoomFilter }[] = [
  { label: 'Студия', value: 'studio' },
  { label: '1', value: '1' },
  { label: '2', value: '2' },
  { label: '3', value: '3' },
  { label: '4', value: '4' },
  { label: '5+', value: '5plus' },
];

const PRICE_PRESETS: { label: string; min: number | null; max: number | null }[] = [
  { label: 'до 2 000', min: null, max: 2000 },
  { label: '2 000 – 4 000', min: 2000, max: 4000 },
  { label: '4 000 – 7 000', min: 4000, max: 7000 },
  { label: 'от 7 000', min: 7000, max: null },
];

const SORT_OPTIONS: { label: string; value: ListingSort }[] = [
  { label: 'Сначала новые', value: 'newest' },
  { label: 'Сначала старые', value: 'oldest' },
  { label: 'Популярные', value: 'popular' },
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
  const { palette } = useAppTheme();
  const { ownerId } = useLocalSearchParams<{ ownerId?: string }>();
  const numericOwnerId = ownerId ? Number(ownerId) : null;
  const store = useFiltersStore();
  const { data: services } = useServices();
  const { data: categories } = useCategories();
  const insets = useSafeAreaInsets();

  // Local draft state; only committed to the store on "Показать".
  const [city, setCity] = useState<string | null>(store.city);
  const [checkIn, setCheckIn] = useState<string | null>(store.checkIn);
  const [checkOut, setCheckOut] = useState<string | null>(store.checkOut);
  const [rooms, setRooms] = useState<RoomFilter[]>(store.rooms);
  const [serviceIds, setServiceIds] = useState<number[]>(store.serviceIds);
  const [priceMin, setPriceMin] = useState(store.priceMin?.toString() ?? '');
  const [priceMax, setPriceMax] = useState(store.priceMax?.toString() ?? '');
  const [priceMinQuery, setPriceMinQuery] = useState(store.priceMin?.toString() ?? '');
  const [priceMaxQuery, setPriceMaxQuery] = useState(store.priceMax?.toString() ?? '');
  const [areaMin, setAreaMin] = useState(store.areaMin?.toString() ?? '');
  const [areaMax, setAreaMax] = useState(store.areaMax?.toString() ?? '');
  const [guests, setGuests] = useState(store.guests);
  const [categoryId, setCategoryId] = useState<number | null>(store.categoryId);
  const [smokingAllowed, setSmokingAllowed] = useState(store.smokingAllowed);
  const [petsAllowed, setPetsAllowed] = useState(store.petsAllowed);
  const [childrenAllowed, setChildrenAllowed] = useState(store.childrenAllowed);
  const [eventsAllowed, setEventsAllowed] = useState(store.eventsAllowed);
  const [sort, setSort] = useState<ListingSort>(store.sort);

  // Price formatting helper
  const formatPriceString = (val: string) => {
    const digits = val.replace(/\D/g, '');
    if (!digits) return '';
    return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  };

  // Internal inputs string states
  const [priceMinInput, setPriceMinInput] = useState(priceMin ? formatPriceString(priceMin) : '');
  const [priceMaxInput, setPriceMaxInput] = useState(priceMax ? formatPriceString(priceMax) : '');

  // Synchronise RangeSlider updates to inputs
  useEffect(() => {
    setPriceMinInput(priceMin ? formatPriceString(priceMin) : '');
  }, [priceMin]);

  useEffect(() => {
    setPriceMaxInput(priceMax ? formatPriceString(priceMax) : '');
  }, [priceMax]);

  // Pickers
  const [citySheet, setCitySheet] = useState(false);
  const [dateSheet, setDateSheet] = useState(false);

  const draftFilters: SearchFilters = useMemo(
    () => ({
      sort,
      city,
      checkIn,
      checkOut,
      guests,
      priceMin: priceMinQuery !== '' ? Number(priceMinQuery) : null,
      priceMax: priceMaxQuery !== '' ? Number(priceMaxQuery) : null,
      areaMin: areaMin !== '' ? Number(areaMin) : null,
      areaMax: areaMax !== '' ? Number(areaMax) : null,
      rooms,
      categoryId,
      serviceIds,
      favoritesOnly: false,
      smokingAllowed,
      petsAllowed,
      childrenAllowed,
      eventsAllowed,
    }),
    [sort, city, checkIn, checkOut, guests, priceMinQuery, priceMaxQuery, areaMin, areaMax, rooms, categoryId, serviceIds, smokingAllowed, petsAllowed, childrenAllowed, eventsAllowed],
  );

  // Live result count for the CTA.
  const countParams = useMemo(
    () => filtersToListParams(draftFilters, '', { limit: 1 }),
    [draftFilters],
  );
  const parsedAreaMin = areaMin !== '' ? Number(areaMin) : null;
  const parsedAreaMax = areaMax !== '' ? Number(areaMax) : null;
  const areaRangeInvalid =
    (parsedAreaMin != null && parsedAreaMin > 10_000) ||
    (parsedAreaMax != null && parsedAreaMax > 10_000) ||
    (parsedAreaMin != null && parsedAreaMax != null && parsedAreaMin > parsedAreaMax);
  const { data: countData, isFetching: countLoading } = useListings({
    ...countParams,
    ownerId: numericOwnerId ?? undefined,
  }, { enabled: !areaRangeInvalid });
  const total = countData?.total;
  const isCtaLoading = countLoading;
  const ctaTotal = total;

  const apply = () => {
    if (areaRangeInvalid) return;
    store.setFilters({
      sort,
      city,
      checkIn,
      checkOut,
      rooms,
      serviceIds,
      guests,
      priceMin: priceMin !== '' ? Number(priceMin) : null,
      priceMax: priceMax !== '' ? Number(priceMax) : null,
      areaMin: areaMin !== '' ? Number(areaMin) : null,
      areaMax: areaMax !== '' ? Number(areaMax) : null,
      categoryId,
      smokingAllowed,
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
    setPriceMinQuery('');
    setPriceMaxQuery('');
    setPriceMinInput('');
    setPriceMaxInput('');
    setAreaMin('');
    setAreaMax('');
    setCategoryId(null);
    setGuests(1);
    setSmokingAllowed(false);
    setPetsAllowed(false);
    setChildrenAllowed(false);
    setEventsAllowed(false);
    setSort('newest');
  };


  const ctaLabel = areaRangeInvalid
    ? 'Проверьте диапазон площади'
    : isCtaLoading
    ? 'Загрузка…'
    : ctaTotal != null
      ? `Показать ${ctaTotal} ${pluralVariants(ctaTotal)}`
      : 'Показать варианты';

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-surface">
      {/* Header bar styled like mock */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: palette.line,
        }}
      >
        <Pressable
          accessibilityLabel="Закрыть"
          onPress={() => router.back()}
          style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="close" size={24} color={palette.ink} />
        </Pressable>

        <Text style={{ fontSize: 17, fontWeight: '700', color: palette.ink }}>
          Фильтры
        </Text>

        <Pressable
          accessibilityLabel="Сбросить все фильтры"
          onPress={reset}
          style={{ paddingHorizontal: 4 }}
        >
          <Text style={{ fontSize: 15, fontWeight: '600', color: palette.primary }}>
            Сбросить
          </Text>
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 20, paddingHorizontal: 16, paddingVertical: 16 }}>
        <View style={{ gap: 10 }}>
          <Text style={{ fontSize: 15, fontWeight: '600', color: palette.ink }}>Сортировка</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {SORT_OPTIONS.map((option) => {
              const selected = sort === option.value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => setSort(option.value)}
                  style={{
                    flex: 1,
                    minHeight: 44,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: selected ? palette.primary : palette.line,
                    backgroundColor: selected ? palette.primaryLight : palette.surface,
                    paddingHorizontal: 8,
                  }}
                >
                  <Text numberOfLines={2} style={{ textAlign: 'center', fontSize: 12, fontWeight: '700', color: selected ? palette.primary : palette.inkSecondary }}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* City Card */}
        <Pressable
          onPress={() => setCitySheet(true)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: palette.surface,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: palette.line,
            padding: 14,
            gap: 14,
          }}
        >
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: palette.surfaceMuted,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="location-outline" size={20} color={palette.inkSecondary} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ fontSize: 13, color: palette.inkMuted }}>Город</Text>
            <Text style={{ fontSize: 15, fontWeight: '600', color: palette.ink }}>
              {city ?? 'Любой'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={palette.inkMuted} />
        </Pressable>

        {/* Dates Card */}
        <Pressable
          onPress={() => setDateSheet(true)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: palette.surface,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: palette.line,
            padding: 14,
            gap: 14,
          }}
        >
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: palette.surfaceMuted,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="calendar-outline" size={20} color={palette.inkSecondary} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ fontSize: 13, color: palette.inkMuted }}>Даты проживания</Text>
            <Text style={{ fontSize: 15, fontWeight: '600', color: palette.ink }}>
              {dateRangeLabel(checkIn, checkOut)}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={palette.inkMuted} />
        </Pressable>

        {/* Price Section */}
        <View style={{ gap: 12 }}>
          <Text style={{ fontSize: 15, fontWeight: '600', color: palette.ink }}>Цена за сутки, ₽</Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            {/* Min Price Input */}
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: palette.surface, borderRadius: 12, borderWidth: 1, borderColor: palette.line, paddingHorizontal: 16, height: 48 }}>
              <Text style={{ fontSize: 15, color: palette.inkMuted, marginRight: 6 }}>от</Text>
              <TextInput
                value={priceMinInput}
                onChangeText={(t) => {
                  const cleaned = t.replace(/\D/g, '');
                  setPriceMinInput(formatPriceString(cleaned));
                  setPriceMin(cleaned);
                  setPriceMinQuery(cleaned);
                }}
                onBlur={() => {
                  const minVal = priceMin !== '' ? Number(priceMin) : 0;
                  const maxVal = priceMax !== '' ? Number(priceMax) : 15000;
                  const clampedMin = Math.min(Math.max(0, minVal), 15000);
                  setPriceMin(clampedMin.toString());
                  setPriceMinInput(formatPriceString(clampedMin.toString()));
                  setPriceMinQuery(clampedMin.toString());

                  if (clampedMin > maxVal - 500) {
                    const newMax = Math.min(15000, clampedMin + 500);
                    setPriceMax(newMax.toString());
                    setPriceMaxInput(formatPriceString(newMax.toString()));
                    setPriceMaxQuery(newMax.toString());
                  }
                }}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={palette.inkMuted}
                style={{ flex: 1, fontSize: 15, fontWeight: '700', color: palette.ink }}
              />
            </View>

            {/* Max Price Input */}
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: palette.surface, borderRadius: 12, borderWidth: 1, borderColor: palette.line, paddingHorizontal: 16, height: 48 }}>
              <Text style={{ fontSize: 15, color: palette.inkMuted, marginRight: 6 }}>до</Text>
              <TextInput
                value={priceMaxInput}
                onChangeText={(t) => {
                  const cleaned = t.replace(/\D/g, '');
                  setPriceMaxInput(formatPriceString(cleaned));
                  setPriceMax(cleaned);
                  setPriceMaxQuery(cleaned);
                }}
                onBlur={() => {
                  const minVal = priceMin !== '' ? Number(priceMin) : 0;
                  const maxVal = priceMax !== '' ? Number(priceMax) : 15000;
                  const clampedMax = Math.min(Math.max(0, maxVal), 15000);
                  setPriceMax(clampedMax.toString());
                  setPriceMaxInput(formatPriceString(clampedMax.toString()));
                  setPriceMaxQuery(clampedMax.toString());

                  if (clampedMax < minVal + 500) {
                    const newMin = Math.max(0, clampedMax - 500);
                    setPriceMin(newMin.toString());
                    setPriceMinInput(formatPriceString(newMin.toString()));
                    setPriceMinQuery(newMin.toString());
                  }
                }}
                keyboardType="number-pad"
                placeholder="15 000"
                placeholderTextColor={palette.inkMuted}
                style={{ flex: 1, fontSize: 15, fontWeight: '700', color: palette.ink }}
              />
            </View>
          </View>

          {/* Custom Range Slider */}
          <RangeSlider
            min={0}
            max={15000}
            valueMin={priceMin !== '' ? Number(priceMin) : 0}
            valueMax={priceMax !== '' ? Number(priceMax) : 15000}
            onValueChange={({ min: newMin, max: newMax }) => {
              setPriceMin(newMin.toString());
              setPriceMax(newMax.toString());
            }}
            onSlidingComplete={({ min: newMin, max: newMax }) => {
              setPriceMinQuery(newMin.toString());
              setPriceMaxQuery(newMax.toString());
            }}
            step={100}
            minDistance={500}
          />
        </View>

        {/* Area */}
        <View style={{ gap: 12 }}>
          <Text style={{ fontSize: 15, fontWeight: '600', color: palette.ink }}>Площадь, м²</Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            {[
              { value: areaMin, setter: setAreaMin, prefix: 'от', placeholder: '5' },
              { value: areaMax, setter: setAreaMax, prefix: 'до', placeholder: '10 000' },
            ].map((field) => (
              <View
                key={field.prefix}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: palette.surface, borderRadius: 12, borderWidth: 1, borderColor: palette.line, paddingHorizontal: 16, height: 48 }}>
                <Text style={{ fontSize: 15, color: palette.inkMuted, marginRight: 6 }}>{field.prefix}</Text>
                <TextInput
                  value={field.value}
                  onChangeText={(text) => field.setter(text.replace(/\D/g, ''))}
                  keyboardType="number-pad"
                  placeholder={field.placeholder}
                  placeholderTextColor={palette.inkMuted}
                  style={{ flex: 1, fontSize: 15, fontWeight: '700', color: palette.ink }}
                />
              </View>
            ))}
          </View>
        </View>

        {/* Category */}
        <View style={{ gap: 8 }}>
          <Text style={{ fontSize: 15, fontWeight: '600', color: palette.ink }}>Тип жилья</Text>
          {categories == null ? (
            <ActivityIndicator color={palette.primary} />
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {categories.map((category) => (
                <Chip
                  key={category.id}
                  label={category.name}
                  selected={categoryId === category.id}
                  onPress={() => setCategoryId(categoryId === category.id ? null : category.id)}
                />
              ))}
            </View>
          )}
        </View>

        {/* Rooms */}
        <View style={{ gap: 8 }}>
          <Text style={{ fontSize: 15, fontWeight: '600', color: palette.ink }}>Комнаты</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
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
        <View style={{ gap: 8 }}>
          <Text style={{ fontSize: 15, fontWeight: '600', color: palette.ink }}>Гости</Text>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderRadius: 12,
              borderWidth: 1,
              borderColor: palette.line,
              paddingHorizontal: 16,
              paddingVertical: 12,
            }}
          >
            <Text style={{ fontSize: 15, color: palette.ink }}>{formatGuests(guests)}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Меньше гостей"
                disabled={guests <= 1}
                onPress={() => setGuests((g) => Math.max(1, g - 1))}
                style={[
                  {
                    width: 36,
                    height: 36,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 18,
                    borderWidth: 1,
                    borderColor: palette.line,
                  },
                  guests <= 1 ? { opacity: 0.4 } : undefined,
                ]}
              >
                <Ionicons name="remove" size={18} color={palette.ink} />
              </Pressable>
              <Text style={{ width: 24, textAlign: 'center', fontSize: 15, fontWeight: '600', color: palette.ink }}>
                {guests}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Больше гостей"
                disabled={guests >= 100}
                onPress={() => setGuests((g) => Math.min(100, g + 1))}
                style={[
                  {
                    width: 36,
                    height: 36,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 18,
                    borderWidth: 1,
                    borderColor: palette.line,
                  },
                  guests >= 100 ? { opacity: 0.4 } : undefined,
                ]}
              >
                <Ionicons name="add" size={18} color={palette.ink} />
              </Pressable>
            </View>
          </View>
        </View>

        {/* House Rules */}
        <View style={{ gap: 8 }}>
          <Text style={{ fontSize: 15, fontWeight: '600', color: palette.ink }}>Правила дома</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Chip
              label="Можно курить"
              selected={smokingAllowed}
              onPress={() => setSmokingAllowed(!smokingAllowed)}
            />
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

        {/* Amenities */}
        <View style={{ gap: 8 }}>
          <Text style={{ fontSize: 15, fontWeight: '600', color: palette.ink }}>Удобства</Text>
          {services == null ? (
            <ActivityIndicator color={palette.primary} />
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
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

      {/* Sticky footer action button */}
      <View
        style={{
          borderTopWidth: 1,
          borderTopColor: palette.line,
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: insets.bottom > 0 ? insets.bottom : 12,
          backgroundColor: palette.surface,
        }}
      >
        <Button label={ctaLabel} loading={isCtaLoading} disabled={areaRangeInvalid} onPress={apply} />
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

      {/* Date picker */}
      <DatePickerSheet
        visible={dateSheet}
        onClose={() => setDateSheet(false)}
        onApply={(ci, co) => {
          setCheckIn(ci);
          setCheckOut(co);
        }}
        checkIn={checkIn}
        checkOut={checkOut}
      />
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
