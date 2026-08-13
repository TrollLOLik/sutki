import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { ComponentMarker } from '@/components/debug/ComponentMarker';
import { MaterialSurface } from '@/components/ui';
import { useAppTheme } from '@/theme/useAppTheme';
import type { ReviewReply } from '@/types/review';

type ReviewCardHeader =
  | {
      kind: 'author';
      name?: string;
      avatarUrl?: string;
      listingLabel?: string;
    }
  | {
      kind: 'listing';
      title: string;
      subtitle?: string;
      coverUrl?: string;
    };

interface ReviewCardProps {
  body: string;
  createdAt: string;
  header: ReviewCardHeader;
  rating: number;
  ratingMode?: 'stars' | 'score';
  reply?: ReviewReply;
  rejectionReason?: string;
  status?: string;
  children?: ReactNode;
  className?: string;
}

function reviewDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function statusPresentation(status?: string) {
  if (!status || status === 'active') return null;
  if (status === 'rejected') {
    return { icon: 'close-circle-outline' as const, label: 'Отклонён', danger: true };
  }
  if (status === 'moderation_review') {
    return { icon: 'time-outline' as const, label: 'Дополнительная проверка', danger: false };
  }
  return { icon: 'time-outline' as const, label: 'На проверке', danger: false };
}

export function ReviewCard({
  body,
  children,
  className,
  createdAt,
  header,
  rating,
  ratingMode = 'stars',
  rejectionReason,
  reply,
  status,
}: ReviewCardProps) {
  const { palette } = useAppTheme();
  const statusView = statusPresentation(status);

  return (
    <MaterialSurface level="raised" radius={20} className={`gap-3 p-4 ${className ?? ''}`}>
      <ComponentMarker kind="surface" name="ReviewCard" />
      {header.kind === 'listing' ? (
        <View className="flex-row items-center gap-3">
          {header.coverUrl ? (
            <Image
              source={{ uri: header.coverUrl }}
              style={{ width: 68, height: 52, borderRadius: 13 }}
              contentFit="cover"
            />
          ) : (
            <View className="items-center justify-center rounded-xl bg-surface-muted" style={{ width: 68, height: 52 }}>
              <Ionicons name="image-outline" size={20} color={palette.inkMuted} />
            </View>
          )}
          <View className="min-w-0 flex-1 gap-0.5">
            <Text className="text-sm font-bold text-ink" numberOfLines={1}>{header.title}</Text>
            {header.subtitle ? <Text className="text-xs text-ink-secondary" numberOfLines={1}>{header.subtitle}</Text> : null}
          </View>
        </View>
      ) : (
        <View className="flex-row items-center gap-3">
          <View className="h-10 w-10 overflow-hidden rounded-full bg-surface-skeleton">
            {header.avatarUrl ? (
              <Image source={{ uri: header.avatarUrl }} style={{ flex: 1 }} contentFit="cover" />
            ) : (
              <View className="flex-1 items-center justify-center">
                <Text className="text-sm font-bold text-primary">{header.name?.[0]?.toUpperCase() || 'Г'}</Text>
              </View>
            )}
          </View>
          <View className="min-w-0 flex-1 gap-0.5">
            <Text className="text-sm font-bold text-ink" numberOfLines={1}>{header.name || 'Гость'}</Text>
            <Text className="text-xs text-ink-secondary">{reviewDate(createdAt)}</Text>
          </View>
          {header.listingLabel ? (
            <View className="max-w-[42%] rounded-full bg-surface-muted px-2.5 py-1">
              <Text className="text-xs font-medium text-ink-secondary" numberOfLines={1}>{header.listingLabel}</Text>
            </View>
          ) : null}
        </View>
      )}

      <View className="flex-row items-center justify-between gap-3">
        {ratingMode === 'score' ? (
          <View className="flex-row items-center gap-1 rounded-full bg-primary-light px-2.5 py-1.5">
            <Ionicons name="star" size={14} color={palette.star} />
            <Text className="text-sm font-bold text-ink">{rating.toFixed(1).replace('.', ',')}</Text>
          </View>
        ) : (
          <View className="flex-row items-center gap-0.5 rounded-full bg-primary-light px-2.5 py-1.5">
            {Array.from({ length: 5 }).map((_, index) => (
              <Ionicons
                key={index}
                name={index < rating ? 'star' : 'star-outline'}
                size={16}
                color={index < rating ? palette.star : palette.inkMuted}
              />
            ))}
          </View>
        )}
        {header.kind === 'listing' ? <Text className="text-xs text-ink-secondary">{reviewDate(createdAt)}</Text> : null}
      </View>

      {body ? <Text className="text-[15px] font-normal leading-6 text-ink">{body}</Text> : null}

      {reply?.status === 'active' ? (
        <View className="rounded-2xl bg-primary-light p-3.5">
          <View className="flex-row items-center gap-2">
            <Ionicons name="chatbubble-ellipses-outline" size={16} color={palette.primary} />
            <Text className="text-xs font-bold text-primary">Ответ владельца</Text>
          </View>
          <Text className="mt-2 text-sm leading-5 text-ink-secondary">{reply.body}</Text>
        </View>
      ) : null}

      {statusView ? (
        <View
          className="self-start flex-row items-center gap-1.5 rounded-full px-3 py-1.5"
          style={{ backgroundColor: statusView.danger ? palette.dangerLight : palette.primaryLight }}>
          <Ionicons
            name={statusView.icon}
            size={14}
            color={statusView.danger ? palette.danger : palette.primary}
          />
          <Text style={{ color: statusView.danger ? palette.danger : palette.primary }} className="text-xs font-bold">
            {statusView.label}
          </Text>
        </View>
      ) : null}
      {status === 'rejected' && rejectionReason ? (
        <Text className="text-xs leading-4 text-danger">{rejectionReason}</Text>
      ) : null}
      {children}
    </MaterialSurface>
  );
}
