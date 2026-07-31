import { Pressable, ScrollView, Text, View } from 'react-native';

import { useAppTheme } from '@/theme/useAppTheme';

export interface CountedTabItem<T extends string> {
  value: T;
  label: string;
  count: number;
}

interface CountedTabsProps<T extends string> {
  items: readonly CountedTabItem<T>[];
  value: T | null;
  onChange: (value: T) => void;
}

export function CountedTabs<T extends string>({ items, value, onChange }: CountedTabsProps<T>) {
  const { palette } = useAppTheme();
  const stretchTabs = items.length <= 3;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ height: 54, flexGrow: 0, flexShrink: 0 }}
      contentContainerStyle={{
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 16,
        paddingBottom: 12,
        flexGrow: stretchTabs ? 1 : 0,
      }}
    >
      {items.map((item) => {
        const selected = item.value === value;
        return (
          <Pressable
            key={item.value}
            accessibilityRole="tab"
            accessibilityLabel={`${item.label}: ${item.count}`}
            accessibilityState={{ selected }}
            onPress={() => onChange(item.value)}
            className="active:opacity-80"
            style={{
              minHeight: 38,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 7,
              borderRadius: 19,
              borderWidth: 1,
              borderColor: selected ? palette.primary : palette.line,
              backgroundColor: selected ? palette.primaryLight : palette.surface,
              paddingHorizontal: 13,
              justifyContent: 'center',
              flexGrow: stretchTabs ? 1 : 0,
              flexBasis: items.length === 2 ? 0 : undefined,
            }}
          >
            <Text
              numberOfLines={1}
              style={{
                color: selected ? palette.primary : palette.inkSecondary,
                fontSize: 13,
                fontWeight: '700',
              }}
            >
              {item.label}
            </Text>
            <View
              style={{
                minWidth: 22,
                height: 22,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 11,
                backgroundColor: selected ? palette.primary : palette.surfaceMuted,
                paddingHorizontal: 5,
              }}
            >
              <Text style={{ color: selected ? '#FFFFFF' : palette.inkMuted, fontSize: 11, fontWeight: '800' }}>
                {item.count > 99 ? '99+' : item.count}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
