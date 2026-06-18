import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, ScrollView, Text, View } from 'react-native';

import { Button } from '@/components/ui';
import { palette, radii } from '@/theme/tokens';

const MONTH_NAMES = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

const CURRENT_YEAR = new Date().getFullYear();
const ROW = 40;

interface BirthdayPickerSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Applies the chosen date as an ISO `YYYY-MM-DD` string. */
  onApply: (isoDate: string) => void;
  /** Initial value as `YYYY-MM-DD` (or empty for a default ~20yo). */
  initialValue?: string;
}

function parseInitial(value?: string): { d: number; m: number; y: number } {
  if (value) {
    const [y, m, d] = value.split('-').map((p) => parseInt(p, 10));
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) return { d, m: m - 1, y };
  }
  return { d: 12, m: 4, y: CURRENT_YEAR - 20 };
}

/** Bottom-sheet wheel date picker. Selection is by tap; value is `YYYY-MM-DD`. */
export function BirthdayPickerSheet({ visible, onClose, onApply, initialValue }: BirthdayPickerSheetProps) {
  const init = parseInitial(initialValue);
  const [day, setDay] = useState(init.d);
  const [month, setMonth] = useState(init.m);
  const [year, setYear] = useState(init.y);

  const dayRef = useRef<ScrollView>(null);
  const monthRef = useRef<ScrollView>(null);
  const yearRef = useRef<ScrollView>(null);

  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(400)).current;

  useEffect(() => {
    if (!visible) return;
    const next = parseInitial(initialValue);
    setDay(next.d);
    setMonth(next.m);
    setYear(next.y);
    fade.setValue(0);
    slide.setValue(400);
    requestAnimationFrame(() => {
      Animated.parallel([
        Animated.timing(fade, { toValue: 0.4, duration: 250, useNativeDriver: true }),
        Animated.timing(slide, {
          toValue: 0,
          duration: 250,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start(() => {
        setTimeout(() => {
          dayRef.current?.scrollTo({ y: (next.d - 1) * ROW, animated: false });
          monthRef.current?.scrollTo({ y: next.m * ROW, animated: false });
          yearRef.current?.scrollTo({ y: (CURRENT_YEAR - next.y) * ROW, animated: false });
        }, 60);
      });
    });
  }, [visible, initialValue, fade, slide]);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(slide, {
        toValue: 400,
        duration: 200,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start(() => onClose());
  };

  const selectDay = (d: number) => {
    setDay(d);
    dayRef.current?.scrollTo({ y: (d - 1) * ROW, animated: true });
  };
  const selectMonth = (m: number) => {
    setMonth(m);
    monthRef.current?.scrollTo({ y: m * ROW, animated: true });
  };
  const selectYear = (y: number) => {
    setYear(y);
    yearRef.current?.scrollTo({ y: (CURRENT_YEAR - y) * ROW, animated: true });
  };

  const apply = () => {
    const dStr = day.toString().padStart(2, '0');
    const mStr = (month + 1).toString().padStart(2, '0');
    onApply(`${year}-${mStr}-${dStr}`);
  };

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={handleClose}>
      <View className="flex-1 justify-end">
        <Animated.View
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'black', opacity: fade }}
        >
          <Pressable style={{ flex: 1 }} onPress={handleClose} />
        </Animated.View>

        <Animated.View
          style={{
            transform: [{ translateY: slide }],
            backgroundColor: palette.surface,
            borderTopLeftRadius: radii.card,
            borderTopRightRadius: radii.card,
          }}
          className="px-4 pb-8 pt-4"
        >
          <View className="items-center pb-4 border-b border-line">
            <View className="h-1 w-12 rounded-full bg-line mb-3" />
            <Text className="text-lg font-bold text-ink">Выберите дату рождения</Text>
          </View>

          <View className="flex-row justify-center py-6 h-48">
            <ScrollView
              ref={dayRef}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ alignItems: 'center', paddingVertical: 76 }}
              className="w-16"
            >
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                <Pressable key={d} onPress={() => selectDay(d)} style={{ height: ROW }} className="w-full items-center justify-center">
                  <Text className="text-lg" style={day === d ? { color: palette.primary, fontWeight: '700' } : { color: palette.inkSecondary }}>{d}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <ScrollView
              ref={monthRef}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ alignItems: 'center', paddingVertical: 76 }}
              className="flex-1"
            >
              {MONTH_NAMES.map((m, idx) => (
                <Pressable key={m} onPress={() => selectMonth(idx)} style={{ height: ROW }} className="w-full items-center justify-center">
                  <Text className="text-lg capitalize" style={month === idx ? { color: palette.primary, fontWeight: '700' } : { color: palette.inkSecondary }}>{m}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <ScrollView
              ref={yearRef}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ alignItems: 'center', paddingVertical: 76 }}
              className="w-24"
            >
              {Array.from({ length: 80 }, (_, i) => CURRENT_YEAR - i).map((y) => (
                <Pressable key={y} onPress={() => selectYear(y)} style={{ height: ROW }} className="w-full items-center justify-center">
                  <Text className="text-lg" style={year === y ? { color: palette.primary, fontWeight: '700' } : { color: palette.inkSecondary }}>{y}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          <Button label="Применить" onPress={apply} />
        </Animated.View>
      </View>
    </Modal>
  );
}

/** Format a `YYYY-MM-DD` string as e.g. "12 мая 2001" for display. */
export function formatBirthday(value?: string | null): string {
  if (!value) return '';
  const [y, m, d] = value.split('-').map((p) => parseInt(p, 10));
  if (isNaN(y) || isNaN(m) || isNaN(d)) return value;
  return `${d} ${MONTH_NAMES[m - 1]} ${y}`;
}
