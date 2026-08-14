import { useCallback, useImperativeHandle, useRef, type Ref } from 'react';
import {
  ScrollView,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { PressableScale } from '@/components/ui/PressableScale';

export type WheelPickerValue = string | number;

export interface WheelPickerItem<T extends WheelPickerValue = WheelPickerValue> {
  value: T;
  label: string;
}

export interface WheelPickerHandle<T extends WheelPickerValue = WheelPickerValue> {
  scrollToValue: (value: T, animated?: boolean) => void;
}

export interface WheelPickerProps<T extends WheelPickerValue = WheelPickerValue> {
  items: WheelPickerItem<T>[];
  value: T;
  onChange: (value: T) => void;
  rowHeight?: number;
  visibleRows?: number;
  style?: StyleProp<ViewStyle>;
  pickerRef?: Ref<WheelPickerHandle<T>>;
}

export function WheelPicker<T extends WheelPickerValue>({
  items,
  value,
  onChange,
  rowHeight = 42,
  visibleRows = 5,
  style,
  pickerRef,
}: WheelPickerProps<T>) {
  const scrollRef = useRef<ScrollView>(null);
  const padding = rowHeight * Math.floor(visibleRows / 2);

  const scrollToValue = useCallback((nextValue: T, animated = true) => {
    const index = Math.max(0, items.findIndex((item) => item.value === nextValue));
    scrollRef.current?.scrollTo({ y: index * rowHeight, animated });
  }, [items, rowHeight]);

  useImperativeHandle(pickerRef, () => ({ scrollToValue }), [scrollToValue]);

  return (
    <ScrollView
      ref={scrollRef}
      accessibilityRole="adjustable"
      showsVerticalScrollIndicator={false}
      snapToInterval={rowHeight}
      decelerationRate="fast"
      style={style}
      contentContainerStyle={{ alignItems: 'center', paddingVertical: padding }}
      onMomentumScrollEnd={(event) => {
        const index = Math.max(
          0,
          Math.min(items.length - 1, Math.round(event.nativeEvent.contentOffset.y / rowHeight)),
        );
        const item = items[index];
        if (item) onChange(item.value);
      }}>
      {items.map((item) => {
        const selected = item.value === value;
        return (
          <PressableScale
            key={String(item.value)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => {
              onChange(item.value);
              scrollToValue(item.value);
            }}
            pressedScale={0.97}
            style={{
              width: '100%',
              height: rowHeight,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 4,
            }}>
            <AppText
              variant="title"
              tone={selected ? 'primary' : 'secondary'}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.78}
              align="center"
              style={{ width: '100%', fontSize: 18, lineHeight: 23, fontWeight: selected ? '800' : '500' }}>
              {item.label}
            </AppText>
          </PressableScale>
        );
      })}
    </ScrollView>
  );
}
