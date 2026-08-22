import { ArrowRight, CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { BadgeText, BodyText, IconButton, Pressable, SectionTitle } from '@ui';

export interface DateRangeValue {
  start: string | null;
  end: string | null;
}

interface CalendarRangeProps {
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
  minDate?: string;
  maxDate?: string;
  isDateDisabled?: (isoDate: string) => boolean;
  className?: string;
}

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const monthFormatter = new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' });
const shortDateFormatter = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' });

function localToday(): string {
  return toIso(new Date());
}

function parseIso(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function toIso(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1, 12);
}

function addDays(date: Date, amount: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function addMonths(date: Date, amount: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1, 12);
}

function startOfCalendarGrid(month: Date): Date {
  const first = startOfMonth(month);
  const mondayIndex = (first.getDay() + 6) % 7;
  return addDays(first, -mondayIndex);
}

function sameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

function nightsBetween(start: string | null, end: string | null): number {
  if (!start || !end) return 0;
  return Math.max(0, Math.round((parseIso(end).getTime() - parseIso(start).getTime()) / 86_400_000));
}

function nightLabel(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'ночь';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'ночи';
  return 'ночей';
}

export function CalendarRange({
  value,
  onChange,
  minDate = localToday(),
  maxDate,
  isDateDisabled,
  className = '',
}: CalendarRangeProps) {
  const effectiveMinDate = minDate > localToday() ? minDate : localToday();
  const initialMonth = value.start ? parseIso(value.start) : parseIso(effectiveMinDate);
  const [month, setMonth] = useState(() => startOfMonth(initialMonth));

  useEffect(() => {
    if (value.start) setMonth(startOfMonth(parseIso(value.start)));
  }, [value.start]);

  const days = useMemo(() => {
    const first = startOfCalendarGrid(month);
    return Array.from({ length: 42 }, (_, index) => addDays(first, index));
  }, [month]);

  const minMonth = startOfMonth(parseIso(effectiveMinDate));
  const maxMonth = maxDate ? startOfMonth(parseIso(maxDate)) : null;
  const canGoPrev = month.getTime() > minMonth.getTime();
  const canGoNext = !maxMonth || month.getTime() < maxMonth.getTime();
  const nights = nightsBetween(value.start, value.end);

  const disabled = (iso: string): boolean => {
    if (iso < effectiveMinDate) return true;
    if (maxDate && iso > maxDate) return true;
    return isDateDisabled?.(iso) ?? false;
  };

  const rangeCrossesDisabled = (start: string, end: string): boolean => {
    let cursor = addDays(parseIso(start), 1);
    const last = parseIso(end);
    while (cursor.getTime() <= last.getTime()) {
      if (disabled(toIso(cursor))) return true;
      cursor = addDays(cursor, 1);
    }
    return false;
  };

  const selectDay = (iso: string) => {
    if (disabled(iso)) return;
    if (!value.start || value.end || iso <= value.start) {
      onChange({ start: iso, end: null });
      return;
    }
    if (rangeCrossesDisabled(value.start, iso)) {
      onChange({ start: iso, end: null });
      return;
    }
    onChange({ start: value.start, end: iso });
  };

  return (
    <section className={`calendar-range ${className}`.trim()} aria-label="Календарь выбора дат">
      <header className="calendar-range-header">
        <IconButton label="Предыдущий месяц" size="sm" variant="plain" icon={<ChevronLeft size={19} />} disabled={!canGoPrev} onClick={() => setMonth((current) => addMonths(current, -1))} />
        <SectionTitle as="strong">{monthFormatter.format(month)}</SectionTitle>
        <IconButton label="Следующий месяц" size="sm" variant="plain" icon={<ChevronRight size={19} />} disabled={!canGoNext} onClick={() => setMonth((current) => addMonths(current, 1))} />
      </header>

      <div className="calendar-weekdays" aria-hidden="true">
        {WEEKDAYS.map((weekday) => <BadgeText className="ui-text--inherit-metrics" color="inherit" key={weekday}>{weekday}</BadgeText>)}
      </div>

      <div className="calendar-days">
        {days.map((day) => {
          const iso = toIso(day);
          const outside = !sameMonth(day, month);
          const isDisabled = outside || disabled(iso);
          const isStart = value.start === iso;
          const isEnd = value.end === iso;
          const inRange = Boolean(value.start && value.end && iso > value.start && iso < value.end);
          const today = iso === localToday();
          return (
            <Pressable
              key={iso}
              type="button"
              disabled={isDisabled}
              aria-label={shortDateFormatter.format(day)}
              aria-pressed={isStart || isEnd}
              className={[
                outside ? 'outside' : '',
                isDisabled ? 'disabled' : '',
                isStart ? 'range-start' : '',
                isEnd ? 'range-end' : '',
                inRange ? 'in-range' : '',
                today ? 'today' : '',
              ].filter(Boolean).join(' ')}
              onClick={() => selectDay(iso)}
            >
              <BodyText className="ui-text--inherit-metrics" color="inherit">{day.getDate()}</BodyText>
            </Pressable>
          );
        })}
      </div>

      <div className="calendar-selection-panel">
        <div className="calendar-selection-hint">
          <span><CalendarDays size={17} /></span>
          <BodyText as="strong" weight={500}>{value.start && value.end ? `${nights} ${nightLabel(nights)}` : value.start ? 'Теперь выберите день выезда' : 'Сначала выберите день заезда'}</BodyText>
        </div>
        <div className="calendar-selection-dates">
          <div><BadgeText as="small">ЗАЕЗД</BadgeText><BodyText as="strong" className={!value.start ? 'calendar-selection-placeholder' : undefined} weight={value.start ? 500 : 400}>{value.start ? shortDateFormatter.format(parseIso(value.start)) : 'Выберите'}</BodyText></div>
          <span className={value.start && value.end ? 'complete' : ''}><ArrowRight size={17} /></span>
          <div><BadgeText as="small">ВЫЕЗД</BadgeText><BodyText as="strong" className={!value.end ? 'calendar-selection-placeholder' : undefined} weight={value.end ? 500 : 400}>{value.end ? shortDateFormatter.format(parseIso(value.end)) : 'Выберите'}</BodyText></div>
        </div>
      </div>
    </section>
  );
}
