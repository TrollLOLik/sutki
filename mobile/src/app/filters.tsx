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
import { useServices } from '@/lib/api/create-listing';
import { filtersToListParams, useListings } from '@/lib/api/listings';
import { useFiltersStore, type RoomFilter, type SearchFilters } from '@/store/filters';
import { formatGuests } from '@/lib/format';
import { useAppTheme } from '@/theme/useAppTheme';


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
  const { palette } = useAppTheme();
  const { ownerId } = useLocalSearchParams<{ ownerId?: string }>();
  const numericOwnerId = ownerId ? Number(ownerId) : null;
  const store = useFiltersStore();
  const { data: services } = useServices();
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
  const [guests, setGuests] = useState(store.guests);
  const [petsAllowed, setPetsAllowed] = useState(store.petsAllowed);
  const [childrenAllowed, setChildrenAllowed] = useState(store.childrenAllowed);
  const [eventsAllowed, setEventsAllowed] = useState(store.eventsAllowed);

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
      city,
      checkIn,
      checkOut,
      guests,
      priceMin: priceMinQuery !== '' ? Number(priceMinQuery) : null,
      priceMax: priceMaxQuery !== '' ? Number(priceMaxQuery) : null,
      rooms,
      serviceIds,
      favoritesOnly: false,
      petsAllowed,
      childrenAllowed,
      eventsAllowed,
    }),
    [city, checkIn, checkOut, guests, priceMinQuery, priceMaxQuery, rooms, serviceIds, petsAllowed, childrenAllowed, eventsAllowed],
  );

  // Live result count for the CTA.
  const countParams = useMemo(
    () => filtersToListParams(draftFilters, '', { limit: 1 }),
    [draftFilters],
  );
  // Global search count
  const { data: countData, isFetching: countLoading } = useListings(countParams, { enabled: !numericOwnerId });
  const total = countData?.total;

  // Host search count (fetch up to 100 listings and filter locally)
  const { data: allListingsData, isLoading: allListingsLoading } = useListings(
    { limit: 100 },
    { enabled: !!numericOwnerId }
  );

  const localFilteredTotal = useMemo(() => {
    if (!numericOwnerId) return null;
    const allItems = allListingsData?.items ?? [];
    let list = allItems.filter((item) => item.owner_id === numericOwnerId);

    if (city) {
      list = list.filter((item) => item.city.toLowerCase().includes(city.toLowerCase()));
    }
    if (priceMinQuery !== '') {
      list = list.filter((item) => item.price >= Number(priceMinQuery));
    }
    if (priceMaxQuery !== '') {
      list = list.filter((item) => item.price <= Number(priceMaxQuery));
    }
    if (rooms.length > 0) {
      list = list.filter((item) => {
        const itemRooms = parseInt(item.rooms, 10);
        const roomsCount = isNaN(itemRooms) ? 0 : itemRooms;
        return rooms.some((r) => {
          if (r === 'studio') return roomsCount === 0;
          if (r === '1') return roomsCount === 1;
          if (r === '2') return roomsCount === 2;
          if (r === '3plus') return roomsCount >= 3;
          return false;
        });
      });
    }
    if (guests) {
      list = list.filter((item) => item.max_guests === null || item.max_guests >= guests);
    }

    return list.length;
  }, [numericOwnerId, allListingsData, city, priceMinQuery, priceMaxQuery, rooms, guests]);

  const isCtaLoading = numericOwnerId ? allListingsLoading : countLoading;
  const ctaTotal = numericOwnerId ? localFilteredTotal : total;

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
    setPriceMinQuery('');
    setPriceMaxQuery('');
    setPriceMinInput('');
    setPriceMaxInput('');
    setGuests(2);
    setPetsAllowed(false);
    setChildrenAllowed(false);
    setEventsAllowed(false);
  };


  const ctaLabel = isCtaLoading
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
        {/* City Card */}
        <Pressable
          onPress={() => setCitySheet(true)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#FFFFFF',
            borderRadius: 14,
            borderWidth: 1,
            borderColor: '#E8E8E8',
            padding: 14,
            gap: 14,
          }}
        >
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: '#F5F6F8',
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
            backgroundColor: '#FFFFFF',
            borderRadius: 14,
            borderWidth: 1,
            borderColor: '#E8E8E8',
            padding: 14,
            gap: 14,
          }}
        >
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: '#F5F6F8',
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
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E8E8E8', paddingHorizontal: 16, height: 48 }}>
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
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E8E8E8', paddingHorizontal: 16, height: 48 }}>
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
              borderColor: '#E8E8E8',
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
                    borderColor: '#E8E8E8',
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
                onPress={() => setGuests((g) => g + 1)}
                style={{
                  width: 36,
                  height: 36,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 18,
                  borderWidth: 1,
                  borderColor: '#E8E8E8',
                }}
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
        <Button label={ctaLabel} loading={isCtaLoading} onPress={apply} />
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
