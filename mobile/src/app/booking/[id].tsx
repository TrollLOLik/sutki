import { Ionicons } from '@expo/vector-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import { differenceInCalendarDays, format } from 'date-fns';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';

import { CalendarRange, type DateRange } from '@/components/CalendarRange';
import { Button, Input } from '@/components/ui';
import { useCreateBooking } from '@/lib/api/bookings';
import { useListing } from '@/lib/api/listings';
import { ApiError } from '@/lib/api/client';
import { formatGuests, formatPricePerNight, formatRub } from '@/lib/format';
import { useSessionStore } from '@/store/session';
import { palette } from '@/theme/tokens';

const ISO = 'yyyy-MM-dd';
const MAX_GUESTS = 20;

const schema = z.object({
  name: z.string().trim().min(1, 'Укажите имя'),
  phone: z.string().trim().min(5, 'Укажите телефон'),
  message: z.string().trim().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function BookingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const listingId = Number(id);
  const user = useSessionStore((s) => s.user);
  const { data: listing } = useListing(listingId);
  const createBooking = useCreateBooking(listingId);

  const [range, setRange] = useState<DateRange>({ start: null, end: null });
  const [count, setCount] = useState(1);
  const [dateError, setDateError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: user?.name ?? '', phone: user?.phone ?? '', message: '' },
  });

  const nights =
    range.start && range.end ? differenceInCalendarDays(range.end, range.start) : 0;
  const total = listing && nights > 0 ? listing.price * nights : 0;

  const onSubmit = handleSubmit(async (values) => {
    if (!range.start || !range.end) {
      setDateError('Выберите даты заезда и выезда');
      return;
    }
    setDateError(null);
    try {
      await createBooking.mutateAsync({
        count,
        name: values.name,
        phone: values.phone,
        message: values.message || undefined,
        start_date: format(range.start, ISO),
        end_date: format(range.end, ISO),
      });
      Alert.alert('Заявка отправлена', 'Владелец рассмотрит её в ближайшее время.', [
        { text: 'OK', onPress: () => router.replace('/bookings') },
      ]);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Не удалось отправить заявку. Попробуйте снова.';
      Alert.alert('Ошибка', message);
    }
  });

  return (
    <View className="flex-1 bg-surface">
      <SafeAreaView edges={['top']} className="flex-1">
        <View className="flex-row items-center gap-3 px-4 py-2">
          <Pressable
            onPress={() => router.back()}
            accessibilityLabel="Назад"
            className="h-10 w-10 items-center justify-center rounded-full bg-surface-muted">
            <Ionicons name="chevron-back" size={22} color={palette.ink} />
          </Pressable>
          <Text className="text-lg font-semibold text-ink">Заявка на аренду</Text>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="flex-1">
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerClassName="gap-5 px-4 pb-6 pt-2"
            keyboardShouldPersistTaps="handled">
            {listing ? (
              <View className="gap-1">
                <Text className="text-base font-semibold text-ink">{listing.address}</Text>
                <Text className="text-base text-primary">{formatPricePerNight(listing.price)}</Text>
              </View>
            ) : null}

            <View className="gap-2">
              <Text className="text-base font-semibold text-ink">Даты</Text>
              <CalendarRange value={range} onChange={setRange} />
              {dateError ? <Text className="text-sm text-danger">{dateError}</Text> : null}
            </View>

            <View className="gap-2">
              <Text className="text-base font-semibold text-ink">Гости</Text>
              <View className="flex-row items-center justify-between rounded-card border border-line px-4 py-3">
                <Text className="text-base text-ink">{formatGuests(count)}</Text>
                <View className="flex-row items-center gap-4">
                  <Stepper
                    icon="remove"
                    disabled={count <= 1}
                    onPress={() => setCount((c) => Math.max(1, c - 1))}
                  />
                  <Text className="w-6 text-center text-base font-semibold text-ink">{count}</Text>
                  <Stepper
                    icon="add"
                    disabled={count >= MAX_GUESTS}
                    onPress={() => setCount((c) => Math.min(MAX_GUESTS, c + 1))}
                  />
                </View>
              </View>
            </View>

            <View className="gap-3">
              <Text className="text-base font-semibold text-ink">Контактные данные</Text>
              <Controller
                control={control}
                name="name"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    icon="person-outline"
                    placeholder="Имя"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={errors.name?.message}
                  />
                )}
              />
              <Controller
                control={control}
                name="phone"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    icon="call-outline"
                    keyboardType="phone-pad"
                    placeholder="+7 999 000-00-00"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={errors.phone?.message}
                  />
                )}
              />
              <Controller
                control={control}
                name="message"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    icon="chatbubble-outline"
                    placeholder="Комментарий (необязательно)"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                  />
                )}
              />
            </View>

            {nights > 0 && listing ? (
              <View className="gap-2 rounded-card border border-line p-4">
                <Row label={`${formatPricePerNight(listing.price)} × ${nights}`} value={`${formatRub(total)}\u00A0₽`} />
                <View className="my-1 h-px bg-line" />
                <Row label="Итого" value={`${formatRub(total)}\u00A0₽`} bold />
              </View>
            ) : null}
          </ScrollView>

          <View className="border-t border-line px-4 py-3">
            <Button label="Отправить заявку" loading={createBooking.isPending} onPress={onSubmit} />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

function Stepper({
  icon,
  onPress,
  disabled,
}: {
  icon: 'add' | 'remove';
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      className="h-9 w-9 items-center justify-center rounded-full border border-line"
      style={disabled ? { opacity: 0.4 } : undefined}>
      <Ionicons name={icon} size={18} color={palette.ink} />
    </Pressable>
  );
}

function Row({ label, value, bold = false }: { label: string; value: string; bold?: boolean }) {
  return (
    <View className="flex-row items-center justify-between">
      <Text className={bold ? 'text-base font-semibold text-ink' : 'text-base text-ink-secondary'}>
        {label}
      </Text>
      <Text className={bold ? 'text-base font-bold text-ink' : 'text-base text-ink'}>{value}</Text>
    </View>
  );
}
