import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';

import { DomainCard } from '@/components/domain/DomainCard';
import { AppIcon, AppText, Button, InlineAlert } from '@/components/ui';
import type { BookingStatusPayload } from '@/store/chatStore';
import { useAppTheme } from '@/theme/useAppTheme';

interface Props {
	payload: BookingStatusPayload;
	createdAt: string;
	/** Whether the current viewer owns the listing (sees action buttons). */
	isOwner: boolean;
	/** True while the newest card for this request is still `new` — controls button visibility. */
	isActionable: boolean;
	confirming?: boolean;
	rejecting?: boolean;
	onConfirm?: (requestID: number) => void;
	onReject?: (requestID: number) => void;
	reviewAvailable?: boolean;
	reviewLabel?: string;
	reviewStatus?: string;
	onReview?: (requestID: number) => void;
}

const EVENT_META: Record<
	BookingStatusPayload['event'],
	{ icon: keyof typeof Ionicons.glyphMap; title: string }
> = {
	new: { icon: 'calendar-outline', title: 'Новая заявка на бронирование' },
	confirmed: { icon: 'checkmark-circle', title: 'Бронирование подтверждено' },
	rejected: { icon: 'close-circle', title: 'Заявка отклонена' },
	cancelled: { icon: 'arrow-undo-circle-outline', title: 'Заявка отменена гостем' },
};

function formatDate(iso?: string): string {
	if (!iso) return '';
	try {
		return format(parseISO(iso), 'd MMM yyyy', { locale: ru });
	} catch {
		return iso;
	}
}

function guestsLabel(n: number): string {
	const mod10 = n % 10;
	const mod100 = n % 100;
	if (mod10 === 1 && mod100 !== 11) return `${n} гость`;
	if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} гостя`;
	return `${n} гостей`;
}

/**
 * Centered system card describing a booking status change. Rendered instead
 * of a chat bubble for messages with kind='booking_status'. Owner sees
 * confirm/reject shortcuts on the `new` card while the request is pending;
 * both actions hit the same endpoints as the requests screen.
 */
export const BookingStatusCard = React.memo(function BookingStatusCard({
	payload,
	createdAt,
	isOwner,
	isActionable,
	confirming,
	rejecting,
	onConfirm,
	onReject,
	reviewAvailable,
	reviewLabel,
	reviewStatus,
	onReview,
}: Props) {
	const { palette } = useAppTheme();
	const meta = EVENT_META[payload.event] ?? EVENT_META.new;

	const iconColor =
		payload.event === 'confirmed'
			? palette.primary
			: payload.event === 'rejected'
				? palette.danger
				: payload.event === 'cancelled'
					? palette.inkMuted
					: palette.primary;

	const dates =
		payload.start_date && payload.end_date && payload.start_date !== payload.end_date
			? `${formatDate(payload.start_date)} — ${formatDate(payload.end_date)}`
			: formatDate(payload.start_date);

	const showActions = isOwner && isActionable && payload.event === 'new';
	const busy = !!confirming || !!rejecting;

	let time = '';
	try {
		time = format(new Date(createdAt), 'HH:mm');
	} catch {
		/* noop */
	}

	return (
		<View className="items-center my-2.5 px-5">
			<DomainCard radius={20} style={styles.card}>
				<View className="flex-row items-start">
					<View
						style={[
							styles.iconRing,
							{
								borderColor: iconColor,
								backgroundColor: palette.surfaceMuted,
							},
						]}
					>
						<AppIcon name={meta.icon} size={23} color={iconColor} />
					</View>
					<View className="flex-1">
						<AppText className="text-[15px] leading-5 font-extrabold text-ink">{meta.title}</AppText>
						{dates ? (
							<AppText className="text-[12px] leading-5 text-ink-secondary mt-1">
								{dates}
								{payload.guests ? ` · ${guestsLabel(payload.guests)}` : ''}
							</AppText>
						) : null}
					</View>
				</View>

				{payload.event === 'rejected' && payload.reason ? (
					<AppText className="text-[13px] text-ink-secondary mt-2 leading-5">
						Причина: {payload.reason}
					</AppText>
				) : null}

				{payload.event === 'confirmed' && payload.address ? (
					<View className="flex-row items-start mt-2">
						<AppIcon name="location-outline" size={15} color={palette.inkSecondary} style={{ marginTop: 2 }} />
						<AppText className="text-[13px] text-ink-secondary ml-1.5 flex-1 leading-5">
							{payload.address}
						</AppText>
					</View>
				) : null}

				{!isOwner && payload.event === 'confirmed' && (reviewStatus === 'rejected' || reviewStatus === 'moderation_review') ? (
					<InlineAlert compact tone="danger" title="Отзыв отклонён модерацией" style={styles.reviewAlert}>
						Пожалуйста, измените текст отзыва, чтобы он соответствовал правилам.
					</InlineAlert>
				) : null}

				{showActions ? (
					<View className="flex-row gap-2 mt-4">
						<View className="flex-1">
							<Button label="Подтвердить" icon="checkmark-outline" size="md" loading={confirming} disabled={busy} onPress={() => onConfirm?.(payload.request_id)} />
						</View>
						<View className="flex-1">
							<Button label="Отклонить" icon="close-outline" variant="danger" size="md" loading={rejecting} disabled={busy} onPress={() => onReject?.(payload.request_id)} />
						</View>
					</View>
				) : null}

				{!isOwner && payload.event === 'confirmed' && reviewAvailable ? (
					<View className="mt-3 w-full">
						<Button label={reviewLabel || 'Оставить отзыв'} icon="star-outline" size="md" onPress={() => onReview?.(payload.request_id)} />
					</View>
				) : null}

				{time ? (
					<AppText className="text-[10px] text-ink-muted mt-2 self-end">{time}</AppText>
				) : null}
			</DomainCard>
		</View>
	);
});

const styles = StyleSheet.create({
	card: {
		width: '100%',
		maxWidth: 360,
		paddingHorizontal: 16,
		paddingVertical: 15,
		shadowColor: '#000',
		shadowOpacity: 0.08,
		shadowRadius: 16,
		shadowOffset: { width: 0, height: 8 },
		elevation: 2,
	},
	reviewAlert: {
		marginTop: 12,
	},
	iconRing: {
		width: 44,
		height: 44,
		borderRadius: 22,
		borderWidth: 1.5,
		alignItems: 'center',
		justifyContent: 'center',
		marginRight: 13,
	},
});
