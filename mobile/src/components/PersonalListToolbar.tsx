import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { BottomSheet, MaterialSurface, SearchField } from '@/components/ui';
import { ListingLayoutToggle } from '@/components/ListingLayoutToggle';
import type { ListingLayoutMode } from '@/store/listing-layout';
import { useAppTheme } from '@/theme/useAppTheme';

export interface SortOption<T extends string> {
  value: T;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
}

interface PersonalListToolbarProps<T extends string> {
  query: string;
  onQueryChange: (value: string) => void;
  placeholder: string;
  sort: T;
  sortOptions: SortOption<T>[];
  sortVisible: boolean;
  onSortVisibleChange: (visible: boolean) => void;
  onSortChange: (value: T) => void;
  showSort?: boolean;
  filterCount?: number;
  onFilterPress?: () => void;
  layoutMode?: ListingLayoutMode;
  onLayoutToggle?: () => void;
}

export function PersonalListToolbar<T extends string>({
  query,
  onQueryChange,
  placeholder,
  sort,
  sortOptions,
  sortVisible,
  onSortVisibleChange,
  onSortChange,
  showSort = true,
  filterCount = 0,
  onFilterPress,
  layoutMode,
  onLayoutToggle,
}: PersonalListToolbarProps<T>) {
  const { palette } = useAppTheme();

  return (
    <>
      <View
        style={{
          width: '100%',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingTop: 4,
          paddingBottom: 12,
        }}>
        <SearchField
          value={query}
          onChangeText={onQueryChange}
          placeholder={placeholder}
          containerStyle={{ flex: 1, marginRight: 10 }}
        />
        {showSort ? (
          <Pressable
            onPress={() => onSortVisibleChange(true)}
            style={{
              width: 48,
              height: 48,
              marginRight: onFilterPress || onLayoutToggle ? 10 : 0,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 24,
              borderWidth: 1,
              borderColor: palette.line,
              backgroundColor: palette.surface,
              shadowColor: '#1A1A1A',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 6,
              elevation: 3,
            }}
            accessibilityLabel="Сортировка">
            <Ionicons name="swap-vertical-outline" size={22} color={palette.primary} />
          </Pressable>
        ) : null}
        {layoutMode && onLayoutToggle ? (
          <ListingLayoutToggle
            mode={layoutMode}
            onToggle={onLayoutToggle}
            marginRight={onFilterPress ? 10 : 0}
          />
        ) : null}
        {onFilterPress ? (
          <Pressable
            onPress={onFilterPress}
            style={{
              position: 'relative',
              width: 48,
              height: 48,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 24,
              borderWidth: 1,
              borderColor: palette.line,
              backgroundColor: palette.surface,
              shadowColor: '#1A1A1A',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 6,
              elevation: 3,
            }}
            accessibilityLabel="Фильтры">
            <Ionicons name="options-outline" size={22} color={palette.primary} />
            {filterCount > 0 ? (
              <View style={{ position: 'absolute', top: -4, right: -4, minWidth: 20, height: 20, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: palette.primary }}>
                <Text style={{ color: 'white', fontSize: 11, fontWeight: 'bold' }}>{filterCount > 9 ? '9+' : filterCount}</Text>
              </View>
            ) : null}
          </Pressable>
        ) : null}
      </View>

      <BottomSheet
        visible={showSort && sortVisible}
        onClose={() => onSortVisibleChange(false)}
        height={Math.min(560, 154 + sortOptions.length * 66)}>
        <View className="flex-row items-center gap-3">
          <View className="h-12 w-12 items-center justify-center rounded-full bg-primary-light">
            <Ionicons name="swap-vertical-outline" size={23} color={palette.primary} />
          </View>
          <View className="flex-1">
            <Text className="text-xl font-extrabold text-ink">Сортировка</Text>
            <Text className="mt-1 text-sm text-ink-secondary">Выберите порядок отображения</Text>
          </View>
        </View>

        <View className="mt-5 gap-2">
          {sortOptions.map((option) => {
            const selected = option.value === sort;
            return (
              <MaterialSurface key={option.value} level="raised" radius={18}>
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  onPress={() => {
                    onSortChange(option.value);
                    onSortVisibleChange(false);
                  }}
                  className="h-14 flex-row items-center px-3 active:opacity-75">
                  <View className={`h-10 w-10 items-center justify-center rounded-full ${selected ? 'bg-primary-light' : 'bg-surface-muted'}`}>
                    <Ionicons
                      name={option.icon ?? 'reorder-three-outline'}
                      size={20}
                      color={selected ? palette.primary : palette.inkSecondary}
                    />
                  </View>
                  <Text className={`ml-3 flex-1 text-base font-bold ${selected ? 'text-primary' : 'text-ink'}`} numberOfLines={1}>
                    {option.label}
                  </Text>
                  <View
                    style={{
                      width: 22,
                      height: 22,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 11,
                      borderWidth: selected ? 0 : 1.5,
                      borderColor: palette.line,
                      backgroundColor: selected ? palette.primary : 'transparent',
                    }}>
                    {selected ? <Ionicons name="checkmark" size={15} color="#FFFFFF" /> : null}
                  </View>
                </Pressable>
              </MaterialSurface>
            );
          })}
        </View>
      </BottomSheet>
    </>
  );
}
