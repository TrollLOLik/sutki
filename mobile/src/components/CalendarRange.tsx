import { Ionicons } from '@expo/vector-icons';
import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  eachDayOfInterval,
  format,
  isBefore,
  isSameDay,
  isSameMonth,
  isWithinInterval,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { ru } from 'date-fns/locale';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/theme/useAppTheme';
import { IconButton, MaterialSurface } from '@/components/ui';

export interface DateRange {
  start: Date | null;
  end: Date | null;
}

interface CalendarRangeProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  /** Earliest selectable day (inclusive). Defaults to today. */
  minDate?: Date;
  /** Optional predicate to mark individual days as unavailable (e.g. booked). */
  isDateDisabled?: (day: Date) => boolean;
}

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const WEEK_OPTS = { weekStartsOn: 1 } as const;

/**
 * A dependency-free month calendar for picking a check-in/check-out range.
 * First tap sets the start, a later tap sets the end; tapping on/before the
 * start (or after a full range) restarts the selection.
 */
export function CalendarRange({ value, onChange, minDate, isDateDisabled }: CalendarRangeProps) {
  const { palette } = useAppTheme();
  const min = startOfDay(minDate ?? new Date());
  const [month, setMonth] = useState(() => startOfMonth(value.start ?? min));
  const [gridWidth, setGridWidth] = useState(0);

  const gridStart = startOfWeek(startOfMonth(month), WEEK_OPTS);
  const days = eachDayOfInterval({
    start: gridStart,
    end: addDays(gridStart, 41),
  });

  const canGoPrev = isBefore(startOfMonth(min), startOfMonth(month));
  const hasCompleteRange = value.start != null && value.end != null;
  const nights = value.start && value.end ? differenceInCalendarDays(value.end, value.start) : 0;

  // True if any day in (start, end] is marked unavailable — prevents selecting a
  // range that spans a booked night.
  const rangeCrossesDisabled = (start: Date, end: Date): boolean => {
    if (!isDateDisabled) return false;
    return eachDayOfInterval({ start, end }).some(
      (d) => !isSameDay(d, start) && isDateDisabled(d),
    );
  };

  const onDayPress = (day: Date) => {
    const { start, end } = value;
    if (!start || end) {
      onChange({ start: day, end: null });
      return;
    }
    if (isBefore(day, start) || isSameDay(day, start)) {
      onChange({ start: day, end: null });
      return;
    }
    // Restart the selection if the range would cross an unavailable day.
    if (rangeCrossesDisabled(start, day)) {
      onChange({ start: day, end: null });
      return;
    }
    onChange({ start, end: day });
  };

  const changeMonth = (delta: number) => {
    setMonth((current) => addMonths(current, delta));
  };

  return (
    <MaterialSurface level="raised" radius={22} style={{ paddingHorizontal: 12, paddingBottom: 14, paddingTop: 12 }}>
      <View className="flex-row items-center justify-between px-1 pb-3">
        <IconButton
          icon="chevron-back"
          iconSize={18}
          size={40}
          accessibilityLabel="Предыдущий месяц"
          disabled={!canGoPrev}
          onPress={() => changeMonth(-1)}
        />
        <Text className="text-[17px] font-extrabold capitalize text-ink">
          {format(month, 'LLLL yyyy', { locale: ru })}
        </Text>
        <IconButton
          icon="chevron-forward"
          iconSize={18}
          size={40}
          accessibilityLabel="Следующий месяц"
          onPress={() => changeMonth(1)}
        />
      </View>

      <View style={styles.gridFrame} onLayout={(event) => setGridWidth(event.nativeEvent.layout.width)}>
        <View style={styles.weekRow}>
          {WEEKDAYS.map((w) => (
            <View key={w} style={[styles.weekCell, { width: gridWidth > 0 ? gridWidth / 7 : 0 }]}>
              <Text className="text-center text-[11px] font-bold uppercase text-ink-muted">{w}</Text>
            </View>
          ))}
        </View>

        <View key={month.toISOString()} style={styles.calendarGrid}>
        {Array.from({ length: 6 }, (_, weekIndex) => (
          <View key={weekIndex} style={styles.calendarWeek}>
          {days.slice(weekIndex * 7, weekIndex * 7 + 7).map((day) => {
          const outside = !isSameMonth(day, month);
          const blocked = isDateDisabled?.(day) ?? false;
          const isPast = isBefore(day, min);
          const disabled = isPast || blocked;
          const isStart = value.start != null && isSameDay(day, value.start);
          const isEnd = value.end != null && isSameDay(day, value.end);
          const inRange =
            value.start != null &&
            value.end != null &&
            isWithinInterval(day, { start: value.start, end: value.end });
          const endpoint = isStart || isEnd;
          const selected = (endpoint || inRange) && !outside;
          const today = isSameDay(day, new Date());
          const dayTextColor = endpoint || inRange
            ? '#FFFFFF'
            : outside || disabled
              ? palette.inkMuted
              : inRange
                ? palette.primary
                : palette.ink;

          return (
            <View
              key={day.toISOString()}
              style={{ width: gridWidth > 0 ? gridWidth / 7 : 0, height: 46, alignItems: 'center', justifyContent: 'center' }}>
              <View
                pointerEvents="none"
                style={[
                  styles.dayVisual,
                  {
                    borderWidth: today && !endpoint ? 1.5 : 0,
                    borderColor: today && !endpoint ? palette.primary : 'transparent',
                    backgroundColor: selected ? palette.primary : 'transparent',
                    opacity: selected ? 1 : outside ? 0.22 : disabled ? 0.4 : 1,
                  },
                  endpoint ? styles.selectedEndpoint : null,
                ]}>
                <Text
                  style={{
                    fontSize: 14,
                    lineHeight: 18,
                    includeFontPadding: false,
                    textAlign: 'center',
                    fontWeight: endpoint || (inRange && !disabled) ? '800' : '500',
                    color: dayTextColor,
                    textDecorationLine: blocked && !outside && !selected ? 'line-through' : 'none',
                  }}>
                  {format(day, 'd')}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: disabled || outside, selected: endpoint }}
                disabled={disabled || outside}
                onPress={() => onDayPress(day)}
                style={StyleSheet.absoluteFill}
              />
            </View>
          );
          })}
          </View>
        ))}
        </View>
      </View>

      <View style={[styles.selectionPanel, { backgroundColor: palette.surfaceMuted }]}>
        <View style={styles.selectionHeader}>
          <View style={[styles.calendarIcon, { backgroundColor: palette.primaryLight }]}>
            <Ionicons name="calendar-clear" size={17} color={palette.primary} />
          </View>
          <Text style={{ flex: 1, fontSize: 12, fontWeight: '700', color: palette.inkSecondary }}>
            {hasCompleteRange ? `${nights} ${nightLabel(nights)}` : value.start ? 'Теперь выберите день выезда' : 'Сначала выберите день заезда'}
          </Text>
        </View>

        <View style={styles.selectionDates}>
          <View style={styles.dateColumn}>
            <Text style={[styles.dateCaption, { color: palette.inkMuted }]}>ЗАЕЗД</Text>
            <Text style={[styles.dateValue, { color: value.start ? palette.ink : palette.inkMuted }]}>
              {value.start ? format(value.start, 'd MMM', { locale: ru }) : 'Выберите'}
            </Text>
          </View>
          <View style={[styles.rangeArrow, { backgroundColor: hasCompleteRange ? palette.primaryLight : palette.surface }]}>
            <Ionicons name="arrow-forward" size={17} color={hasCompleteRange ? palette.primary : palette.inkMuted} />
          </View>
          <View style={styles.dateColumn}>
            <Text style={[styles.dateCaption, { color: palette.inkMuted }]}>ВЫЕЗД</Text>
            <Text style={[styles.dateValue, { color: value.end ? palette.ink : palette.inkMuted }]}>
              {value.end ? format(value.end, 'd MMM', { locale: ru }) : 'Выберите'}
            </Text>
          </View>
        </View>
      </View>
    </MaterialSurface>
  );
}

function nightLabel(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'ночь';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'ночи';
  return 'ночей';
}

const styles = StyleSheet.create({
  gridFrame: {
    width: '100%',
    alignSelf: 'stretch',
  },
  weekRow: {
    marginBottom: 4,
    flexDirection: 'row',
  },
  weekCell: {
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarGrid: {
    width: '100%',
  },
  calendarWeek: {
    width: '100%',
    height: 46,
    flexDirection: 'row',
  },
  dayVisual: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedEndpoint: {
    shadowColor: '#FF6B35',
    shadowOpacity: 0.34,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  selectionPanel: {
    marginHorizontal: 4,
    marginTop: 14,
    borderRadius: 18,
    padding: 12,
    gap: 11,
  },
  selectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  calendarIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectionDates: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  dateColumn: {
    flex: 1,
    gap: 3,
  },
  dateCaption: {
    fontSize: 10,
    fontWeight: '800',
  },
  dateValue: {
    fontSize: 15,
    fontWeight: '800',
    textTransform: 'capitalize',
  },
  rangeArrow: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
