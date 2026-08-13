import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

import { ComponentMarker } from '@/components/debug/ComponentMarker';
import type { ChatMessage } from '@/store/chatStore';
import { useAppTheme } from '@/theme/useAppTheme';
import { useChatColors } from './useChatColors';
import { IconButton } from '@/components/ui';
import { isImageAttachment } from './types';

interface ReplyPreviewBarProps {
	/** Сообщение, на которое отвечаем. */
	message: ChatMessage;
	/** Имя автора этого сообщения. */
	authorName: string;
	onCancel: () => void;
}

/**
 * Полоса над полем ввода: на что именно сейчас отвечаем.
 *
 * Берёт данные из самого сообщения, а не из гидрированной цитаты: отвечают на
 * сообщение, которое уже есть в ленте, поэтому текст и вложения под рукой и
 * запрос к серверу не нужен. Превью обрезается здесь же — сервер ограничивает
 * только цитаты в ответах, но не оригиналы.
 */
export function ReplyPreviewBar({ message, authorName, onCancel }: ReplyPreviewBarProps) {
	const { palette } = useAppTheme();
	const chatColors = useChatColors();

	const firstImage = message.attachments?.find(isImageAttachment);
	const imageCount = message.attachments?.filter(isImageAttachment).length ?? 0;

	const preview = React.useMemo(() => {
		if (message.body) {
			return message.body.length > 120 ? `${message.body.slice(0, 120)}…` : message.body;
		}
		if (imageCount > 1) return `${imageCount} фото`;
		if (imageCount === 1) return 'Фото';
		if (message.attachments?.length) return message.attachments[0].file_name;
		return 'Сообщение';
	}, [message.attachments, message.body, imageCount]);

	return (
		<View
			style={[styles.container, { borderTopColor: chatColors.softBorder }]}
			accessibilityLabel={`Ответ на сообщение: ${preview}`}
		>
			<ComponentMarker kind="surface" name="ReplyPreviewBar" />
			<View style={[styles.bar, { backgroundColor: palette.primary }]} />

			{firstImage ? (
				<Image source={{ uri: firstImage.url }} style={styles.thumb} contentFit="cover" />
			) : (
				<Ionicons
					name="arrow-undo-outline"
					size={16}
					color={palette.primary}
					style={styles.leadingIcon}
				/>
			)}

			<View style={styles.textWrap}>
				<Text numberOfLines={1} className="text-[12px] font-bold text-primary">
					{authorName}
				</Text>
				<Text numberOfLines={1} className="text-[12px] text-ink-secondary mt-0.5">
					{preview}
				</Text>
			</View>

			<IconButton
				icon="close"
				size={32}
				iconSize={16}
				onPress={onCancel}
				accessibilityLabel="Отменить ответ"
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: 12,
		paddingTop: 8,
		paddingBottom: 2,
		borderTopWidth: StyleSheet.hairlineWidth,
		gap: 2,
	},
	bar: {
		width: 3,
		height: 34,
		borderRadius: 2,
	},
	leadingIcon: {
		marginLeft: 8,
	},
	thumb: {
		width: 34,
		height: 34,
		borderRadius: 7,
		marginLeft: 8,
	},
	textWrap: {
		flex: 1,
		paddingLeft: 8,
		minWidth: 0,
	},
});
