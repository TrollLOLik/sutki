import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

import { useAppTheme } from '@/theme/useAppTheme';
import { useChatColors } from './useChatColors';
import type { StagedFile } from '@/hooks/useChatUploads';
import { formatFileSize } from './types';

const TILE_SIZE = 68;

interface StagedAttachmentsBarProps {
	files: StagedFile[];
	/** Идёт отправка: удалять файлы и добавлять новые уже нельзя. */
	uploading: boolean;
	onRemove: (localId: string) => void;
	onAddMore: () => void;
	/** Достигнут лимит вложений — кнопка «добавить» скрывается. */
	canAddMore: boolean;
}

interface TileProps {
	file: StagedFile;
	uploading: boolean;
	onRemove: (localId: string) => void;
}

function StagedTile({ file, uploading, onRemove }: TileProps) {
	const { palette } = useAppTheme();
	const chatColors = useChatColors();
	const isImage = file.mimeType.startsWith('image/');

	return (
		<View style={styles.tileWrap}>
			<View style={[styles.tile, { backgroundColor: chatColors.panelRaised }]}>
				{isImage ? (
					<Image source={{ uri: file.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
				) : (
					<View style={styles.docTile}>
						<Ionicons name="document-text" size={22} color={palette.primary} />
						<Text numberOfLines={1} className="mt-1 text-[9px] text-ink-secondary px-1">
							{file.fileName}
						</Text>
					</View>
				)}

				{/* Прогресс: затемнение убывает по мере загрузки, поэтому видно,
				    какие файлы уже ушли, а какие ещё в очереди. */}
				{file.progress != null && file.progress < 1 ? (
					<View style={[styles.progressVeil, { opacity: 0.55 * (1 - file.progress) + 0.25 }]}>
						<Text style={styles.progressText}>{Math.round(file.progress * 100)}%</Text>
					</View>
				) : null}

				{file.failed ? (
					<View style={[styles.progressVeil, styles.failedVeil]}>
						<Ionicons name="alert-circle" size={20} color="#fff" />
					</View>
				) : null}
			</View>

			{!uploading ? (
				<Pressable
					onPress={() => onRemove(file.localId)}
					hitSlop={8}
					style={[styles.removeButton, { backgroundColor: chatColors.chrome }]}
					accessibilityRole="button"
					accessibilityLabel={`Убрать ${file.fileName}`}
				>
					<Ionicons name="close" size={13} color={palette.ink} />
				</Pressable>
			) : null}

			{!isImage ? (
				<Text className="mt-1 text-[9px] text-ink-muted text-center">
					{formatFileSize(file.size)}
				</Text>
			) : null}
		</View>
	);
}

/**
 * Полоса выбранных, но ещё не отправленных вложений.
 *
 * Появляется между выбором файлов и отправкой — той стадии, которой раньше не
 * было вовсе: тап по фото в галерее сразу улетал сообщением. Здесь пачку можно
 * дособрать, что-то убрать и добавить подпись.
 */
export function StagedAttachmentsBar({
	files,
	uploading,
	onRemove,
	onAddMore,
	canAddMore,
}: StagedAttachmentsBarProps) {
	const { palette } = useAppTheme();
	const chatColors = useChatColors();

	if (!files.length) return null;

	return (
		<View style={[styles.container, { borderTopColor: chatColors.softBorder }]}>
			<ScrollView
				horizontal
				showsHorizontalScrollIndicator={false}
				contentContainerStyle={styles.scrollContent}
				keyboardShouldPersistTaps="handled"
			>
				{files.map((file) => (
					<StagedTile key={file.localId} file={file} uploading={uploading} onRemove={onRemove} />
				))}

				{canAddMore && !uploading ? (
					<Pressable
						onPress={onAddMore}
						style={[styles.addTile, { borderColor: chatColors.border }]}
						accessibilityRole="button"
						accessibilityLabel="Добавить ещё файлы"
					>
						<Ionicons name="add" size={24} color={palette.primary} />
					</Pressable>
				) : null}
			</ScrollView>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		borderTopWidth: StyleSheet.hairlineWidth,
		paddingTop: 10,
	},
	scrollContent: {
		paddingHorizontal: 14,
		gap: 8,
		alignItems: 'flex-start',
	},
	tileWrap: {
		width: TILE_SIZE,
	},
	tile: {
		width: TILE_SIZE,
		height: TILE_SIZE,
		borderRadius: 12,
		overflow: 'hidden',
	},
	docTile: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
	},
	progressVeil: {
		position: 'absolute',
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		backgroundColor: '#000',
		alignItems: 'center',
		justifyContent: 'center',
	},
	failedVeil: {
		backgroundColor: 'rgba(239,68,68,0.75)',
		opacity: 1,
	},
	progressText: {
		color: '#fff',
		fontSize: 11,
		fontWeight: '700',
	},
	removeButton: {
		position: 'absolute',
		top: -5,
		right: -5,
		width: 21,
		height: 21,
		borderRadius: 11,
		alignItems: 'center',
		justifyContent: 'center',
		shadowOpacity: 0.18,
		shadowRadius: 4,
		shadowOffset: { width: 0, height: 2 },
		elevation: 3,
	},
	addTile: {
		width: TILE_SIZE,
		height: TILE_SIZE,
		borderRadius: 12,
		borderWidth: 1,
		borderStyle: 'dashed',
		alignItems: 'center',
		justifyContent: 'center',
	},
});
