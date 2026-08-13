import { Pressable, ScrollView, Text, View } from 'react-native';

import { useAppTheme } from '@/theme/useAppTheme';

export interface CountedTabItem<T extends string> {
  value: T;
  label: string;
  count: number;
  disabled?: boolean;
}

export interface CountedTabsProps<T extends string> {
  items: readonly CountedTabItem<T>[];
  value: T | null;
  onChange: (value: T) => void;
  accessibilityLabel?: string;
}

interface CountedTabButtonProps<T extends string> {
  item: CountedTabItem<T>;
  selected: boolean;
  stretched: boolean;
  onChange: (value: T) => void;
}

function CountedTabButton<T extends string>({
  item,
  selected,
  stretched,
  onChange,
}: CountedTabButtonProps<T>) {
  const { palette } = useAppTheme();

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={`${item.label}: ${item.count}`}
      accessibilityState={{ selected, disabled: Boolean(item.disabled) }}
      disabled={Boolean(item.disabled)}
      onPress={() => onChange(item.value)}
      className="active:opacity-80"
      style={{
        minHeight: 38,
        minWidth: 0,
        flexBasis: stretched ? 0 : undefined,
        flexGrow: stretched ? 1 : 0,
        flexShrink: stretched ? 1 : 0,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 7,
        borderRadius: 19,
        borderWidth: 1,
        borderColor: selected ? palette.primary : palette.line,
        backgroundColor: selected ? palette.primaryLight : palette.surface,
        paddingHorizontal: 13,
        opacity: item.disabled ? 0.42 : 1,
      }}>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.82}
        style={{
          minWidth: 0,
          flexShrink: 1,
          color: selected ? palette.primary : palette.inkSecondary,
          fontSize: 13,
          fontWeight: '700',
        }}>
        {item.label}
      </Text>
      <View
        style={{
          minWidth: 22,
          height: 22,
          flexShrink: 0,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 11,
          backgroundColor: selected ? palette.primary : palette.surfaceMuted,
          paddingHorizontal: 5,
        }}>
        <Text style={{ color: selected ? '#FFFFFF' : palette.inkMuted, fontSize: 11, fontWeight: '800' }}>
          {item.count > 99 ? '99+' : item.count}
        </Text>
      </View>
    </Pressable>
  );
}

export function CountedTabs<T extends string>({
  items,
  value,
  onChange,
  accessibilityLabel = 'Разделы',
}: CountedTabsProps<T>) {
  const stretchTabs = items.length <= 3;

  if (stretchTabs) {
    return (
      <View
        accessibilityRole="tablist"
        accessibilityLabel={accessibilityLabel}
        style={{
          width: '100%',
          height: 54,
          flexShrink: 0,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingHorizontal: 16,
          paddingBottom: 12,
        }}>
        {items.map((item) => (
          <CountedTabButton
            key={item.value}
            item={item}
            selected={item.value === value}
            stretched
            onChange={onChange}
          />
        ))}
      </View>
    );
  }

  return (
    <ScrollView
      horizontal
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      showsHorizontalScrollIndicator={false}
      style={{ width: '100%', height: 54, flexGrow: 0, flexShrink: 0 }}
      contentContainerStyle={{
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 16,
        paddingBottom: 12,
      }}>
      {items.map((item) => (
        <CountedTabButton
          key={item.value}
          item={item}
          selected={item.value === value}
          stretched={false}
          onChange={onChange}
        />
      ))}
    </ScrollView>
  );
}
