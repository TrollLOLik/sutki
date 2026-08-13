import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { ComponentMarker } from '@/components/debug/ComponentMarker';
import { BottomSheet, Button, DialogActions, MaterialSurface } from '@/components/ui';
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

const MINIMUM_AGE = 18;
const YEARS_IN_PICKER = 100;
const ROW_HEIGHT = 42;
const WHEEL_PADDING = ROW_HEIGHT * 2;

interface BirthdayPickerSheetProps {
  visible: boolean;
  onClose: () => void;
  onApply: (isoDate: string) => void;
  initialValue?: string;
}

function adultBirthdayCutoff(now = new Date()): Date {
  const targetYear = now.getFullYear() - MINIMUM_AGE;
  const lastDayOfTargetMonth = new Date(targetYear, now.getMonth() + 1, 0).getDate();
  return new Date(targetYear, now.getMonth(), Math.min(now.getDate(), lastDayOfTargetMonth));
}

function clampBirthday(
  value: { d: number; m: number; y: number },
  cutoff: Date,
): { d: number; m: number; y: number } {
  const maxYear = cutoff.getFullYear();
  const year = Math.min(value.y, maxYear);
  const maxMonth = year === maxYear ? cutoff.getMonth() : 11;
  const month = Math.max(0, Math.min(value.m, maxMonth));
  const monthDays = new Date(year, month + 1, 0).getDate();
  const maxDay = year === maxYear && month === cutoff.getMonth()
    ? Math.min(monthDays, cutoff.getDate())
    : monthDays;

  return {
    d: Math.max(1, Math.min(value.d, maxDay)),
    m: month,
    y: year,
  };
}

function parseInitial(value: string | undefined, cutoff: Date): { d: number; m: number; y: number } {
  if (value) {
    const [year, month, day] = value.split('-').map((part) => Number.parseInt(part, 10));
    if (Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day)) {
      return clampBirthday({ d: day, m: month - 1, y: year }, cutoff);
    }
  }
  return clampBirthday({ d: 12, m: 4, y: cutoff.getFullYear() - 2 }, cutoff);
}

function indexFromOffset(offset: number, length: number) {
  return Math.max(0, Math.min(length - 1, Math.round(offset / ROW_HEIGHT)));
}

export function BirthdayPickerSheet({ visible, onClose, onApply, initialValue }: BirthdayPickerSheetProps) {
  const { palette } = useAppTheme();
  const cutoff = useMemo(() => adultBirthdayCutoff(), []);
  const maxYear = cutoff.getFullYear();
  const initial = parseInitial(initialValue, cutoff);
  const [day, setDay] = useState(initial.d);
  const [month, setMonth] = useState(initial.m);
  const [year, setYear] = useState(initial.y);

  const dayRef = useRef<ScrollView>(null);
  const monthRef = useRef<ScrollView>(null);
  const yearRef = useRef<ScrollView>(null);
  const years = useMemo(
    () => Array.from({ length: YEARS_IN_PICKER }, (_, index) => maxYear - index),
    [maxYear],
  );
  const months = useMemo(
    () => Array.from({ length: year === maxYear ? cutoff.getMonth() + 1 : 12 }, (_, index) => index),
    [cutoff, maxYear, year],
  );
  const calendarDaysCount = new Date(year, month + 1, 0).getDate();
  const daysCount = year === maxYear && month === cutoff.getMonth()
    ? Math.min(calendarDaysCount, cutoff.getDate())
    : calendarDaysCount;
  const days = useMemo(() => Array.from({ length: daysCount }, (_, index) => index + 1), [daysCount]);

  useEffect(() => {
    if (day <= daysCount) return;
    setDay(daysCount);
    dayRef.current?.scrollTo({ y: (daysCount - 1) * ROW_HEIGHT, animated: true });
  }, [day, daysCount]);

  useLayoutEffect(() => {
    if (!visible) return;
    const next = parseInitial(initialValue, cutoff);
    setDay(next.d);
    setMonth(next.m);
    setYear(next.y);

    const timer = setTimeout(() => {
      dayRef.current?.scrollTo({ y: (next.d - 1) * ROW_HEIGHT, animated: false });
      monthRef.current?.scrollTo({ y: next.m * ROW_HEIGHT, animated: false });
      yearRef.current?.scrollTo({ y: Math.max(0, maxYear - next.y) * ROW_HEIGHT, animated: false });
    }, 220);
    return () => clearTimeout(timer);
  }, [visible, initialValue, cutoff, maxYear]);

  const selectDay = (value: number) => {
    setDay(value);
    dayRef.current?.scrollTo({ y: (value - 1) * ROW_HEIGHT, animated: true });
  };

  const selectMonth = (value: number) => {
    const next = clampBirthday({ d: day, m: value, y: year }, cutoff);
    setDay(next.d);
    setMonth(next.m);
    monthRef.current?.scrollTo({ y: next.m * ROW_HEIGHT, animated: true });
    if (next.d !== day) {
      dayRef.current?.scrollTo({ y: (next.d - 1) * ROW_HEIGHT, animated: true });
    }
  };

  const selectYear = (value: number) => {
    const next = clampBirthday({ d: day, m: month, y: value }, cutoff);
    setDay(next.d);
    setMonth(next.m);
    setYear(next.y);
    yearRef.current?.scrollTo({ y: (maxYear - next.y) * ROW_HEIGHT, animated: true });
    monthRef.current?.scrollTo({ y: next.m * ROW_HEIGHT, animated: true });
    dayRef.current?.scrollTo({ y: (next.d - 1) * ROW_HEIGHT, animated: true });
  };

  const apply = () => {
    const dayPart = String(day).padStart(2, '0');
    const monthPart = String(month + 1).padStart(2, '0');
    onApply(`${year}-${monthPart}-${dayPart}`);
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      height={468}
      title="Дата рождения"
      subtitle={`${day} ${MONTH_NAMES[month]} ${year}`}
      icon="calendar-outline"
      footer={
        <DialogActions
          secondary={<Button label="Отмена" variant="secondary" size="md" onPress={onClose} />}
          primary={<Button label="Применить" size="md" onPress={apply} />}
        />
      }>
      <ComponentMarker kind="modal" name="BirthdayPickerSheet" />
      <MaterialSurface
        level="raised"
        radius={24}
        style={{ height: 214, overflow: 'hidden', paddingHorizontal: 12 }}>
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
              const itemIndex = indexFromOffset(event.nativeEvent.contentOffset.y, months.length);
              selectMonth(months[itemIndex]);
            }}>
            {months.map((value) => (
              <Pressable
                key={value}
                onPress={() => selectMonth(value)}
                style={{ height: ROW_HEIGHT, width: '100%', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.78}
                  style={{
                    width: '100%',
                    textAlign: 'center',
                    fontSize: 18,
                    fontWeight: month === value ? '800' : '500',
                    color: month === value ? palette.primary : palette.inkSecondary,
                  }}>
                  {MONTH_NAMES[value]}
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
            onMomentumScrollEnd={(event) => selectYear(years[indexFromOffset(event.nativeEvent.contentOffset.y, years.length)])}>
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

    </BottomSheet>
  );
}

export function formatBirthday(value?: string | null): string {
  if (!value) return '';
  const [year, month, day] = value.split('-').map((part) => Number.parseInt(part, 10));
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return value;
  return `${day} ${MONTH_NAMES[month - 1]} ${year}`;
}
