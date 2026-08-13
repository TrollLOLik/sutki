import { addDays, format, parseISO } from 'date-fns';
import { useLayoutEffect, useState } from 'react';

import { CalendarRange, type DateRange } from '@/components/CalendarRange';
import { BottomSheet, Button, DialogActions } from '@/components/ui';

interface DatePickerSheetProps {
  visible: boolean;
  onClose: () => void;
  onApply: (checkIn: string | null, checkOut: string | null) => void;
  checkIn?: string | null;
  checkOut?: string | null;
  isDateDisabled?: (day: Date) => boolean;
}

export function DatePickerSheet({
  visible,
  onClose,
  onApply,
  checkIn,
  checkOut,
  isDateDisabled,
}: DatePickerSheetProps) {
  const [tempRange, setTempRange] = useState<DateRange>({ start: null, end: null });

  useLayoutEffect(() => {
    if (!visible) return;
    setTempRange({
      start: checkIn ? parseISO(checkIn) : null,
      end: checkOut ? parseISO(checkOut) : null,
    });
  }, [visible, checkIn, checkOut]);

  const handleReset = () => setTempRange({ start: null, end: null });

  const handleApply = () => {
    if (tempRange.start) {
      const start = format(tempRange.start, 'yyyy-MM-dd');
      const end = format(tempRange.end ?? addDays(tempRange.start, 1), 'yyyy-MM-dd');
      onApply(start, end);
    } else {
      onApply(null, null);
    }
    onClose();
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      height="82%"
      title="Выберите даты"
      subtitle="Укажите день заезда и выезда"
      icon="calendar-outline"
      bodyStyle={{ paddingTop: 10 }}
      footer={
        <DialogActions
          reset={<Button label="Сбросить" variant="ghost" size="md" onPress={handleReset} />}
          primary={<Button label="Применить" size="md" onPress={handleApply} />}
        />
      }>
      <CalendarRange value={tempRange} onChange={setTempRange} isDateDisabled={isDateDisabled} />
    </BottomSheet>
  );
}
