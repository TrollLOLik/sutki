import React from 'react';
import { View, StyleSheet } from 'react-native';

import { DomainCard } from '@/components/domain/DomainCard';
import type { ChatMessage } from '@/store/chatStore';
import { useAppTheme } from '@/theme/useAppTheme';
import { AppIcon, AppText, BottomSheet, ListCell, type AppIconName } from '@/components/ui';

/**
 * Окна правки и удаления. Обязаны совпадать с MessageEditWindow и
 * MessageDeleteWindow в backend/internal/domain/chat.go — клиент прячет кнопку
 * заранее, чтобы не показывать действие, которое сервер всё равно отклонит.
 * Сервер остаётся источником истины: он проверяет окно ещё раз в SQL.
 */
const EDIT_WINDOW_MS = 15 * 60 * 1000;
const DELETE_WINDOW_MS = 60 * 60 * 1000;

export interface MessageActionsAvailability {
	canReply: boolean;
	canCopy: boolean;
	canEdit: boolean;
	canDelete: boolean;
}

/**
 * Какие действия доступны для сообщения.
 *
 * Правила повторяют серверные (chat.Service.EditMessage / DeleteMessage):
 * - правка только своего текстового сообщения, в течение 15 минут и пока
 *   собеседник его не прочитал;
 * - удаление своего сообщения в течение часа, прочтение не мешает;
 * - карточки брони не правятся и не удаляются — это след сделки.
 */
export function getMessageActions(
	message: ChatMessage,
	currentUserID: number | undefined,
	otherLastReadMessageID: number | undefined,
): MessageActionsAvailability {
	const isMine = message.sender_id != null && message.sender_id === currentUserID;
	const isUserKind = !message.kind || message.kind === 'user';
	const isDeleted = !!message.deleted_at;
	const isSettled = !message.pending && !message.failed;
	const hasText = !!message.body?.trim();
	const ageMs = Date.now() - new Date(message.created_at).getTime();
	const isReadByOther =
		otherLastReadMessageID != null && message.id <= otherLastReadMessageID;

	return {
		canReply: isUserKind && !isDeleted && isSettled,
		canCopy: hasText && !isDeleted,
		// Вложения править нельзя: подменить фото после отправки — изменить смысл
		// сообщения так, что получатель этого не заметит.
		canEdit:
			isMine && isUserKind && !isDeleted && isSettled && hasText && !isReadByOther && ageMs < EDIT_WINDOW_MS,
		canDelete: isMine && isUserKind && !isDeleted && isSettled && ageMs < DELETE_WINDOW_MS,
	};
}

interface MessageActionsSheetProps {
	/** null — панель закрыта. */
	message: ChatMessage | null;
	actions: MessageActionsAvailability;
	onClose: () => void;
	onReply: (message: ChatMessage) => void;
	onCopy: (message: ChatMessage) => void;
	onEdit: (message: ChatMessage) => void;
	onDelete: (message: ChatMessage) => void;
}

interface ActionRow {
	key: string;
	icon: AppIconName;
	title: string;
	subtitle?: string;
	destructive?: boolean;
	onPress: () => void;
}

/**
 * Панель действий с сообщением по долгому нажатию.
 *
 * Недоступные действия не показываются вовсе, а не блокируются: серые кнопки
 * «изменить» и «удалить» на чужом сообщении только заставляют угадывать, почему
 * они не работают. Если правка уже недоступна из-за прочтения или истёкшего
 * окна, вместо кнопки выводится причина.
 */
export function MessageActionsSheet({
	message,
	actions,
	onClose,
	onReply,
	onCopy,
	onEdit,
	onDelete,
}: MessageActionsSheetProps) {
	const { palette } = useAppTheme();

	const rows = React.useMemo<ActionRow[]>(() => {
		if (!message) return [];
		const list: ActionRow[] = [];

		if (actions.canReply) {
			list.push({
				key: 'reply',
				icon: 'arrow-undo-outline',
				title: 'Ответить',
				onPress: () => onReply(message),
			});
		}
		if (actions.canCopy) {
			list.push({
				key: 'copy',
				icon: 'copy-outline',
				title: 'Копировать текст',
				onPress: () => onCopy(message),
			});
		}
		if (actions.canEdit) {
			list.push({
				key: 'edit',
				icon: 'create-outline',
				title: 'Изменить',
				subtitle: 'Пока собеседник не прочитал, 15 минут',
				onPress: () => onEdit(message),
			});
		}
		if (actions.canDelete) {
			list.push({
				key: 'delete',
				icon: 'trash-outline',
				title: 'Удалить',
				subtitle: 'У себя и у собеседника',
				destructive: true,
				onPress: () => onDelete(message),
			});
		}

		return list;
	}, [actions, message, onCopy, onDelete, onEdit, onReply]);

	return (
		<BottomSheet
			visible={!!message}
			onClose={onClose}
			title="Действия с сообщением"
			subtitle={message?.body || 'Вложение'}
			icon="ellipsis-horizontal-outline">
			<View className="pt-1 pb-2">
				<DomainCard radius={22} style={styles.actionsCard}>
					{rows.map((row, index) => (
						<ListCell
							key={row.key}
							title={row.title}
							subtitle={row.subtitle}
							chevron={false}
							multiline={Boolean(row.subtitle)}
							onPress={row.onPress}
							style={index > 0 ? styles.dividedAction : undefined}
							before={
								<View style={[styles.actionIcon, { backgroundColor: row.destructive ? palette.dangerLight : palette.primaryLight }]}>
									<AppIcon
									name={row.icon}
									size={21}
									color={row.destructive ? palette.danger : palette.primary}
								/>
								</View>
							}
						/>
					))}
				</DomainCard>

				{/* Объясняем, почему правки нет: «просто не показали кнопку» читается
				    как баг, особенно сразу после отправки сообщения. */}
				{message && !actions.canEdit && !actions.canDelete ? (
					<AppText variant="caption" tone="muted" style={styles.hint}>
						{editHint(message)}
					</AppText>
				) : null}
			</View>
		</BottomSheet>
	);
}

/** Причина, по которой сообщение уже нельзя изменить или удалить. */
function editHint(message: ChatMessage): string {
	const ageMs = Date.now() - new Date(message.created_at).getTime();
	if (ageMs >= DELETE_WINDOW_MS) {
		return 'Изменить или удалить сообщение можно только в первый час после отправки.';
	}
	if (!message.body?.trim()) {
		return 'Вложения нельзя изменить — можно только удалить сообщение целиком.';
	}
	return 'Это сообщение нельзя изменить.';
}

const styles = StyleSheet.create({
	actionsCard: {
		overflow: 'hidden',
	},
	actionIcon: {
		width: 44,
		height: 44,
		alignItems: 'center',
		justifyContent: 'center',
		borderRadius: 16,
	},
	dividedAction: {
		borderTopWidth: StyleSheet.hairlineWidth,
		borderTopColor: 'rgba(128, 128, 128, 0.2)',
	},
	hint: {
		marginTop: 12,
		paddingHorizontal: 4,
		lineHeight: 17,
	},
});
