import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ListingCardSkeleton } from '@/components/ListingCardSkeleton';
import { Chip } from '@/components/ui';
import { palette } from '@/theme/tokens';

const QUICK_FILTERS = ['Квартиры', 'Студии', '1-комн.', '2-комн.'];

export default function SearchScreen() {
  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-surface">
      <View className="gap-3 px-4 pb-3">
        <View className="flex-row items-center justify-between">
          <Pressable className="flex-row items-center gap-1">
            <Ionicons name="location-outline" size={18} color={palette.primary} />
            <Text className="text-base font-semibold text-ink">Магнитогорск</Text>
            <Ionicons name="chevron-down" size={16} color={palette.inkSecondary} />
          </Pressable>
        </View>

        <View className="flex-row items-center gap-2">
          <View className="h-12 flex-1 flex-row items-center rounded-field border border-line bg-surface px-3">
            <Ionicons name="search" size={20} color={palette.inkMuted} />
            <Text className="ml-2 text-base text-ink-muted">Поиск по адресу или названию</Text>
          </View>
          <Pressable
            accessibilityLabel="Фильтры"
            className="h-12 w-12 items-center justify-center rounded-field bg-primary active:bg-primary-pressed">
            <Ionicons name="options-outline" size={22} color={palette.surface} />
          </Pressable>
        </View>

        <FlatList
          data={QUICK_FILTERS}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item}
          contentContainerClassName="gap-2"
          renderItem={({ item }) => <Chip label={item} />}
        />
      </View>

      <FlatList
        data={[0, 1, 2, 3]}
        keyExtractor={(item) => String(item)}
        contentContainerClassName="px-4 pb-6"
        showsVerticalScrollIndicator={false}
        renderItem={() => (
          <Pressable onPress={() => router.push({ pathname: '/listing/[id]', params: { id: '1' } })}>
            <ListingCardSkeleton />
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}
