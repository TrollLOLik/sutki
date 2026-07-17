import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, TextInput, View } from 'react-native';

import { BottomSheet } from '@/components/ui';
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
  filterCount?: number;
  onFilterPress?: () => void;
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
  filterCount = 0,
  onFilterPress,
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
        <View
          style={{
            flex: 1,
            height: 48,
            flexDirection: 'row',
            alignItems: 'center',
            marginRight: 10,
            paddingHorizontal: 12,
            borderRadius: 24,
            borderWidth: 1,
            borderColor: palette.line,
            backgroundColor: palette.surface,
            shadowColor: '#1A1A1A',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 6,
            elevation: 3,
          }}>
          <Ionicons name="search" size={20} color={palette.inkMuted} />
          <TextInput
            value={query}
            onChangeText={onQueryChange}
            placeholder={placeholder}
            placeholderTextColor={palette.inkMuted}
            returnKeyType="search"
            clearButtonMode="while-editing"
            style={{
              flex: 1,
              paddingVertical: 0,
              marginLeft: 8,
              marginRight: 8,
              fontSize: 14,
              fontWeight: '500',
              color: palette.ink,
            }}
          />
          {query.length > 0 ? (
            <Pressable onPress={() => onQueryChange('')} className="h-8 w-8 items-center justify-center" accessibilityLabel="Очистить поиск">
              <Ionicons name="close-circle" size={19} color={palette.inkMuted} />
            </Pressable>
          ) : null}
        </View>
        <Pressable
          onPress={() => onSortVisibleChange(true)}
          style={{
            width: 48,
            height: 48,
            marginRight: onFilterPress ? 10 : 0,
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

      <BottomSheet visible={sortVisible} onClose={() => onSortVisibleChange(false)}>
        <Text className="mb-4 text-center text-lg font-bold text-ink">Сортировка</Text>
        <View className="gap-2">
          {sortOptions.map((option) => {
            const selected = option.value === sort;
            return (
              <Pressable
                key={option.value}
                onPress={() => {
                  onSortChange(option.value);
                  onSortVisibleChange(false);
                }}
                className={`h-12 flex-row items-center rounded-field border px-4 ${selected ? 'border-primary bg-primary-light' : 'border-line bg-surface'}`}>
                <Ionicons name={option.icon ?? 'reorder-three-outline'} size={20} color={selected ? palette.primary : palette.inkSecondary} />
                <Text className={`ml-3 flex-1 text-base font-semibold ${selected ? 'text-primary' : 'text-ink'}`}>{option.label}</Text>
                {selected ? <Ionicons name="checkmark-circle" size={21} color={palette.primary} /> : null}
              </Pressable>
            );
          })}
        </View>
      </BottomSheet>
    </>
  );
}
