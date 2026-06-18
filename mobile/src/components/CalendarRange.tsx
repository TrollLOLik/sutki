import { Ionicons } from '@expo/vector-icons';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
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
import { Pressable, Text, View } from 'react-native';

import { cn } from '@/lib/cn';
import { palette } from '@/theme/tokens';

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
  const min = startOfDay(minDate ?? new Date());
  const [month, setMonth] = useState(() => startOfMonth(value.start ?? min));

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), WEEK_OPTS),
    end: endOfWeek(endOfMonth(month), WEEK_OPTS),
  });

  const canGoPrev = isBefore(startOfMonth(min), startOfMonth(month));

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

  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between">
        <Pressable
          accessibilityLabel="Предыдущий месяц"
          disabled={!canGoPrev}
          onPress={() => setMonth((m) => addMonths(m, -1))}
          className={cn(
            'h-9 w-9 items-center justify-center rounded-full bg-surface-muted',
            !canGoPrev && 'opacity-30',
          )}>
          <Ionicons name="chevron-back" size={18} color={palette.ink} />
        </Pressable>
        <Text className="text-base font-semibold capitalize text-ink">
          {format(month, 'LLLL yyyy', { locale: ru })}
        </Text>
        <Pressable
          accessibilityLabel="Следующий месяц"
          onPress={() => setMonth((m) => addMonths(m, 1))}
          className="h-9 w-9 items-center justify-center rounded-full bg-surface-muted">
          <Ionicons name="chevron-forward" size={18} color={palette.ink} />
        </Pressable>
      </View>

      <View className="flex-row">
        {WEEKDAYS.map((w) => (
          <Text key={w} className="flex-1 text-center text-xs font-medium text-ink-muted">
            {w}
          </Text>
        ))}
      </View>

      <View className="flex-row flex-wrap">
        {days.map((day) => {
          const outside = !isSameMonth(day, month);
          const blocked = isDateDisabled?.(day) ?? false;
          const disabled = isBefore(day, min) || blocked;
          const isStart = value.start != null && isSameDay(day, value.start);
          const isEnd = value.end != null && isSameDay(day, value.end);
          const inRange =
            value.start != null &&
            value.end != null &&
            isWithinInterval(day, { start: value.start, end: value.end });
          const endpoint = isStart || isEnd;

          return (
            <View key={day.toISOString()} className="items-center" style={{ width: `${100 / 7}%` }}>
              <Pressable
                accessibilityRole="button"
                disabled={disabled || outside}
                onPress={() => onDayPress(day)}
                className={cn(
                  'my-0.5 h-10 w-10 items-center justify-center rounded-full',
                  inRange && !endpoint && 'bg-primary-light',
                  endpoint && 'bg-primary',
                )}>
                <Text
                  className={cn(
                    'text-sm',
                    endpoint ? 'font-bold text-white' : 'text-ink',
                    inRange && !endpoint && 'text-primary',
                    (disabled || outside) && 'text-ink-muted opacity-40',
                    blocked && !outside && 'line-through',
                  )}>
                  {format(day, 'd')}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}
