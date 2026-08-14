import { View } from 'react-native';

import { ListingLayoutToggle } from '@/components/ListingLayoutToggle';
import {
  AppText,
  IconButton,
  SearchField,
  SelectionSheet,
  type AppIconName,
} from '@/components/ui';
import type { ListingLayoutMode } from '@/store/listing-layout';

export interface SortOption<T extends string> {
  value: T;
  label: string;
  icon?: AppIconName;
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
          <IconButton
            accessibilityLabel="Сортировка"
            icon="swap-vertical-outline"
            iconSize={22}
            onPress={() => onSortVisibleChange(true)}
            size={48}
            surface="floating"
            tone="primary"
            style={{ marginRight: onFilterPress || onLayoutToggle ? 10 : 0 }}
          />
        ) : null}
        {layoutMode && onLayoutToggle ? (
          <ListingLayoutToggle
            mode={layoutMode}
            onToggle={onLayoutToggle}
            marginRight={onFilterPress ? 10 : 0}
          />
        ) : null}
        {onFilterPress ? (
          <View style={{ position: 'relative', width: 48, height: 48 }}>
            <IconButton
              accessibilityLabel="Фильтры"
              icon="options-outline"
              iconSize={22}
              onPress={onFilterPress}
              size={48}
              surface="floating"
              tone="primary"
            />
            {filterCount > 0 ? (
              <View
                pointerEvents="none"
                className="absolute -right-1 -top-1 h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1">
                <AppText
                  variant="captionStrong"
                  tone="inverse"
                  style={{ fontSize: 11, lineHeight: 14 }}>
                  {filterCount > 9 ? '9+' : filterCount}
                </AppText>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>

      <SelectionSheet
        visible={showSort && sortVisible}
        onClose={() => onSortVisibleChange(false)}
        title="Сортировка"
        subtitle="Выберите порядок отображения"
        icon="swap-vertical-outline"
        value={sort}
        options={sortOptions.map((option) => ({
          ...option,
          icon: option.icon ?? 'reorder-three-outline',
        }))}
        onChange={onSortChange}
      />
    </>
  );
}
