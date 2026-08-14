import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';

import {
  BottomSheet,
  Button,
  DialogActions,
  MaterialSurface,
  WheelPicker,
  type WheelPickerHandle,
} from '@/components/ui';
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

export function BirthdayPickerSheet({ visible, onClose, onApply, initialValue }: BirthdayPickerSheetProps) {
  const { palette } = useAppTheme();
  const cutoff = useMemo(() => adultBirthdayCutoff(), []);
  const maxYear = cutoff.getFullYear();
  const initial = parseInitial(initialValue, cutoff);
  const [day, setDay] = useState(initial.d);
  const [month, setMonth] = useState(initial.m);
  const [year, setYear] = useState(initial.y);

  const dayRef = useRef<WheelPickerHandle<number>>(null);
  const monthRef = useRef<WheelPickerHandle<number>>(null);
  const yearRef = useRef<WheelPickerHandle<number>>(null);
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
    dayRef.current?.scrollToValue(daysCount);
  }, [day, daysCount]);

  useLayoutEffect(() => {
    if (!visible) return;
    const next = parseInitial(initialValue, cutoff);
    setDay(next.d);
    setMonth(next.m);
    setYear(next.y);

    const timer = setTimeout(() => {
      dayRef.current?.scrollToValue(next.d, false);
      monthRef.current?.scrollToValue(next.m, false);
      yearRef.current?.scrollToValue(next.y, false);
    }, 220);
    return () => clearTimeout(timer);
  }, [visible, initialValue, cutoff, maxYear]);

  const selectDay = (value: number) => {
    setDay(value);
  };

  const selectMonth = (value: number) => {
    const next = clampBirthday({ d: day, m: value, y: year }, cutoff);
    setDay(next.d);
    setMonth(next.m);
    if (next.d !== day) {
      dayRef.current?.scrollToValue(next.d);
    }
  };

  const selectYear = (value: number) => {
    const next = clampBirthday({ d: day, m: month, y: value }, cutoff);
    setDay(next.d);
    setMonth(next.m);
    setYear(next.y);
    monthRef.current?.scrollToValue(next.m);
    dayRef.current?.scrollToValue(next.d);
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
          <WheelPicker
            pickerRef={dayRef}
            items={days.map((value) => ({ value, label: String(value) }))}
            value={day}
            onChange={selectDay}
            rowHeight={ROW_HEIGHT}
            style={{ width: 72 }}
          />

          <WheelPicker
            pickerRef={monthRef}
            items={months.map((value) => ({ value, label: MONTH_NAMES[value] }))}
            value={month}
            onChange={selectMonth}
            rowHeight={ROW_HEIGHT}
            style={{ flex: 1, minWidth: 132 }}
          />

          <WheelPicker
            pickerRef={yearRef}
            items={years.map((value) => ({ value, label: String(value) }))}
            value={year}
            onChange={selectYear}
            rowHeight={ROW_HEIGHT}
            style={{ width: 94 }}
          />
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
