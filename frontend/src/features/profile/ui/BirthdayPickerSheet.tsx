import { CalendarDays } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type UIEvent } from 'react';
import { Button, DialogActions, Modal } from '@shared/ui';

const MONTH_NAMES = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

const MINIMUM_AGE = 18;
const YEARS_IN_PICKER = 100;
const ROW_HEIGHT = 42;

function adultBirthdayCutoff(now = new Date()): Date {
  const targetYear = now.getFullYear() - MINIMUM_AGE;
  const lastDay = new Date(targetYear, now.getMonth() + 1, 0).getDate();
  return new Date(targetYear, now.getMonth(), Math.min(now.getDate(), lastDay));
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0, 12).getDate();
}

function clampBirthday(
  value: { day: number; month: number; year: number },
  cutoff: Date,
): { day: number; month: number; year: number } {
  const maxYear = cutoff.getFullYear();
  const year = Math.min(value.year, maxYear);
  const maxMonth = year === maxYear ? cutoff.getMonth() : 11;
  const month = Math.max(0, Math.min(value.month, maxMonth));
  const monthDays = daysInMonth(year, month);
  const maxDay = year === maxYear && month === cutoff.getMonth()
    ? Math.min(monthDays, cutoff.getDate())
    : monthDays;
  return { day: Math.max(1, Math.min(value.day, maxDay)), month, year };
}

function parseBirthday(value: string | null | undefined, cutoff: Date) {
  if (value) {
    const [year, month, day] = value.split('-').map(Number);
    if ([year, month, day].every(Number.isFinite)) {
      return clampBirthday({ day, month: month - 1, year }, cutoff);
    }
  }
  return clampBirthday({ day: 12, month: 4, year: cutoff.getFullYear() - 2 }, cutoff);
}

export function formatBirthday(value?: string | null): string {
  if (!value) return '';
  const [year, month, day] = value.split('-').map(Number);
  if (![year, month, day].every(Number.isFinite)) return value;
  return `${day} ${MONTH_NAMES[month - 1]} ${year}`;
}

function toIso(day: number, month: number, year: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function clampIndex(value: number, length: number): number {
  return Math.max(0, Math.min(length - 1, value));
}

interface WheelColumnProps<T> {
  items: T[];
  selectedIndex: number;
  getLabel: (item: T) => string;
  onSelect: (item: T, index: number) => void;
  className?: string;
  open: boolean;
}

function WheelColumn<T>({ items, selectedIndex, getLabel, onSelect, className = '', open }: WheelColumnProps<T>) {
  const ref = useRef<HTMLDivElement>(null);
  const timerRef = useRef<number | null>(null);
  const internalScrollRef = useRef(false);

  const scrollToIndex = useCallback((index: number, behavior: ScrollBehavior = 'smooth') => {
    const node = ref.current;
    if (!node) return;
    internalScrollRef.current = true;
    node.scrollTo({ top: clampIndex(index, items.length) * ROW_HEIGHT, behavior });
    window.setTimeout(() => { internalScrollRef.current = false; }, behavior === 'smooth' ? 260 : 30);
  }, [items.length]);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => scrollToIndex(selectedIndex, 'auto'));
    return () => window.cancelAnimationFrame(frame);
  }, [open, scrollToIndex, selectedIndex]);

  useEffect(() => () => {
    if (timerRef.current != null) window.clearTimeout(timerRef.current);
  }, []);

  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    if (timerRef.current != null) window.clearTimeout(timerRef.current);
    const node = event.currentTarget;
    timerRef.current = window.setTimeout(() => {
      const index = clampIndex(Math.round(node.scrollTop / ROW_HEIGHT), items.length);
      const item = items[index];
      if (item != null) onSelect(item, index);
      if (!internalScrollRef.current) node.scrollTo({ top: index * ROW_HEIGHT, behavior: 'smooth' });
    }, 85);
  };

  return (
    <div
      ref={ref}
      className={`birthday-wheel ${className}`.trim()}
      data-lenis-prevent=""
      onScroll={handleScroll}
      role="listbox"
      aria-label={className.includes('month') ? 'Месяц' : className.includes('year') ? 'Год' : 'День'}
    >
      {items.map((item, index) => (
        <Button
          key={`${getLabel(item)}-${index}`}
          size="sm"
          mode="ghost"
          tone="neutral"
          role="option"
          aria-selected={index === selectedIndex}
          className={index === selectedIndex ? 'selected' : ''}
          onClick={() => {
            onSelect(item, index);
            scrollToIndex(index);
          }}
        >
          {getLabel(item)}
        </Button>
      ))}
    </div>
  );
}

export function BirthdayPickerSheet({
  open,
  value,
  onClose,
  onApply,
}: {
  open: boolean;
  value?: string | null;
  onClose: () => void;
  onApply: (isoDate: string) => void;
  desktopModal?: boolean;
}) {
  const cutoff = useMemo(() => adultBirthdayCutoff(), [open]);
  const maxYear = cutoff.getFullYear();
  const initial = useMemo(() => parseBirthday(value, cutoff), [cutoff, value]);
  const [day, setDay] = useState(initial.day);
  const [month, setMonth] = useState(initial.month);
  const [year, setYear] = useState(initial.year);

  const years = useMemo(() => Array.from({ length: YEARS_IN_PICKER }, (_, index) => maxYear - index), [maxYear]);
  const months = useMemo(
    () => Array.from({ length: year === maxYear ? cutoff.getMonth() + 1 : 12 }, (_, index) => index),
    [cutoff, maxYear, year],
  );
  const calendarDaysCount = daysInMonth(year, month);
  const daysCount = year === maxYear && month === cutoff.getMonth()
    ? Math.min(calendarDaysCount, cutoff.getDate())
    : calendarDaysCount;
  const days = useMemo(() => Array.from({ length: daysCount }, (_, index) => index + 1), [daysCount]);

  useEffect(() => {
    if (!open) return;
    const next = parseBirthday(value, cutoff);
    setDay(next.day);
    setMonth(next.month);
    setYear(next.year);
  }, [cutoff, open, value]);

  useEffect(() => {
    if (day > daysCount) setDay(daysCount);
  }, [day, daysCount]);

  const selectedYearIndex = Math.max(0, years.indexOf(year));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Дата рождения"
      description={`${day} ${MONTH_NAMES[month]} ${year}`}
      icon={<CalendarDays />}
      size="sm"
      className="birthday-picker-sheet"
      bodyClassName="birthday-picker-body"
      footer={(
        <DialogActions
          reset={<Button size="md" mode="outline" tone="neutral" stretched onClick={onClose}>Отмена</Button>}
          primary={<Button size="md" mode="solid" tone="primary" stretched onClick={() => onApply(toIso(day, month, year))}>Применить</Button>}
        />
      )}
    >
      <div className="birthday-wheel-card">
        <div className="birthday-wheel-highlight" aria-hidden="true" />
        <div className="birthday-wheel-columns">
          <WheelColumn
            open={open}
            items={days}
            selectedIndex={Math.max(0, day - 1)}
            getLabel={String}
            onSelect={setDay}
            className="birthday-wheel-day"
          />
          <WheelColumn
            open={open}
            items={months}
            selectedIndex={month}
            getLabel={(item) => MONTH_NAMES[item]}
            onSelect={(item) => {
              const next = clampBirthday({ day, month: item, year }, cutoff);
              setDay(next.day);
              setMonth(next.month);
            }}
            className="birthday-wheel-month"
          />
          <WheelColumn
            open={open}
            items={years}
            selectedIndex={selectedYearIndex}
            getLabel={String}
            onSelect={(item) => {
              const next = clampBirthday({ day, month, year: item }, cutoff);
              setDay(next.day);
              setMonth(next.month);
              setYear(next.year);
            }}
            className="birthday-wheel-year"
          />
        </div>
      </div>
    </Modal>
  );
}
