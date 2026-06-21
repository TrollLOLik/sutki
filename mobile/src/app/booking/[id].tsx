import { Ionicons } from '@expo/vector-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import { addDays, differenceInCalendarDays, format, parseISO, startOfDay } from 'date-fns';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';

import { CalendarRange, type DateRange } from '@/components/CalendarRange';
import { Button, Input } from '@/components/ui';
import { useCreateBooking, useListingAvailability } from '@/lib/api/bookings';
import { useListing } from '@/lib/api/listings';
import { ApiError } from '@/lib/api/client';
import { formatGuests, formatPricePerNight, formatRub } from '@/lib/format';
import { useSessionStore } from '@/store/session';
import { palette } from '@/theme/tokens';

const ISO = 'yyyy-MM-dd';
const MAX_GUESTS = 20;

// ---------------------------------------------------------------------------
// Phone mask helpers
// ---------------------------------------------------------------------------

/** Strip everything but digits; if number starts with 7/8 and is 11 digits, drop the prefix. */
function normalizePhoneDigits(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if ((digits.startsWith('7') || digits.startsWith('8')) && digits.length === 11) {
    return digits.slice(1);
  }
  return digits.slice(0, 10);
}

/** Format up to 10 digits as (XXX) XXX-XX-XX */
function formatPhoneMask(digits: string): string {
  const d = digits.replace(/\D/g, '').slice(0, 10);
  let result = '';
  if (d.length > 0) result += '(' + d.slice(0, Math.min(d.length, 3));
  if (d.length >= 3) result += ') ' + d.slice(3, Math.min(d.length, 6));
  if (d.length >= 6) result += '-' + d.slice(6, Math.min(d.length, 8));
  if (d.length >= 8) result += '-' + d.slice(8, 10);
  return result;
}

/** Extract raw 10 digits from masked value, then build +7XXXXXXXXXX for the API. */
function toFullPhone(masked: string): string {
  const digits = masked.replace(/\D/g, '').slice(0, 10);
  return '+7' + digits;
}

// ---------------------------------------------------------------------------
// Validation schema
// ---------------------------------------------------------------------------

const schema = z.object({
  name: z.string().trim().min(1, 'Укажите имя'),
  /** Stores masked value like "(999) 888-77-66" – must contain exactly 10 digits. */
  phone: z.string().refine(
    (v) => v.replace(/\D/g, '').length === 10,
    'Укажите полный номер (10 цифр)',
  ),
  message: z.string().trim().optional(),
});

type FormValues = z.infer<typeof schema>;

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function BookingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const listingId = Number(id);
  const user = useSessionStore((s) => s.user);
  const { data: listing } = useListing(listingId);
  const { data: availability } = useListingAvailability(listingId);
  const createBooking = useCreateBooking(listingId);

  const [range, setRange] = useState<DateRange>({ start: null, end: null });
  const [count, setCount] = useState(1);
  const [dateError, setDateError] = useState<string | null>(null);

  // Pre-fill phone from profile (normalise and mask)
  const initialPhone = useMemo(() => {
    if (!user?.phone) return '';
    return formatPhoneMask(normalizePhoneDigits(user.phone));
  }, [user?.phone]);

  const isDateDisabled = useMemo(() => {
    const ranges = (availability?.ranges ?? []).map((r) => {
      const start = startOfDay(parseISO(r.start_date));
      const end = r.end_date ? startOfDay(parseISO(r.end_date)) : addDays(start, 1);
      return { start, end };
    });
    return (day: Date) => {
      const d = startOfDay(day);
      return ranges.some((r) => d >= r.start && d < r.end);
    };
  }, [availability]);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: user?.name ?? '', phone: initialPhone, message: '' },
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
        surname: user?.surname || undefined,
        phone: toFullPhone(values.phone),
        message: values.message || undefined,
        start_date: format(range.start, ISO),
        end_date: format(range.end, ISO),
      });
      Alert.alert('Заявка отправлена', 'Владелец рассмотрит её в ближайшее время.', [
        { text: 'OK', onPress: () => router.replace('/bookings') },
      ]);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setDateError('Эти даты уже заняты. Выберите другие.');
        setRange({ start: null, end: null });
        Alert.alert(
          'Даты заняты',
          'На выбранные даты уже есть подтверждённое бронирование. Пожалуйста, выберите другие даты.',
        );
        return;
      }
      const message =
        err instanceof ApiError ? err.message : 'Не удалось отправить заявку. Попробуйте снова.';
      Alert.alert('Ошибка', message);
    }
  });

  return (
    <View className="flex-1 bg-surface">
      <SafeAreaView edges={['top']} className="flex-1">

        {/* ── Header (centred title) ─────────────────────────────── */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderBottomWidth: 1,
            borderBottomColor: palette.line,
          }}
        >
          <Pressable
            onPress={() => router.back()}
            accessibilityLabel="Назад"
            style={{
              width: 40, height: 40,
              alignItems: 'center', justifyContent: 'center',
              borderRadius: 20,
              backgroundColor: palette.surfaceMuted,
            }}
          >
            <Ionicons name="chevron-back" size={22} color={palette.ink} />
          </Pressable>

          <Text
            style={{
              flex: 1,
              textAlign: 'center',
              fontSize: 17,
              fontWeight: '600',
              color: palette.ink,
            }}
          >
            Заявка на аренду
          </Text>

          {/* Placeholder to keep title centred */}
          <View style={{ width: 40 }} />
        </View>

        {/* ── Content ───────────────────────────────────────────── */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="flex-1">
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ gap: 20, paddingHorizontal: 16, paddingBottom: 24, paddingTop: 16 }}
            keyboardShouldPersistTaps="handled">

            {listing ? (
              <View style={{ gap: 2 }}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: palette.ink }}>
                  {listing.address}
                </Text>
                <Text style={{ fontSize: 14, color: palette.primary }}>
                  {formatPricePerNight(listing.price)}
                </Text>
              </View>
            ) : null}

            <View style={{ gap: 8 }}>
              <Text style={{ fontSize: 15, fontWeight: '600', color: palette.ink }}>Даты</Text>
              <CalendarRange value={range} onChange={setRange} isDateDisabled={isDateDisabled} />
              <View className="flex-row items-center gap-1.5 mt-0.5 px-0.5">
                <View className="h-2.5 w-2.5 rounded-full bg-danger-light border border-danger/30" />
                <Text style={{ fontSize: 12, color: palette.inkSecondary }}>
                  Занятые даты
                </Text>
              </View>
              {dateError ? (
                <Text style={{ fontSize: 13, color: palette.danger }}>{dateError}</Text>
              ) : null}
            </View>

            {/* Guests stepper */}
            <View style={{ gap: 8 }}>
              <Text style={{ fontSize: 15, fontWeight: '600', color: palette.ink }}>Гости</Text>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: palette.line,
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                }}
              >
                <Text style={{ fontSize: 15, color: palette.ink }}>{formatGuests(count)}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                  <Stepper
                    icon="remove"
                    disabled={count <= 1}
                    onPress={() => setCount((c) => Math.max(1, c - 1))}
                  />
                  <Text style={{ width: 24, textAlign: 'center', fontSize: 15, fontWeight: '600', color: palette.ink }}>
                    {count}
                  </Text>
                  <Stepper
                    icon="add"
                    disabled={count >= MAX_GUESTS}
                    onPress={() => setCount((c) => Math.min(MAX_GUESTS, c + 1))}
                  />
                </View>
              </View>
            </View>

            {/* Contact details */}
            <View style={{ gap: 10 }}>
              <Text style={{ fontSize: 15, fontWeight: '600', color: palette.ink }}>
                Контактные данные
              </Text>

              {/* Name */}
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

              {/* Phone with RU flag + +7 prefix + mask */}
              <Controller
                control={control}
                name="phone"
                render={({ field: { onChange, onBlur, value } }) => (
                  <PhoneInput
                    value={value}
                    onChange={onChange}
                    onBlur={onBlur}
                    error={errors.phone?.message}
                  />
                )}
              />

              {/* Comment */}
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

            {/* Price breakdown */}
            {nights > 0 && listing ? (
              <View
                style={{
                  gap: 8,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: palette.line,
                  padding: 16,
                }}
              >
                <Row
                  label={`${formatPricePerNight(listing.price)} × ${nights}`}
                  value={`${formatRub(total)}\u00A0₽`}
                />
                <View style={{ height: 1, backgroundColor: palette.line }} />
                <Row label="Итого" value={`${formatRub(total)}\u00A0₽`} bold />
              </View>
            ) : null}
          </ScrollView>

          <View
            style={{
              borderTopWidth: 1,
              borderTopColor: palette.line,
              paddingHorizontal: 16,
              paddingTop: 12,
              paddingBottom: 8,
            }}
          >
            <Button label="Отправить заявку" loading={createBooking.isPending} onPress={onSubmit} />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Phone input with RU flag, +7 prefix and mask
// ---------------------------------------------------------------------------

interface PhoneInputProps {
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  error?: string;
}

function PhoneInput({ value, onChange, onBlur, error }: PhoneInputProps) {
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const handleChangeText = (text: string) => {
    // Keep only digits, limit to 10
    const digits = text.replace(/\D/g, '').slice(0, 10);
    onChange(formatPhoneMask(digits));
  };

  const borderColor = error
    ? palette.danger
    : focused
    ? palette.primary
    : palette.line;

  return (
    <View style={{ width: '100%' }}>
      <TouchableOpacity
        activeOpacity={1}
        onPress={() => inputRef.current?.focus()}
        style={{
          height: 56,
          flexDirection: 'row',
          alignItems: 'center',
          borderRadius: 12,
          borderWidth: 1,
          borderColor,
          backgroundColor: palette.surface,
          paddingHorizontal: 14,
          gap: 10,
        }}
      >
        {/* Flag + prefix */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingRight: 10,
            borderRightWidth: 1,
            borderRightColor: palette.line,
          }}
        >
          <Text style={{ fontSize: 20, lineHeight: 24 }}>🇷🇺</Text>
          <Text
            style={{
              fontSize: 15,
              fontWeight: '600',
              color: focused ? palette.primary : palette.ink,
              letterSpacing: 0.3,
            }}
          >
            +7
          </Text>
        </View>

        {/* Masked input */}
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={handleChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            onBlur?.();
          }}
          keyboardType="phone-pad"
          placeholder="(999) 000-00-00"
          placeholderTextColor={palette.inkMuted}
          style={{
            flex: 1,
            fontSize: 15,
            color: palette.ink,
          }}
          maxLength={15} // "(XXX) XXX-XX-XX" = 15 chars
        />
      </TouchableOpacity>

      {error ? (
        <Text style={{ marginTop: 6, paddingHorizontal: 4, fontSize: 12, fontWeight: '500', color: palette.danger }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
      style={[
        {
          width: 36, height: 36,
          alignItems: 'center', justifyContent: 'center',
          borderRadius: 18,
          borderWidth: 1,
          borderColor: palette.line,
        },
        disabled ? { opacity: 0.4 } : undefined,
      ]}
    >
      <Ionicons name={icon} size={18} color={palette.ink} />
    </Pressable>
  );
}

function Row({ label, value, bold = false }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Text
        style={{
          fontSize: 15,
          color: bold ? palette.ink : palette.inkSecondary,
          fontWeight: bold ? '600' : '400',
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontSize: 15,
          color: palette.ink,
          fontWeight: bold ? '700' : '400',
        }}
      >
        {value}
      </Text>
    </View>
  );
}
