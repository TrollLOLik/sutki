import { Ionicons } from '@expo/vector-icons';
import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Image } from 'expo-image';
import { ActivityIndicator, Pressable, Text, TouchableOpacity, View } from 'react-native';

import { formatGuests, formatRub } from '@/lib/format';
import { useAppTheme } from '@/theme/useAppTheme';
import type { Booking } from '@/types/booking';

interface IncomingRequestCardProps {
  booking: Booking;
  onPress: () => void;
  onConfirm: () => void;
  onReject: () => void;
  isConfirming?: boolean;
  isRejecting?: boolean;
  disabled?: boolean;
  onChatPress?: () => void;
}

function formatCompactDateRange(start: Date, end: Date | null): string {
  const currentYear = new Date().getFullYear();
  const startYear = start.getFullYear();
  
  if (!end) {
    const showYear = startYear !== currentYear;
    const dateStr = showYear
      ? format(start, 'd MMMM yyyy', { locale: ru })
      : format(start, 'd MMMM', { locale: ru });
    return `с ${dateStr}`;
  }

  const endYear = end.getFullYear();
  const startMonth = start.getMonth();
  const endMonth = end.getMonth();

  const showYear = startYear !== currentYear || endYear !== currentYear;

  if (startMonth === endMonth && startYear === endYear) {
    const dayStart = format(start, 'd');
    const dayEnd = format(end, 'd');
    const month = format(start, 'MMMM', { locale: ru });
    return showYear
      ? `${dayStart} — ${dayEnd} ${month} ${startYear}`
      : `${dayStart} — ${dayEnd} ${month}`;
  } else {
    if (showYear) {
      const startStr = format(start, 'd MMM', { locale: ru }).replace(/\./g, '');
      const endStr = format(end, 'd MMM', { locale: ru }).replace(/\./g, '');
      return `${startStr} — ${endStr} ${endYear}`;
    } else {
      const startStr = format(start, 'd MMMM', { locale: ru });
      const endStr = format(end, 'd MMMM', { locale: ru });
      return `${startStr} — ${endStr}`;
    }
  }
}

export function IncomingRequestCard({
  booking,
  onPress,
  onConfirm,
  onReject,
  isConfirming = false,
  isRejecting = false,
  disabled = false,
  onChatPress,
}: IncomingRequestCardProps) {
  const { palette, isDark } = useAppTheme();
  const start = parseISO(booking.start_date);
  const end = booking.end_date ? parseISO(booking.end_date) : null;
  const nights = end ? differenceInCalendarDays(end, start) : 0;
  
  const totalPrice = nights > 0 && booking.house?.price
    ? booking.house.price * nights
    : null;

  const getFormattedName = () => {
    const name = booking.guest?.name || booking.name || 'Гость';
    const surname = booking.guest?.surname || booking.surname || '';
    if (surname.trim()) {
      return `${name} ${surname.trim().charAt(0)}.`;
    }
    return name;
  };

  const formattedName = getFormattedName();
  const isDeletedUser = formattedName === 'Удаленный пользователь';

  const guestInitial = (booking.guest?.name || booking.name || 'Г').charAt(0).toUpperCase();

  const getAvatarBg = (char: string) => {
    const code = char.charCodeAt(0) % 5;
    const colors = [
      '#FEE2E2', // light red
      '#FEF3C7', // light amber
      '#D1FAE5', // light emerald
      '#DBEAFE', // light blue
      '#F3E8FF', // light purple
    ];
    const textColors = [
      '#EF4444',
      '#F59E0B',
      '#10B981',
      '#3B82F6',
      '#8B5CF6',
    ];
    return { bg: colors[code], text: textColors[code] };
  };

  const avatarStyle = getAvatarBg(guestInitial);

  const formatNightsRu = (count: number) => {
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod10 === 1 && mod100 !== 11) {
      return `${count} ночь`;
    }
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
      return `${count} ночи`;
    }
    return `${count} ночей`;
  };

  const createdAt = format(parseISO(booking.created_at), 'd MMMM, HH:mm', { locale: ru });

  const getStatusTone = (status: string) => {
    switch (status) {
      case 'confirmed':
        return { 
          bg: palette.successLight, 
          text: isDark ? '#A7F3D0' : palette.success 
        };
      case 'cancelled':
        return { 
          bg: palette.dangerLight, 
          text: isDark ? '#FECACA' : palette.danger 
        };
      default:
        return { 
          bg: palette.surfaceMuted, 
          text: isDark ? '#E6E8EA' : palette.inkMuted 
        };
    }
  };

  const getStatusLabel = (status: string, hasRejectionReason: boolean) => {
    if (status === 'confirmed') return 'Принята';
    if (status === 'cancelled') {
      return hasRejectionReason ? 'Отклонена' : 'Отменена';
    }
    return status;
  };

  const statusTone = getStatusTone(booking.status);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="mb-3 rounded-[20px] border border-line bg-surface p-4 active:opacity-95"
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
      }}
    >
      {/* Left Column (Info) */}
      <View style={{ flex: 1, minWidth: 0 }}>
        {/* Guest Header: Avatar + Name + Rating */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {booking.guest?.avatar_url ? (
            <Image
              source={{ uri: booking.guest.avatar_url }}
              style={{ width: 44, height: 44, borderRadius: 22 }}
              contentFit="cover"
            />
          ) : (
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: avatarStyle.bg,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: '700', color: avatarStyle.text }}>
                {guestInitial}
              </Text>
            </View>
          )}

          <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 }}>
              <Text 
                numberOfLines={1} 
                style={{ 
                  fontSize: 15, 
                  fontWeight: isDeletedUser ? '500' : '800', 
                  fontStyle: isDeletedUser ? 'italic' : 'normal',
                  color: isDeletedUser ? palette.inkMuted : palette.ink, 
                  flexShrink: 1 
                }}
              >
                {formattedName}
              </Text>
              
              {/* Rating */}
              {booking.guest?.rating && booking.guest.rating > 0 ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                  <Ionicons name="star" size={13} color="#FFB400" />
                  <Text style={{ fontSize: 13, fontWeight: '700', color: palette.ink }}>
                    {booking.guest.rating.toFixed(1)}
                  </Text>
                </View>
              ) : (
                <Text style={{ fontSize: 12, fontWeight: '600', color: palette.inkMuted, flexShrink: 0 }}>
                  Новый гость
                </Text>
              )}
            </View>
            
            <Text style={{ fontSize: 13, color: palette.inkSecondary }}>
              {formatGuests(booking.count)}
            </Text>
          </View>
        </View>

        {/* Booking Details */}
        <View style={{ gap: 4, marginTop: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="calendar-outline" size={14} color={palette.inkMuted} />
            <Text style={{ fontSize: 13, color: palette.inkSecondary, fontWeight: '500' }}>
              Заезд {formatCompactDateRange(start, end)}
            </Text>
          </View>

          {totalPrice != null ? (
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
              <Text style={{ fontSize: 15, fontWeight: '800', color: palette.ink }}>
                {formatRub(totalPrice)} ₽
              </Text>
              <Text style={{ fontSize: 13, color: palette.inkSecondary }}>
                за {formatNightsRu(nights)}
              </Text>
            </View>
          ) : null}

          <Text style={{ fontSize: 11, color: palette.inkMuted, marginTop: 4 }}>
            Создана {createdAt}
          </Text>
        </View>
      </View>

      {/* Right Column (Buttons Stack) */}
      <View style={{ width: 120, gap: 8 }}>
        {booking.status === 'in_progress' ? (
          <>
            {/* Accept Button */}
            <TouchableOpacity
              onPress={(e) => { e.stopPropagation(); onConfirm(); }}
              disabled={disabled}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{
                height: 36,
                borderWidth: 1.5,
                borderColor: palette.success,
                borderRadius: 18,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {isConfirming ? (
                <ActivityIndicator size="small" color={palette.success} />
              ) : (
                <Text style={{ fontSize: 13, fontWeight: '500', color: palette.success }}>Принять</Text>
              )}
            </TouchableOpacity>

            {/* Reject Button */}
            <TouchableOpacity
              onPress={(e) => { e.stopPropagation(); onReject(); }}
              disabled={disabled}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{
                height: 36,
                borderWidth: 1.5,
                borderColor: palette.danger,
                borderRadius: 18,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {isRejecting ? (
                <ActivityIndicator size="small" color={palette.danger} />
              ) : (
                <Text style={{ fontSize: 13, fontWeight: '500', color: palette.danger }}>Отклонить</Text>
              )}
            </TouchableOpacity>
          </>
        ) : (
          /* Badge for final states */
          <View
            style={{
              height: 36,
              borderRadius: 18,
              backgroundColor: statusTone.bg,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 8,
            }}
          >
            <Text
              numberOfLines={1}
              style={{
                fontSize: 13,
                fontWeight: '500',
                color: statusTone.text,
              }}
            >
              {getStatusLabel(booking.status, !!booking.rejection_reason)}
            </Text>
          </View>
        )}

        <TouchableOpacity
          onPress={(e) => { e.stopPropagation(); onChatPress ? onChatPress() : onPress(); }}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{
            height: 36,
            borderWidth: 1.5,
            borderColor: palette.inkSecondary,
            borderRadius: 18,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          <Ionicons name="chatbubble-outline" size={12} color={palette.inkSecondary} />
          <Text style={{ fontSize: 13, fontWeight: '500', color: palette.inkSecondary }}>Чат</Text>
        </TouchableOpacity>
      </View>
    </Pressable>
  );
}
