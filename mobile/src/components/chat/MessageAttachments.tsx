import React from 'react';
import { View, Text, TouchableOpacity, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

import { useAppTheme } from '@/theme/useAppTheme';
import { AlbumGrid } from './AlbumGrid';
import { VideoAttachment } from './VideoAttachment';
import {
	type ChatAttachment,
	isImageAttachment,
	isVideoAttachment,
	isPendingAttachment,
	formatFileSize,
} from './types';

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
	const pending = isPendingAttachment(attachment);

	return (
		<TouchableOpacity
			activeOpacity={0.9}
			onPress={() => onPress(attachment)}
			style={styles.imageAttachment}
			accessibilityRole="imagebutton"
			accessibilityLabel={pending ? 'Открыть изображение, оно проверяется' : 'Открыть изображение'}
		>
			<Image
				source={{ uri: attachment.url }}
				style={{ width: SINGLE_IMAGE_WIDTH, height }}
				contentFit="cover"
			/>
			{/* Без этой плашки отправитель не понимает, почему сообщение «не дошло»:
			    получателю оно действительно не доставлено до вердикта. */}
			{pending ? <PendingOverlay /> : null}
		</TouchableOpacity>
	);
}

/**
 * Плашка «Проверяется» поверх вложения на модерации.
 *
 * Встречается только на своих сообщениях: чужие непроверенные вложения сервер не
 * отдаёт вовсе.
 */
export function PendingOverlay() {
	return (
		<View style={styles.pendingOverlay}>
			<ActivityIndicator size="small" color="#fff" />
			<Text style={styles.pendingText}>Проверяется</Text>
		</View>
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
	onVideoPress: (attachment: ChatAttachment) => void;
	/**
	 * Локальные обложки по id вложения. Нужны, пока сервер не сгенерировал свои:
	 * он делает это только после модерации, а показать что-то надо сразу.
	 */
	localThumbnails?: Record<number, string>;
}

/**
 * Вложения сообщения.
 *
 * Изображения и документы разделяются, потому что показываются по-разному:
 * несколько фото складываются в сетку альбома, а документы всегда идут списком
 * (сетка из иконок файлов ничего не даёт, а имена в ней не читаются).
 *
 * Одиночное фото остаётся вне сетки: у него есть реальные пропорции, и
 * панорамный снимок не нужно обрезать в квадрат.
 */
export function MessageAttachments({
	attachments,
	isMine,
	downloadingAttachmentID,
	onImagePress,
	onDocumentPress,
	onVideoPress,
	localThumbnails,
}: MessageAttachmentsProps) {
	const isBusy = downloadingAttachmentID != null;

	// Три группы вместо двух: видео показывается обложкой с Play, и в сетку
	// альбома не идёт — обрезать кадр в квадрат и терять кнопку воспроизведения
	// бессмысленно.
	const { images, videos, documents } = React.useMemo(() => {
		const images: ChatAttachment[] = [];
		const videos: ChatAttachment[] = [];
		const documents: ChatAttachment[] = [];
		for (const att of attachments) {
			if (isImageAttachment(att)) images.push(att);
			else if (isVideoAttachment(att)) videos.push(att);
			else documents.push(att);
		}
		return { images, videos, documents };
	}, [attachments]);

	return (
		<>
			{images.length === 1 ? (
				<ImageAttachment attachment={images[0]} onPress={onImagePress} />
			) : images.length > 1 ? (
				<AlbumGrid images={images} onPress={onImagePress} />
			) : null}

			{videos.map((att) => (
				<VideoAttachment
					key={att.id}
					attachment={att}
					localThumbnailUri={localThumbnails?.[att.id]}
					onPress={onVideoPress}
				/>
			))}

			{documents.map((att) => (
				<DocumentAttachment
					key={att.id}
					attachment={att}
					isMine={isMine}
					isDownloading={downloadingAttachmentID === att.id}
					isBusy={isBusy}
					onPress={onDocumentPress}
				/>
			))}
		</>
	);
}

const styles = StyleSheet.create({
	imageAttachment: {
		marginBottom: 2,
		borderRadius: 18,
		overflow: 'hidden',
	},
	pendingOverlay: {
		position: 'absolute',
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		backgroundColor: 'rgba(0,0,0,0.45)',
		alignItems: 'center',
		justifyContent: 'center',
	},
	pendingText: {
		marginTop: 6,
		color: '#fff',
		fontSize: 11,
		fontWeight: '600',
	},
});
