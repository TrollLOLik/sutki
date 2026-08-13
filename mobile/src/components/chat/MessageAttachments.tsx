import React from 'react';
import { View, Text, TouchableOpacity, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

import { ComponentMarker } from '@/components/debug/ComponentMarker';
import { useAppTheme } from '@/theme/useAppTheme';
import { AlbumGrid } from './AlbumGrid';
import { VideoAttachment } from './VideoAttachment';
import {
	type ChatAttachment,
	isImageAttachment,
	isVideoAttachment,
	isPendingAttachment,
	isRejectedAttachment,
	isFailedAttachment,
	formatFileSize,
} from './types';

/** Ширина одиночного изображения в пузыре. */
const SINGLE_IMAGE_WIDTH = 210;
/** Высота, если сервер не прислал размеры и пропорции неизвестны. */
const FALLBACK_IMAGE_HEIGHT = 150;

interface ImageAttachmentProps {
	attachment: ChatAttachment;
	onPress: (attachment: ChatAttachment) => void;
	onRetry: (attachment: ChatAttachment) => void;
	retrying: boolean;
}

/**
 * Одиночное изображение. Высота считается по пропорциям оригинала, если сервер
 * их прислал — часть старых вложений записана без width/height, для них берётся
 * фиксированная высота.
 */
export function ImageAttachment({ attachment, onPress, onRetry, retrying }: ImageAttachmentProps) {
	const height =
		attachment.width && attachment.height
			? (attachment.height / attachment.width) * SINGLE_IMAGE_WIDTH
			: FALLBACK_IMAGE_HEIGHT;
	const pending = isPendingAttachment(attachment);
	const failed = isFailedAttachment(attachment);

	return (
		<TouchableOpacity
			activeOpacity={0.9}
			onPress={() => (failed ? onRetry(attachment) : onPress(attachment))}
			disabled={pending || retrying}
			style={styles.imageAttachment}
			accessibilityRole="imagebutton"
			accessibilityLabel={pending ? 'Открыть изображение, оно проверяется' : 'Открыть изображение'}
		>
			<ComponentMarker kind="media" name="ImageAttachment" />
			<Image
				source={{ uri: attachment.url }}
				style={{ width: SINGLE_IMAGE_WIDTH, height }}
				contentFit="cover"
			/>
			{/* Без этой плашки отправитель не понимает, почему сообщение «не дошло»:
			    получателю оно действительно не доставлено до вердикта. */}
			{pending ? <PendingOverlay /> : null}
			{failed ? (
				<FailedOverlay
					reason={attachment.moderation_reason}
					retrying={retrying}
					onRetry={() => onRetry(attachment)}
				/>
			) : null}
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
			<ComponentMarker kind="state" name="PendingOverlay" />
			<ActivityIndicator size="small" color="#fff" />
			<Text style={styles.pendingText}>Проверяется</Text>
		</View>
	);
}

export function FailedOverlay({
	reason,
	retrying,
	onRetry,
}: {
	reason?: string;
	retrying: boolean;
	onRetry: () => void;
}) {
	return (
		<View style={styles.failedOverlay}>
			<ComponentMarker kind="state" name="FailedOverlay" />
			{retrying ? (
				<ActivityIndicator size="small" color="#FFFFFF" />
			) : (
				<Ionicons name="alert-circle-outline" size={24} color="#FFFFFF" />
			)}
			<Text style={styles.failedTitle}>{retrying ? 'Проверяется' : 'Не удалось проверить'}</Text>
			{!retrying ? (
				<>
					<Text numberOfLines={2} style={styles.failedReason}>
						{reason || 'Сервис проверки временно недоступен.'}
					</Text>
					<Pressable
						onPress={onRetry}
						style={styles.retryButton}
						accessibilityRole="button"
						accessibilityLabel="Повторить проверку вложения"
					>
						<Ionicons name="refresh" size={15} color="#FFFFFF" />
						<Text style={styles.retryText}>Повторить</Text>
					</Pressable>
				</>
			) : null}
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
			<ComponentMarker kind="media" name="DocumentAttachment" />
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
	onRetry: (attachment: ChatAttachment) => void;
	retryingAttachmentID: number | null;
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
	onRetry,
	retryingAttachmentID,
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
			if (isRejectedAttachment(att)) continue;
			else if (isImageAttachment(att)) images.push(att);
			else if (isVideoAttachment(att)) videos.push(att);
			else documents.push(att);
		}
		return { images, videos, documents };
	}, [attachments]);

	return (
		<>
			<ComponentMarker kind="media" name="MessageAttachments" />
			{images.length === 1 ? (
				<ImageAttachment
					attachment={images[0]}
					onPress={onImagePress}
					onRetry={onRetry}
					retrying={retryingAttachmentID === images[0].id}
				/>
			) : images.length > 1 ? (
				<AlbumGrid
					images={images}
					onPress={onImagePress}
					onRetry={onRetry}
					retryingAttachmentID={retryingAttachmentID}
				/>
			) : null}

			{videos.map((att) => (
				<VideoAttachment
					key={att.id}
					attachment={att}
					localThumbnailUri={localThumbnails?.[att.id]}
					onPress={onVideoPress}
					onRetry={onRetry}
					retrying={retryingAttachmentID === att.id}
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
	failedOverlay: {
		position: 'absolute',
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		backgroundColor: 'rgba(44, 8, 10, 0.82)',
		alignItems: 'center',
		justifyContent: 'center',
		paddingHorizontal: 14,
	},
	failedTitle: {
		marginTop: 5,
		color: '#FFFFFF',
		fontSize: 12,
		fontWeight: '800',
	},
	failedReason: {
		marginTop: 3,
		color: 'rgba(255,255,255,0.78)',
		fontSize: 10,
		lineHeight: 13,
		textAlign: 'center',
	},
	retryButton: {
		marginTop: 8,
		minHeight: 30,
		paddingHorizontal: 12,
		borderRadius: 15,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: 'rgba(255,255,255,0.16)',
	},
	retryText: {
		marginLeft: 5,
		color: '#FFFFFF',
		fontSize: 11,
		fontWeight: '800',
	},
});
