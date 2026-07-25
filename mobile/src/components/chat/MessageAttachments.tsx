import React from 'react';
import { View, Text, TouchableOpacity, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

import { useAppTheme } from '@/theme/useAppTheme';
import { type ChatAttachment, isImageAttachment, formatFileSize } from './types';

/** Ширина одиночного изображения в пузыре. */
const SINGLE_IMAGE_WIDTH = 210;
/** Высота, если сервер не прислал размеры и пропорции неизвестны. */
const FALLBACK_IMAGE_HEIGHT = 150;

interface ImageAttachmentProps {
	attachment: ChatAttachment;
	onPress: (attachment: ChatAttachment) => void;
}

/**
 * Одиночное изображение. Высота считается по пропорциям оригинала, если сервер
 * их прислал — часть старых вложений записана без width/height, для них берётся
 * фиксированная высота.
 */
export function ImageAttachment({ attachment, onPress }: ImageAttachmentProps) {
	const height =
		attachment.width && attachment.height
			? (attachment.height / attachment.width) * SINGLE_IMAGE_WIDTH
			: FALLBACK_IMAGE_HEIGHT;

	return (
		<TouchableOpacity
			activeOpacity={0.9}
			onPress={() => onPress(attachment)}
			style={styles.imageAttachment}
			accessibilityRole="imagebutton"
			accessibilityLabel="Открыть изображение"
		>
			<Image
				source={{ uri: attachment.url }}
				style={{ width: SINGLE_IMAGE_WIDTH, height }}
				contentFit="cover"
			/>
		</TouchableOpacity>
	);
}

interface DocumentAttachmentProps {
	attachment: ChatAttachment;
	/** Своё сообщение — меняет контрастность на фоне primary-пузыря. */
	isMine: boolean;
	/** Идёт скачивание именно этого вложения. */
	isDownloading: boolean;
	/** Идёт скачивание любого вложения — блокирует повторные тапы. */
	isBusy: boolean;
	onPress: (attachment: ChatAttachment) => void;
}

/** Документ: иконка, имя файла, размер и кнопка скачивания. */
export function DocumentAttachment({
	attachment,
	isMine,
	isDownloading,
	isBusy,
	onPress,
}: DocumentAttachmentProps) {
	const { palette } = useAppTheme();

	return (
		<Pressable
			disabled={isBusy}
			onPress={() => onPress(attachment)}
			accessibilityRole="button"
			accessibilityLabel={`Скачать документ ${attachment.file_name}`}
			className={`flex-row items-center p-2.5 rounded-xl mb-1.5 w-[238px] ${isMine ? 'bg-white/10' : 'bg-background/40'} active:opacity-75`}
		>
			<View
				className={`h-9 w-9 rounded-full items-center justify-center ${isMine ? 'bg-white/10' : 'bg-primary/10'}`}
			>
				<Ionicons name="document-text" size={20} color={isMine ? '#fff' : palette.primary} />
			</View>
			<View className="ml-2.5 flex-1">
				<Text
					numberOfLines={1}
					className={`text-xs ${isMine ? 'text-white' : 'text-ink'} font-semibold`}
				>
					{attachment.file_name}
				</Text>
				<Text className={`text-[10px] ${isMine ? 'text-white/70' : 'text-ink-muted'} mt-0.5`}>
					{formatFileSize(attachment.size_bytes)}
				</Text>
			</View>
			{isDownloading ? (
				<ActivityIndicator size="small" color={isMine ? '#fff' : palette.primary} />
			) : (
				<Ionicons name="download-outline" size={20} color={isMine ? '#fff' : palette.primary} />
			)}
		</Pressable>
	);
}

interface MessageAttachmentsProps {
	attachments: ChatAttachment[];
	isMine: boolean;
	/** id вложения, которое сейчас скачивается, либо null. */
	downloadingAttachmentID: number | null;
	onImagePress: (attachment: ChatAttachment) => void;
	onDocumentPress: (attachment: ChatAttachment) => void;
}

/**
 * Вложения сообщения.
 *
 * Здесь сознательно нет логики сетки альбома: несколько изображений пока
 * рендерятся столбиком, как и до вынесения компонента. Сетку добавляет
 * отдельный этап плана (A4) — этот шаг только переносит существующее
 * поведение без изменений.
 */
export function MessageAttachments({
	attachments,
	isMine,
	downloadingAttachmentID,
	onImagePress,
	onDocumentPress,
}: MessageAttachmentsProps) {
	const isBusy = downloadingAttachmentID != null;

	return (
		<>
			{attachments.map((att) =>
				isImageAttachment(att) ? (
					<ImageAttachment key={att.id} attachment={att} onPress={onImagePress} />
				) : (
					<DocumentAttachment
						key={att.id}
						attachment={att}
						isMine={isMine}
						isDownloading={downloadingAttachmentID === att.id}
						isBusy={isBusy}
						onPress={onDocumentPress}
					/>
				),
			)}
		</>
	);
}

const styles = StyleSheet.create({
	imageAttachment: {
		marginBottom: 2,
		borderRadius: 18,
		overflow: 'hidden',
	},
});
