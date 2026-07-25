import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { ChatMessage } from '@/store/chatStore';
import { useAppTheme } from '@/theme/useAppTheme';
import { useChatColors } from './useChatColors';
import { MessageAttachments } from './MessageAttachments';
import { type ChatAttachment, isImageOnlyMessage, formatMessageTime } from './types';

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
}: MessageBubbleProps) {
	const { palette } = useAppTheme();
	const chatColors = useChatColors();

	const isPending = message.pending;
	const isFailed = message.failed;
	const imageOnly = isImageOnlyMessage(message);
	const isRead = otherLastReadMessageID != null && message.id <= otherLastReadMessageID;

	return (
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
						paddingHorizontal: imageOnly ? 0 : 15,
						paddingVertical: imageOnly ? 0 : 11,
					},
				]}
			>
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
					<Text className={`text-[15px] leading-[20px] ${isMine ? 'text-white' : 'text-ink'}`}>
						{message.body}
					</Text>
				) : null}

				<View
					className="flex-row justify-end items-center mt-1 self-end"
					style={imageOnly ? styles.imageTimestamp : undefined}
				>
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
});

const styles = StyleSheet.create({
	messageBubble: {
		maxWidth: '82%',
		borderRadius: 21,
		borderWidth: StyleSheet.hairlineWidth,
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
});
