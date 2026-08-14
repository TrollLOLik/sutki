import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

import { PressableScale } from '@/components/ui';
import { useAppTheme } from '@/theme/useAppTheme';
import { formatDuration } from '@/lib/video';
import type { ChatAttachment } from './types';

/** Ширина видео в пузыре — как у одиночного фото. */
const VIDEO_WIDTH = 210;
/** 16:9 — большинство записей с телефона в горизонтальной ориентации. */
const VIDEO_HEIGHT = Math.round((VIDEO_WIDTH * 9) / 16);

interface VideoAttachmentProps {
	attachment: ChatAttachment;
	/** Локальная обложка: показывается, пока сервер не сгенерировал свою. */
	localThumbnailUri?: string;
	onPress: (attachment: ChatAttachment) => void;
	onRetry: (attachment: ChatAttachment) => void;
	retrying: boolean;
}

/**
 * Видео в ленте сообщений.
 *
 * Рендерится статичная обложка с кнопкой Play, а не плеер: несколько
 * видео-декодеров одновременно на экране убивают плавность скролла, а автозапуск
 * в переписке не нужен никому. Плеер открывается только по явному тапу.
 *
 * Пока вложение на модерации, обложки с сервера ещё нет (её генерирует тот же
 * воркер после вердикта) — показываем локальную, снятую на устройстве, и плашку
 * «Проверяется». Тап в этом состоянии заблокирован: файла ещё как бы нет.
 */
export const VideoAttachment = React.memo(function VideoAttachment({
	attachment,
	localThumbnailUri,
	onPress,
	onRetry,
	retrying,
}: VideoAttachmentProps) {
	const { palette } = useAppTheme();

	const isPending = attachment.moderation_status === 'pending';
	const isFailed = attachment.moderation_status === 'failed';
	// Серверная обложка появляется только после проверки, поэтому до неё
	// опираемся на локальную.
	const thumbnail = attachment.thumbnail_url || localThumbnailUri;

	return (
		<PressableScale
			pressedScale={0.99}
			disabledOpacity={1}
			onPress={() => (isFailed ? onRetry(attachment) : onPress(attachment))}
			disabled={isPending || retrying}
			style={styles.container}
			accessibilityRole="button"
			accessibilityLabel={
				isPending ? 'Видео проверяется' : 'Воспроизвести видео'
			}
		>
			{thumbnail ? (
				<Image source={{ uri: thumbnail }} style={StyleSheet.absoluteFill} contentFit="cover" />
			) : (
				// Ни серверной, ни локальной обложки: нейтральный фон вместо пустоты.
				<View style={[StyleSheet.absoluteFill, styles.placeholder]}>
					<Ionicons name="videocam-outline" size={28} color="rgba(255,255,255,0.65)" />
				</View>
			)}

			{/* Затемнение: белые элементы поверх кадра иначе теряются на светлом видео. */}
			<View style={styles.scrim} />

			{isPending || retrying ? (
				<View style={styles.center}>
					<ActivityIndicator size="small" color="#fff" />
					<Text style={styles.pendingLabel}>Проверяется</Text>
				</View>
			) : isFailed ? (
				<View style={styles.center}>
					<Ionicons name="alert-circle-outline" size={25} color="#FFFFFF" />
					<Text style={styles.failedLabel}>Не удалось проверить</Text>
					<View style={styles.retryButton}>
						<Ionicons name="refresh" size={15} color="#FFFFFF" />
						<Text style={styles.retryText}>Повторить</Text>
					</View>
				</View>
			) : (
				<View style={styles.playButton}>
					<Ionicons name="play" size={26} color={palette.ink} />
				</View>
			)}

			{attachment.duration_seconds ? (
				<View style={styles.durationBadge}>
					<Text style={styles.durationText}>{formatDuration(attachment.duration_seconds)}</Text>
				</View>
			) : null}
		</PressableScale>
	);
});

const styles = StyleSheet.create({
	container: {
		width: VIDEO_WIDTH,
		height: VIDEO_HEIGHT,
		borderRadius: 18,
		overflow: 'hidden',
		marginBottom: 2,
		backgroundColor: '#1B1E23',
		alignItems: 'center',
		justifyContent: 'center',
	},
	placeholder: {
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: '#2A2E35',
	},
	scrim: {
		position: 'absolute',
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		backgroundColor: 'rgba(0,0,0,0.18)',
	},
	center: {
		alignItems: 'center',
	},
	pendingLabel: {
		marginTop: 6,
		color: '#fff',
		fontSize: 11,
		fontWeight: '600',
	},
	failedLabel: {
		marginTop: 5,
		color: '#FFFFFF',
		fontSize: 11,
		fontWeight: '800',
	},
	retryButton: {
		marginTop: 7,
		minHeight: 29,
		paddingHorizontal: 11,
		borderRadius: 15,
		flexDirection: 'row',
		alignItems: 'center',
		backgroundColor: 'rgba(255,255,255,0.16)',
	},
	retryText: {
		marginLeft: 5,
		color: '#FFFFFF',
		fontSize: 10,
		fontWeight: '800',
	},
	playButton: {
		width: 46,
		height: 46,
		borderRadius: 23,
		backgroundColor: 'rgba(255,255,255,0.92)',
		alignItems: 'center',
		justifyContent: 'center',
		// Слегка сдвигаем иконку: у треугольника Play визуальный центр правее
		// геометрического.
		paddingLeft: 3,
	},
	durationBadge: {
		position: 'absolute',
		right: 8,
		bottom: 8,
		backgroundColor: 'rgba(0,0,0,0.6)',
		borderRadius: 8,
		paddingHorizontal: 6,
		paddingVertical: 2,
	},
	durationText: {
		color: '#fff',
		fontSize: 11,
		fontWeight: '600',
	},
});
