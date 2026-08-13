import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState, useEffect } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { DatePickerSheet } from '@/components/DatePickerSheet';
import { KeyboardAwareForm } from '@/components/KeyboardAwareForm';
import { Button, Chip, Counter, IconButton, Input, MaterialSurface, RangeSlider, Switch } from '@/components/ui';
import { CityPickerSheet } from '@/components/CityPickerSheet';
import { useCategories, useServices } from '@/lib/api/create-listing';
import { useFavoriteIds } from '@/lib/api/favorites';
import { filtersToListParams, useListings } from '@/lib/api/listings';
import {
  useFiltersStore,
  useMyListingFiltersStore,
  type ListingSort,
  type MyListingStatus,
  type RoomFilter,
  type SearchFilters,
} from '@/store/filters';
import { formatGuests } from '@/lib/format';
import { useAppTheme } from '@/theme/useAppTheme';
import { goBackOrReplace } from '@/lib/navigation';
import { useSessionStore } from '@/store/session';


const ROOM_OPTIONS: { label: string; value: RoomFilter }[] = [
  { label: 'Студия', value: 'studio' },
  { label: '1', value: '1' },
  { label: '2', value: '2' },
  { label: '3', value: '3' },
  { label: '4', value: '4' },
  { label: '5+', value: '5plus' },
];

const SORT_OPTIONS: { label: string; value: ListingSort }[] = [
  { label: 'Сначала новые', value: 'newest' },
  { label: 'Сначала старые', value: 'oldest' },
  { label: 'Популярные', value: 'popular' },
];

const STATUS_OPTIONS: { label: string; value: MyListingStatus }[] = [
  { label: 'Опубликовано', value: 'active' },
  { label: 'Снято', value: 'unpublished' },
  { label: 'На проверке', value: 'pending_moderation' },
  { label: 'Доп. проверка', value: 'moderation_review' },
  { label: 'Отклонено', value: 'rejected' },
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
  const { palette, isDark } = useAppTheme();
  const screenBackground = isDark ? '#0D0F12' : '#F4F5F7';
  const headerBackground = isDark ? '#14161B' : '#FFFFFF';
  const { ownerId, scope, q } = useLocalSearchParams<{ ownerId?: string; scope?: string; q?: string }>();
  const isMine = scope === 'mine';
  const numericOwnerId = ownerId ? Number(ownerId) : null;
  const searchStore = useFiltersStore();
  const myListingStore = useMyListingFiltersStore();
  const store = isMine ? myListingStore : searchStore;
  const { data: services } = useServices();
  const { data: categories } = useCategories();
  const { data: favoriteIds } = useFavoriteIds();
  const currentUserId = useSessionStore((state) =>
    state.status === 'authenticated' ? state.user?.id ?? null : null,
  );
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
  const [favoritesOnly, setFavoritesOnly] = useState(store.favoritesOnly);
  const [showOwnListings, setShowOwnListings] = useState(store.showOwnListings);
  const [statuses, setStatuses] = useState<MyListingStatus[]>(
    isMine ? myListingStore.statuses : [],
  );

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
      favoritesOnly,
      showOwnListings,
      smokingAllowed,
      petsAllowed,
      childrenAllowed,
      eventsAllowed,
    }),
    [sort, city, checkIn, checkOut, guests, priceMinQuery, priceMaxQuery, areaMin, areaMax, rooms, categoryId, serviceIds, favoritesOnly, showOwnListings, smokingAllowed, petsAllowed, childrenAllowed, eventsAllowed],
  );

  // Live result count for the CTA.
  const countParams = useMemo(() => {
    const params = filtersToListParams(draftFilters, q ?? '', { limit: 1 });
    if (favoritesOnly && favoriteIds) params.houseIds = Array.from(favoriteIds);
    return params;
  }, [draftFilters, favoriteIds, favoritesOnly, q]);
  const favoritesOnlyEmpty = favoritesOnly && favoriteIds != null && favoriteIds.size === 0;
  const parsedAreaMin = areaMin !== '' ? Number(areaMin) : null;
  const parsedAreaMax = areaMax !== '' ? Number(areaMax) : null;
  const areaRangeInvalid =
    (parsedAreaMin != null && parsedAreaMin > 10_000) ||
    (parsedAreaMax != null && parsedAreaMax > 10_000) ||
    (parsedAreaMin != null && parsedAreaMax != null && parsedAreaMin > parsedAreaMax);
  const { data: countData, isFetching: countLoading } = useListings({
    ...countParams,
    ownerId: numericOwnerId ?? undefined,
  }, { enabled: !isMine && !areaRangeInvalid && !favoritesOnlyEmpty });
  const excludeOwnListings =
    !isMine && numericOwnerId == null && currentUserId != null && !showOwnListings;
  const { data: ownCountData, isFetching: ownCountLoading } = useListings(
    { ...countParams, ownerId: currentUserId ?? undefined },
    { enabled: excludeOwnListings && !areaRangeInvalid && !favoritesOnlyEmpty },
  );
  const total = favoritesOnlyEmpty
    ? 0
    : countData?.total == null
      ? undefined
      : Math.max(0, countData.total - (excludeOwnListings ? ownCountData?.total ?? 0 : 0));
  const isCtaLoading =
    countLoading ||
    (excludeOwnListings && ownCountLoading) ||
    (favoritesOnly && favoriteIds == null);
  const ctaTotal = total;

  const apply = () => {
    if (areaRangeInvalid) return;
    const nextFilters: SearchFilters = {
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
      favoritesOnly,
      showOwnListings,
    };
    if (isMine) {
      myListingStore.setFilters({ ...nextFilters, statuses });
      goBackOrReplace('/my-listings');
      return;
    }
    searchStore.setFilters(nextFilters);
    goBackOrReplace('/(tabs)');
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
    setFavoritesOnly(false);
    setShowOwnListings(false);
    setSort('newest');
    setStatuses([]);
  };


  const ctaLabel = areaRangeInvalid
    ? 'Проверьте диапазон площади'
    : isMine
    ? 'Применить фильтры'
    : isCtaLoading
    ? 'Загрузка…'
    : ctaTotal != null
      ? `Показать ${ctaTotal} ${pluralVariants(ctaTotal)}`
      : 'Показать варианты';

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: headerBackground }}>
      <View
        style={{
          minHeight: 68,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingVertical: 10,
          overflow: 'hidden',
        }}
      >
        <BlurView
          intensity={88}
          tint={isDark ? 'dark' : 'light'}
          style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
        />
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            backgroundColor: isDark ? 'rgba(20,22,27,0.72)' : 'rgba(255,255,255,0.72)',
          }}
        />
        <View style={{ width: 68, alignItems: 'flex-start' }}>
          <IconButton
            icon="close"
            iconSize={22}
            size={48}
            accessibilityLabel="Закрыть"
            onPress={() => goBackOrReplace(isMine ? '/my-listings' : '/(tabs)')}
          />
        </View>

        <View pointerEvents="none" style={{ position: 'absolute', left: 84, right: 84, alignItems: 'center' }}>
          <Text style={{ fontSize: 20, fontWeight: '800', color: palette.ink }}>
            Фильтры
          </Text>
        </View>

        <Pressable
          accessibilityLabel="Сбросить все фильтры"
          onPress={reset}
          style={{ minWidth: 68, minHeight: 42, alignItems: 'flex-end', justifyContent: 'center' }}
        >
          <Text style={{ fontSize: 15, fontWeight: '600', color: palette.primary }}>
            Сбросить
          </Text>
        </Pressable>
      </View>

      <KeyboardAwareForm
        rootStyle={{ backgroundColor: screenBackground }}
        contentContainerStyle={{ gap: 16, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 24 }}
        footer={(
          <View
            style={{
              borderTopWidth: 1,
              borderTopColor: isDark ? 'rgba(255,255,255,0.09)' : palette.line,
              paddingHorizontal: 16,
              paddingTop: 12,
              paddingBottom: insets.bottom > 0 ? insets.bottom : 12,
              backgroundColor: isDark ? 'rgba(20,22,27,0.97)' : 'rgba(255,255,255,0.97)',
            }}>
            <Button label={ctaLabel} loading={!isMine && isCtaLoading} disabled={areaRangeInvalid} onPress={apply} />
          </View>
        )}>
        <MaterialSurface level="base" radius={20} style={{ gap: 12, padding: 16 }}>
          <Text style={{ fontSize: 16, fontWeight: '800', color: palette.ink }}>Сортировка</Text>
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
                    borderRadius: 14,
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
        </MaterialSurface>

        <Switch
          accessibilityLabel="Показывать только избранные объявления"
          value={favoritesOnly}
          onValueChange={setFavoritesOnly}
          label="Только избранные"
          description="Показывать объявления, отмеченные сердечком"
          leading={
            <View
              style={{
                width: 40,
                height: 40,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 20,
                backgroundColor: favoritesOnly ? palette.primary : palette.surfaceMuted,
              }}>
              <Ionicons name={favoritesOnly ? 'heart' : 'heart-outline'} size={20} color={favoritesOnly ? 'white' : palette.inkSecondary} />
            </View>
          }
          style={{
            minHeight: 64,
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: favoritesOnly ? palette.primary : palette.line,
            backgroundColor: favoritesOnly ? palette.primaryLight : palette.surface,
          }}
        />

        {!isMine && numericOwnerId == null && currentUserId != null ? (
          <Switch
            accessibilityLabel="Показывать мои объявления"
            value={showOwnListings}
            onValueChange={setShowOwnListings}
            label="Показывать мои объявления"
            description="Добавить ваши объявления в общую выдачу"
            leading={
              <View
                style={{
                  width: 40,
                  height: 40,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 20,
                  backgroundColor: showOwnListings ? palette.primary : palette.surfaceMuted,
                }}>
                <Ionicons name="home-outline" size={20} color={showOwnListings ? 'white' : palette.inkSecondary} />
              </View>
            }
            style={{
              minHeight: 64,
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: showOwnListings ? palette.primary : palette.line,
              backgroundColor: showOwnListings ? palette.primaryLight : palette.surface,
            }}
          />
        ) : null}

        {isMine ? (
          <View style={{ gap: 10 }}>
            <Text style={{ fontSize: 15, fontWeight: '600', color: palette.ink }}>Статус</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {STATUS_OPTIONS.map((option) => (
                <Chip
                  key={option.value}
                  label={option.label}
                  selected={statuses.includes(option.value)}
                  onPress={() => setStatuses((current) => toggle(current, option.value))}
                />
              ))}
            </View>
          </View>
        ) : null}

        <MaterialSurface level="base" radius={20}>
          <Pressable
            onPress={() => setCitySheet(true)}
            style={{
              minHeight: 68,
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 14,
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
              <Ionicons name="location-outline" size={20} color={palette.primary} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontSize: 12, color: palette.inkMuted }}>Город</Text>
              <Text style={{ fontSize: 15, fontWeight: '700', color: palette.ink }}>
                {city ?? 'Любой'}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={palette.inkMuted} />
          </Pressable>

          <View style={{ height: 1, marginLeft: 68, backgroundColor: palette.line }} />

          <Pressable
            onPress={() => setDateSheet(true)}
            style={{
              minHeight: 68,
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 14,
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
              <Ionicons name="calendar-outline" size={20} color={palette.primary} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontSize: 12, color: palette.inkMuted }}>Даты проживания</Text>
              <Text style={{ fontSize: 15, fontWeight: '700', color: palette.ink }}>
                {dateRangeLabel(checkIn, checkOut)}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={palette.inkMuted} />
          </Pressable>
        </MaterialSurface>

        <MaterialSurface level="base" radius={20} style={{ gap: 18, padding: 16 }}>
        <View style={{ gap: 12 }}>
          <Text style={{ fontSize: 16, fontWeight: '800', color: palette.ink }}>Цена за сутки, ₽</Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            {/* Min Price Input */}
            <Input
              size="md"
              containerStyle={{ flex: 1 }}
              before={<Text style={{ fontSize: 15, color: palette.inkMuted }}>от</Text>}
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
                style={{ fontSize: 15, fontWeight: '700' }}
              />

            {/* Max Price Input */}
            <Input
              size="md"
              containerStyle={{ flex: 1 }}
              before={<Text style={{ fontSize: 15, color: palette.inkMuted }}>до</Text>}
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
                style={{ fontSize: 15, fontWeight: '700' }}
              />
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
          <Text style={{ fontSize: 16, fontWeight: '800', color: palette.ink }}>Площадь, м²</Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            {[
              { value: areaMin, setter: setAreaMin, prefix: 'от', placeholder: '5' },
              { value: areaMax, setter: setAreaMax, prefix: 'до', placeholder: '10 000' },
            ].map((field) => (
              <Input
                key={field.prefix}
                size="md"
                containerStyle={{ flex: 1 }}
                before={<Text style={{ fontSize: 15, color: palette.inkMuted }}>{field.prefix}</Text>}
                value={field.value}
                onChangeText={(text) => field.setter(text.replace(/\D/g, ''))}
                keyboardType="number-pad"
                placeholder={field.placeholder}
                style={{ fontSize: 15, fontWeight: '700' }}
              />
            ))}
          </View>
        </View>
        </MaterialSurface>

        <MaterialSurface level="base" radius={20} style={{ gap: 20, padding: 16 }}>
        {/* Category */}
        <View style={{ gap: 8 }}>
          <Text style={{ fontSize: 16, fontWeight: '800', color: palette.ink }}>Тип жилья</Text>
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
          <Text style={{ fontSize: 16, fontWeight: '800', color: palette.ink }}>Комнаты</Text>
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
          <Text style={{ fontSize: 16, fontWeight: '800', color: palette.ink }}>Гости</Text>
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
            <Counter value={guests} min={1} max={100} onChange={setGuests} label="Количество гостей" />
          </View>
        </View>
        </MaterialSurface>

        <MaterialSurface level="base" radius={20} style={{ gap: 20, padding: 16 }}>
        {/* House Rules */}
        <View style={{ gap: 8 }}>
          <Text style={{ fontSize: 16, fontWeight: '800', color: palette.ink }}>Правила дома</Text>
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
          <Text style={{ fontSize: 16, fontWeight: '800', color: palette.ink }}>Удобства</Text>
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
        </MaterialSurface>
      </KeyboardAwareForm>

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
