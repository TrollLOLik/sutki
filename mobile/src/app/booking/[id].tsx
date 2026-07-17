import { Ionicons } from '@expo/vector-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import { addDays, differenceInCalendarDays, format, parseISO, startOfDay } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Image } from 'expo-image';
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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { z } from 'zod';

import { CalendarRange, type DateRange } from '@/components/CalendarRange';
import { Button, Input } from '@/components/ui';
import { PhoneInput } from '@/components/PhoneInput'; // Shared component
import { useCreateBooking, useListingAvailability } from '@/lib/api/bookings';
import { useListing } from '@/lib/api/listings';
import { ApiError } from '@/lib/api/client';
import { requestPhoneCode } from '@/lib/api/auth';
import { formatGuests, formatPricePerNight, formatRub, formatNights } from '@/lib/format';
import { useSessionStore } from '@/store/session';
import { useAppTheme } from '@/theme/useAppTheme';

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

const baseSchema = z.object({
  name: z.string().trim().min(1, 'Укажите имя'),
  /** Stores masked value like "(999) 888-77-66" – must contain exactly 10 digits. */
  phone: z.string().refine(
    (v) => v.replace(/\D/g, '').length === 10,
    'Укажите полный номер (10 цифр)',
  ),
  message: z.string().trim().optional(),
});

type FormValues = z.infer<typeof baseSchema>;

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function BookingScreen() {
  const { palette } = useAppTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const listingId = Number(id);
  const user = useSessionStore((s) => s.user);
  const status = useSessionStore((s) => s.status);
  const isGuest = status === 'guest';
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

  const insets = useSafeAreaInsets();

  const blockRanges = useMemo(() => {
    return (availability?.ranges ?? [])
      .filter((r) => r.status === 'confirmed' || r.status === 'active')
      .map((r) => {
        const start = startOfDay(parseISO(r.start_date));
        const end = r.end_date ? startOfDay(parseISO(r.end_date)) : addDays(start, 1);
        return { start, end };
      });
  }, [availability]);

  const warnRanges = useMemo(() => {
    return (availability?.ranges ?? [])
      .filter((r) => r.status === 'in_progress' || r.status === 'pending')
      .map((r) => {
        const start = startOfDay(parseISO(r.start_date));
        const end = r.end_date ? startOfDay(parseISO(r.end_date)) : addDays(start, 1);
        return { start, end };
      });
  }, [availability]);

  const isDateDisabled = useMemo(() => {
    return (day: Date) => {
      const d = startOfDay(day);
      return blockRanges.some((r) => d >= r.start && d < r.end);
    };
  }, [blockRanges]);

  const hasWarnOverlap = useMemo(() => {
    if (!range.start || !range.end) return false;
    const start = startOfDay(range.start);
    const end = startOfDay(range.end);
    return warnRanges.some((r) => start < r.end && end > r.start);
  }, [range, warnRanges]);

  const maxGuests = listing?.max_guests ?? MAX_GUESTS;

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(baseSchema),
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
      const fullPhone = toFullPhone(values.phone);
      await createBooking.mutateAsync({
        count,
        name: values.name,
        surname: user?.surname || undefined,
        lastname: user?.patronymic || undefined,
        phone: fullPhone,
        message: values.message || undefined,
        start_date: format(range.start, ISO),
        end_date: format(range.end, ISO),
      });

      if (isGuest) {
        // The request remains hidden as pending_verification until this exact
        // phone number is verified and linked to the newly created account.
        try {
          const res = await requestPhoneCode(fullPhone);
          router.replace({
            pathname: '/code',
            params: {
              phone: fullPhone,
              challengeId: res.challenge_id ?? '',
              deliveryMode: res.delivery_mode ?? 'flash_call',
              codeLength: String(res.code_length ?? 4),
              devCode: res.dev_code ?? '',
              fromBooking: 'true',
            },
          } as any);
        } catch {
          router.replace({ pathname: '/phone', params: { phone: fullPhone, fromBooking: 'true' } } as any);
        }
        return;
      }

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
              <View
                style={{
                  flexDirection: 'row',
                  gap: 12,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: palette.line,
                  backgroundColor: palette.surface,
                  padding: 12,
                }}
              >
                {/* Thumbnail Image */}
                <Image
                  source={{ uri: listing.cover_url }}
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: 10,
                    backgroundColor: palette.surfaceSkeleton,
                  }}
                  contentFit="cover"
                />

                {/* Listing Details */}
                <View style={{ flex: 1, justifyContent: 'space-between' }}>
                  <View style={{ gap: 2 }}>
                    <Text
                      numberOfLines={1}
                      style={{ fontSize: 15, fontWeight: '700', color: palette.ink }}
                    >
                      {(() => {
                        const roomsNum = parseInt(listing.rooms, 10);
                        if (isNaN(roomsNum) || roomsNum <= 0) {
                          return 'Современная студия';
                        }
                        return `Уютная ${roomsNum}-комн. квартира`;
                      })()}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={{ fontSize: 13, color: palette.inkSecondary }}
                    >
                      {listing.city}, {listing.address}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: palette.primary }}>
                    {formatPricePerNight(listing.price)}
                  </Text>
                </View>
              </View>
            ) : null}

            <View style={{ gap: 8 }}>
              <Text style={{ fontSize: 15, fontWeight: '600', color: palette.ink }}>Даты</Text>
              <CalendarRange value={range} onChange={setRange} isDateDisabled={isDateDisabled} />
              <View className="flex-row items-center gap-2 mt-1 px-0.5">
                <View
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 8,
                    backgroundColor: palette.dangerLight,
                    borderWidth: 1,
                    borderColor: '#FAD2D2',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    position: 'relative',
                  }}
                >
                  <View
                    style={{
                      position: 'absolute',
                      width: 18,
                      height: 1.5,
                      backgroundColor: '#C92A2A',
                      transform: [{ rotate: '-45deg' }],
                    }}
                  />
                </View>
                <Text style={{ fontSize: 13, color: palette.inkSecondary }}>
                  Занятые даты
                </Text>
              </View>
              {hasWarnOverlap ? (
                <View
                  style={{
                    flexDirection: 'row',
                    gap: 8,
                    borderRadius: 12,
                    backgroundColor: '#FFF8EC',
                    borderWidth: 1,
                    borderColor: '#FFE0B2',
                    padding: 12,
                    marginTop: 4,
                  }}
                >
                  <Ionicons name="warning-outline" size={18} color="#E65100" style={{ marginTop: 1 }} />
                  <Text style={{ flex: 1, fontSize: 13, color: '#E65100', lineHeight: 18 }}>
                    Выбранные даты пересекаются с другой заявкой на рассмотрении. Решение о подтверждении остаётся за владельцем.
                  </Text>
                </View>
              ) : null}
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
                    disabled={count >= maxGuests}
                    onPress={() => setCount((c) => Math.min(maxGuests, c + 1))}
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
          </ScrollView>

          <View
            style={{
              borderTopWidth: 1,
              borderTopColor: palette.line,
              backgroundColor: palette.surface,
              paddingHorizontal: 16,
              paddingTop: 12,
              paddingBottom: insets.bottom > 0 ? insets.bottom : 12,
            }}
          >
            {nights > 0 && listing ? (
              <View
                style={{
                  marginBottom: 12,
                  padding: 12,
                  borderRadius: 12,
                  backgroundColor: palette.surfaceMuted,
                  borderWidth: 1,
                  borderColor: palette.line,
                  gap: 4,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: palette.ink }}>
                    {range.start && range.end ? (() => {
                      const start = range.start;
                      const end = range.end;
                      if (start.getMonth() === end.getMonth()) {
                        return `${format(start, 'd', { locale: ru })}–${format(end, 'd MMMM', { locale: ru })}`;
                      }
                      return `${format(start, 'd MMMM', { locale: ru })} – ${format(end, 'd MMMM', { locale: ru })}`;
                    })() : ''}
                    {' · '}
                    {formatNights(nights)}
                  </Text>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: palette.ink }}>
                    {formatRub(total)} ₽
                  </Text>
                </View>
                <Text style={{ fontSize: 12, color: palette.inkSecondary }}>
                  {formatRub(listing.price)} ₽ × {formatNights(nights)}
                </Text>
              </View>
            ) : null}
            <Button label="Отправить заявку" loading={createBooking.isPending} onPress={onSubmit} />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
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
  const { palette } = useAppTheme();
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
  const { palette } = useAppTheme();
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
