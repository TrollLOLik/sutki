import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { BottomSheet, Button, MaterialSurface } from '@/components/ui';
import { useAppTheme } from '@/theme/useAppTheme';

const MONTH_NAMES = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
];

const CURRENT_YEAR = new Date().getFullYear();
const ROW_HEIGHT = 42;
const WHEEL_PADDING = ROW_HEIGHT * 2;
const MONTH_CYCLES = 7;
const MIDDLE_MONTH_CYCLE = Math.floor(MONTH_CYCLES / 2);

interface BirthdayPickerSheetProps {
  visible: boolean;
  onClose: () => void;
  onApply: (isoDate: string) => void;
  initialValue?: string;
}

function parseInitial(value?: string): { d: number; m: number; y: number } {
  if (value) {
    const [year, month, day] = value.split('-').map((part) => Number.parseInt(part, 10));
    if (Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day)) {
      return { d: day, m: month - 1, y: year };
    }
  }
  return { d: 12, m: 4, y: CURRENT_YEAR - 20 };
}

function indexFromOffset(offset: number, length: number) {
  return Math.max(0, Math.min(length - 1, Math.round(offset / ROW_HEIGHT)));
}

export function BirthdayPickerSheet({ visible, onClose, onApply, initialValue }: BirthdayPickerSheetProps) {
  const { palette } = useAppTheme();
  const initial = parseInitial(initialValue);
  const [day, setDay] = useState(initial.d);
  const [month, setMonth] = useState(initial.m);
  const [year, setYear] = useState(initial.y);

  const dayRef = useRef<ScrollView>(null);
  const monthRef = useRef<ScrollView>(null);
  const yearRef = useRef<ScrollView>(null);
  const years = useMemo(() => Array.from({ length: 100 }, (_, index) => CURRENT_YEAR - index), []);
  const monthItems = useMemo(
    () =>
      Array.from({ length: MONTH_NAMES.length * MONTH_CYCLES }, (_, index) => ({
        index,
        month: index % MONTH_NAMES.length,
      })),
    [],
  );
  const daysCount = new Date(year, month + 1, 0).getDate();
  const days = useMemo(() => Array.from({ length: daysCount }, (_, index) => index + 1), [daysCount]);

  useEffect(() => {
    if (day <= daysCount) return;
    setDay(daysCount);
    dayRef.current?.scrollTo({ y: (daysCount - 1) * ROW_HEIGHT, animated: true });
  }, [day, daysCount]);

  useEffect(() => {
    if (!visible) return;
    const next = parseInitial(initialValue);
    setDay(next.d);
    setMonth(next.m);
    setYear(next.y);

    const timer = setTimeout(() => {
      dayRef.current?.scrollTo({ y: (next.d - 1) * ROW_HEIGHT, animated: false });
      monthRef.current?.scrollTo({
        y: (MIDDLE_MONTH_CYCLE * MONTH_NAMES.length + next.m) * ROW_HEIGHT,
        animated: false,
      });
      yearRef.current?.scrollTo({ y: Math.max(0, CURRENT_YEAR - next.y) * ROW_HEIGHT, animated: false });
    }, 220);
    return () => clearTimeout(timer);
  }, [visible, initialValue]);

  const selectDay = (value: number) => {
    setDay(value);
    dayRef.current?.scrollTo({ y: (value - 1) * ROW_HEIGHT, animated: true });
  };

  const selectMonth = (value: number, itemIndex: number) => {
    setMonth(value);
    monthRef.current?.scrollTo({ y: itemIndex * ROW_HEIGHT, animated: true });
  };

  const selectYear = (value: number) => {
    setYear(value);
    yearRef.current?.scrollTo({ y: (CURRENT_YEAR - value) * ROW_HEIGHT, animated: true });
  };

  const apply = () => {
    const dayPart = String(day).padStart(2, '0');
    const monthPart = String(month + 1).padStart(2, '0');
    onApply(`${year}-${monthPart}-${dayPart}`);
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} height={430}>
      <View className="flex-row items-center gap-3">
        <View className="h-12 w-12 items-center justify-center rounded-full bg-primary-light">
          <Ionicons name="calendar-outline" size={23} color={palette.primary} />
        </View>
        <View className="flex-1">
          <Text className="text-xl font-extrabold text-ink">Дата рождения</Text>
          <Text className="mt-1 text-sm text-ink-secondary" numberOfLines={1}>
            {day} {MONTH_NAMES[month]} {year}
          </Text>
        </View>
      </View>

      <MaterialSurface
        level="raised"
        radius={24}
        style={{ height: 214, marginTop: 20, overflow: 'hidden', paddingHorizontal: 12 }}>
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 12,
            right: 12,
            top: 85,
            height: ROW_HEIGHT,
            borderRadius: 15,
            backgroundColor: palette.primaryLight,
          }}
        />
        <View className="flex-1 flex-row items-center">
          <ScrollView
            ref={dayRef}
            showsVerticalScrollIndicator={false}
            snapToInterval={ROW_HEIGHT}
            decelerationRate="fast"
            style={{ width: 72 }}
            contentContainerStyle={{ alignItems: 'center', paddingVertical: WHEEL_PADDING }}
            onMomentumScrollEnd={(event) => setDay(days[indexFromOffset(event.nativeEvent.contentOffset.y, days.length)])}>
            {days.map((value) => (
              <Pressable
                key={value}
                onPress={() => selectDay(value)}
                style={{ height: ROW_HEIGHT, width: '100%', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 18, fontWeight: day === value ? '800' : '500', color: day === value ? palette.primary : palette.inkSecondary }}>
                  {value}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <ScrollView
            ref={monthRef}
            showsVerticalScrollIndicator={false}
            snapToInterval={ROW_HEIGHT}
            decelerationRate="fast"
            style={{ flex: 1, minWidth: 132 }}
            contentContainerStyle={{ alignItems: 'center', paddingVertical: WHEEL_PADDING }}
            onMomentumScrollEnd={(event) => {
              const itemIndex = indexFromOffset(event.nativeEvent.contentOffset.y, monthItems.length);
              const nextMonth = monthItems[itemIndex].month;
              setMonth(nextMonth);
              requestAnimationFrame(() => {
                monthRef.current?.scrollTo({
                  y: (MIDDLE_MONTH_CYCLE * MONTH_NAMES.length + nextMonth) * ROW_HEIGHT,
                  animated: false,
                });
              });
            }}>
            {monthItems.map((item) => (
              <Pressable
                key={item.index}
                onPress={() => selectMonth(item.month, item.index)}
                style={{ height: ROW_HEIGHT, width: '100%', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.78}
                  style={{
                    width: '100%',
                    textAlign: 'center',
                    fontSize: 18,
                    fontWeight: month === item.month ? '800' : '500',
                    color: month === item.month ? palette.primary : palette.inkSecondary,
                  }}>
                  {MONTH_NAMES[item.month]}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <ScrollView
            ref={yearRef}
            showsVerticalScrollIndicator={false}
            snapToInterval={ROW_HEIGHT}
            decelerationRate="fast"
            style={{ width: 94 }}
            contentContainerStyle={{ alignItems: 'center', paddingVertical: WHEEL_PADDING }}
            onMomentumScrollEnd={(event) => setYear(years[indexFromOffset(event.nativeEvent.contentOffset.y, years.length)])}>
            {years.map((value) => (
              <Pressable
                key={value}
                onPress={() => selectYear(value)}
                style={{ height: ROW_HEIGHT, width: '100%', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 18, fontWeight: year === value ? '800' : '500', color: year === value ? palette.primary : palette.inkSecondary }}>
                  {value}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </MaterialSurface>

      <View className="mt-auto flex-row gap-3 pt-5">
        <Button label="Отмена" variant="secondary" size="md" className="flex-1" onPress={onClose} />
        <Button label="Применить" size="md" className="flex-1" onPress={apply} />
      </View>
    </BottomSheet>
  );
}

export function formatBirthday(value?: string | null): string {
  if (!value) return '';
  const [year, month, day] = value.split('-').map((part) => Number.parseInt(part, 10));
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return value;
  return `${day} ${MONTH_NAMES[month - 1]} ${year}`;
}
