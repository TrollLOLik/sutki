import { Ionicons } from '@expo/vector-icons';
import { addDays, format, parseISO } from 'date-fns';
import { useState, useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';

import { CalendarRange, type DateRange } from '@/components/CalendarRange';
import { Button, BottomSheet } from '@/components/ui';
import { palette } from '@/theme/tokens';

interface DatePickerSheetProps {
  visible: boolean;
  onClose: () => void;
  /**
   * Called with (checkIn, checkOut) ISO strings when the user applies,
   * or (null, null) when cleared.
   */
  onApply: (checkIn: string | null, checkOut: string | null) => void;
  /** Initial check-in ISO date string. */
  checkIn?: string | null;
  /** Initial check-out ISO date string. */
  checkOut?: string | null;
  /** Optional predicate to mark individual days as unavailable. */
  isDateDisabled?: (day: Date) => boolean;
}

/**
 * A unified date-range picker bottom-sheet modal used across the app
 * (main search bar, filters screen, etc.).
 */
export function DatePickerSheet({
  visible,
  onClose,
  onApply,
  checkIn,
  checkOut,
  isDateDisabled,
}: DatePickerSheetProps) {
  const [tempRange, setTempRange] = useState<DateRange>({ start: null, end: null });

  // Sync external values when sheet opens
  useEffect(() => {
    if (visible) {
      setTempRange({
        start: checkIn ? parseISO(checkIn) : null,
        end: checkOut ? parseISO(checkOut) : null,
      });
    }
  }, [visible, checkIn, checkOut]);

  const handleReset = () => {
    setTempRange({ start: null, end: null });
  };

  const handleApply = () => {
    if (tempRange.start) {
      const startStr = format(tempRange.start, 'yyyy-MM-dd');
      const endStr = tempRange.end
        ? format(tempRange.end, 'yyyy-MM-dd')
        : format(addDays(tempRange.start, 1), 'yyyy-MM-dd');
      onApply(startStr, endStr);
    } else {
      onApply(null, null);
    }
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: 16,
          marginBottom: 16,
          borderBottomWidth: 1,
          borderBottomColor: '#E8E8E8',
        }}
      >
        <Pressable
          onPress={handleReset}
          hitSlop={8}
          style={{ minWidth: 80, paddingVertical: 4 }}
        >
          <Text style={{ fontSize: 14, fontWeight: '600', color: palette.primary }}>
            Сбросить
          </Text>
        </Pressable>

        <Text style={{ fontSize: 17, fontWeight: '700', color: palette.ink }}>
          Выберите даты
        </Text>

        <Pressable
          onPress={onClose}
          hitSlop={8}
          style={{ minWidth: 80, paddingVertical: 4, alignItems: 'flex-end' }}
        >
          <Ionicons name="close" size={24} color={palette.ink} />
        </Pressable>
      </View>

      {/* Calendar */}
      <CalendarRange
        value={tempRange}
        onChange={setTempRange}
        isDateDisabled={isDateDisabled}
      />

      {/* Apply button */}
      <View style={{ marginTop: 16 }}>
        <Button label="Применить" onPress={handleApply} />
      </View>
    </BottomSheet>
  );
}
