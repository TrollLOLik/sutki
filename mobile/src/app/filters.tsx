import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Chip } from '@/components/ui';
import {
  useFiltersStore,
  type Amenity,
  type RoomFilter,
} from '@/store/filters';
import { palette } from '@/theme/tokens';

const ROOM_OPTIONS: { label: string; value: RoomFilter }[] = [
  { label: 'Студия', value: 'studio' },
  { label: '1 комната', value: '1' },
  { label: '2 комнаты', value: '2' },
  { label: '3+ комнаты', value: '3plus' },
];

const AMENITY_OPTIONS: { label: string; value: Amenity }[] = [
  { label: 'Wi-Fi', value: 'wifi' },
  { label: 'Стиральная машина', value: 'washer' },
  { label: 'Кондиционер', value: 'conditioner' },
  { label: 'Парковка', value: 'parking' },
  { label: 'Балкон', value: 'balcony' },
];

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export default function FiltersScreen() {
  const store = useFiltersStore();
  const [rooms, setRooms] = useState<RoomFilter[]>(store.rooms);
  const [amenities, setAmenities] = useState<Amenity[]>(store.amenities);
  const [priceMin, setPriceMin] = useState(store.priceMin?.toString() ?? '');
  const [priceMax, setPriceMax] = useState(store.priceMax?.toString() ?? '');
  const [guests, setGuests] = useState(store.guests);

  const apply = () => {
    store.setFilters({
      rooms,
      amenities,
      guests,
      priceMin: priceMin ? Number(priceMin) : null,
      priceMax: priceMax ? Number(priceMax) : null,
    });
    router.back();
  };

  const reset = () => {
    store.reset();
    router.back();
  };

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
        </View>

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

        <View className="gap-2">
          <Text className="text-base font-semibold text-ink">Удобства</Text>
          <View className="flex-row flex-wrap gap-2">
            {AMENITY_OPTIONS.map((o) => (
              <Chip
                key={o.value}
                label={o.label}
                selected={amenities.includes(o.value)}
                onPress={() => setAmenities((prev) => toggle(prev, o.value))}
              />
            ))}
          </View>
          <Text className="text-sm text-ink-muted">
            Гости, даты и удобства будут учитываться на сервере позже (бэкенд B2).
          </Text>
        </View>
      </ScrollView>

      <View className="flex-row gap-3 border-t border-line px-4 py-3">
        <View className="flex-1">
          <Button label="Сбросить" variant="secondary" onPress={reset} />
        </View>
        <View className="flex-1">
          <Button label="Применить" onPress={apply} />
        </View>
      </View>
    </SafeAreaView>
  );
}
