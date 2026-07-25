import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { ChatMessage } from '@/store/chatStore';
import { useAppTheme } from '@/theme/useAppTheme';
import { useChatColors } from './useChatColors';
import { MessageAttachments } from './MessageAttachments';
import { QuotedMessage } from './QuotedMessage';
import { SwipeToReply } from './SwipeToReply';
import {
	type ChatAttachment,
	isImageAttachment,
	isImageOnlyMessage,
	formatMessageTime,
} from './types';

interface MessageBubbleProps {
	message: ChatMessage;
	/** Сообщение отправлено текущим пользователем. */
	isMine: boolean;
	/**
	 * id последнего сообщения, прочитанного собеседником. Нужен для двойной
	 * галочки: сообщение считается прочитанным, если его id не больше этого.
	 */
	otherLastReadMessageID?: number;
	downloadingAttachmentID: number | null;
	onImagePress: (attachment: ChatAttachment) => void;
	onDocumentPress: (attachment: ChatAttachment) => void;
	/** Имя автора процитированного сообщения, для шапки цитаты. */
	quoteAuthorName: (senderID?: number | null) => string;
	/** Свайп по пузырю — ответить на это сообщение. */
	onReply: (message: ChatMessage) => void;
	/** Переход к оригиналу по тапу на цитату. */
	onQuotePress: (messageID: number) => void;
	/** Долгое нажатие — панель действий с сообщением (этап A5). */
	onLongPress?: (message: ChatMessage) => void;
	/** Подсветка после перехода к оригиналу — короткая вспышка фона. */
	highlighted?: boolean;
}

/**
 * Пузырь пользовательского сообщения: вложения, текст, время и статус доставки.
 *
 * Системные карточки (kind='booking_status') рендерит BookingStatusCard —
 * сюда они не попадают.
 *
 * Сообщение только из картинок показывается без пузыря: фон прозрачный,
 * а время накладывается поверх изображения плашкой, иначе белый текст времени
 * теряется на светлых фото.
 */
export const MessageBubble = React.memo(function MessageBubble({
	message,
	isMine,
	otherLastReadMessageID,
	downloadingAttachmentID,
	onImagePress,
	onDocumentPress,
	quoteAuthorName,
	onReply,
	onQuotePress,
	onLongPress,
	highlighted = false,
}: MessageBubbleProps) {
	const { palette } = useAppTheme();
	const chatColors = useChatColors();

	const isPending = message.pending;
	const isFailed = message.failed;
	const isDeleted = !!message.deleted_at;
	const isEdited = !!message.edited_at;
	// Удалённое сообщение не может быть «только картинками»: вложения снесены.
	const imageOnly = !isDeleted && isImageOnlyMessage(message);
	/**
	 * В сообщении есть изображения — фото или сетка альбома идут в край пузыря,
	 * без внутренних отступов. Подпись под ними получает отступы отдельно, иначе
	 * сетка оказывается в рамке из фона пузыря и выглядит вставленной, а не
	 * частью сообщения.
	 */
	const mediaEdgeToEdge = !isDeleted && !!message.attachments?.some(isImageAttachment);
	const isRead = otherLastReadMessageID != null && message.id <= otherLastReadMessageID;

	const handleReply = React.useCallback(() => onReply(message), [message, onReply]);
	const handleQuotePress = React.useCallback(() => {
		if (message.reply_to_message_id) onQuotePress(message.reply_to_message_id);
	}, [message.reply_to_message_id, onQuotePress]);
	const handleLongPress = React.useCallback(() => {
		onLongPress?.(message);
	}, [message, onLongPress]);

	// Удалённое сообщение — плашка вместо пузыря. Отвечать на него и открывать
	// действия незачем, поэтому ни свайпа, ни долгого нажатия здесь нет.
	if (isDeleted) {
		return (
			<View className={`flex-row my-1.5 px-4 ${isMine ? 'justify-end' : 'justify-start'}`}>
				<View
					style={[
						styles.messageBubble,
						styles.deletedBubble,
						{ borderColor: chatColors.border, backgroundColor: chatColors.panelRaised },
					]}
				>
					<Ionicons name="ban-outline" size={13} color={palette.inkMuted} />
					<Text className="ml-1.5 text-[13px] italic text-ink-muted">Сообщение удалено</Text>
				</View>
			</View>
		);
	}

	const bubble = (
		<View className={`flex-row my-1.5 px-4 ${isMine ? 'justify-end' : 'justify-start'}`}>
			<View
				style={[
					styles.messageBubble,
					{
						backgroundColor: imageOnly
							? 'transparent'
							: isMine
								? palette.primary
								: chatColors.incoming,
						borderColor: imageOnly || isMine ? 'transparent' : chatColors.softBorder,
						paddingHorizontal: mediaEdgeToEdge ? 0 : 15,
						paddingVertical: mediaEdgeToEdge ? 0 : 11,
					},
				]}
			>
				{message.reply_to ? (
					<View style={mediaEdgeToEdge ? styles.mediaInset : undefined}>
						<QuotedMessage
							quote={message.reply_to}
							onDark={isMine && !imageOnly}
							authorName={quoteAuthorName(message.reply_to.sender_id)}
							onPress={handleQuotePress}
						/>
					</View>
				) : null}

				{message.attachments?.length ? (
					<MessageAttachments
						attachments={message.attachments}
						isMine={isMine}
						downloadingAttachmentID={downloadingAttachmentID}
						onImagePress={onImagePress}
						onDocumentPress={onDocumentPress}
					/>
				) : null}

				{message.body ? (
					<Text
						className={`text-[15px] leading-[20px] ${isMine ? 'text-white' : 'text-ink'}`}
						style={mediaEdgeToEdge ? styles.caption : undefined}
					>
						{message.body}
					</Text>
				) : null}

				<View
					className="flex-row justify-end items-center mt-1 self-end"
					style={
						imageOnly
							? styles.imageTimestamp
							: mediaEdgeToEdge
								? styles.captionTimestamp
								: undefined
					}
				>
					{isEdited ? (
						<Text
							className={`text-[10px] ${isMine || imageOnly ? 'text-white/70' : 'text-ink-muted'} mr-1`}
						>
							ред.
						</Text>
					) : null}
					<Text
						className={`text-[10px] ${isMine || imageOnly ? 'text-white/80' : 'text-ink-muted'} mr-1`}
					>
						{formatMessageTime(message.created_at)}
					</Text>
					{isMine ? (
						<>
							{isPending ? (
								<Ionicons name="time-outline" size={11} color="rgba(255,255,255,0.6)" />
							) : null}
							{isFailed ? (
								<Ionicons name="alert-circle-outline" size={11} color="#EF4444" />
							) : null}
							{!isPending && !isFailed ? (
								isRead ? (
									<Ionicons name="checkmark-done" size={12} color="rgba(255,255,255,0.9)" />
								) : (
									<Ionicons name="checkmark" size={12} color="rgba(255,255,255,0.6)" />
								)
							) : null}
						</>
					) : null}
				</View>
			</View>
		</View>
	);

	// Оптимистичное сообщение ещё не имеет серверного id, поэтому отвечать на
	// него нельзя — реплай сослался бы на временный отрицательный id.
	const canInteract = !isPending && !isFailed;

	const interactive = onLongPress ? (
		<Pressable onLongPress={handleLongPress} delayLongPress={280} disabled={!canInteract}>
			{bubble}
		</Pressable>
	) : (
		bubble
	);

	return (
		<View style={highlighted ? [styles.highlight, { backgroundColor: palette.primaryLight }] : undefined}>
			<SwipeToReply onReply={handleReply} disabled={!canInteract}>
				{interactive}
			</SwipeToReply>
		</View>
	);
});

const styles = StyleSheet.create({
	messageBubble: {
		maxWidth: '82%',
		borderRadius: 21,
		borderWidth: StyleSheet.hairlineWidth,
	},
	mediaInset: {
		paddingHorizontal: 6,
		paddingTop: 6,
	},
	caption: {
		paddingHorizontal: 13,
		paddingTop: 7,
	},
	captionTimestamp: {
		paddingHorizontal: 13,
		paddingBottom: 8,
	},
	deletedBubble: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: 13,
		paddingVertical: 9,
	},
	imageTimestamp: {
		position: 'absolute',
		right: 8,
		bottom: 7,
		backgroundColor: 'rgba(0,0,0,0.52)',
		borderRadius: 10,
		paddingHorizontal: 6,
		paddingVertical: 3,
	},
	highlight: {
		borderRadius: 16,
		marginHorizontal: 8,
	},
});
