import React from 'react';
import { View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';

import type { ChatAttachment } from './types';

/**
 * Предпочтительная ширина сетки. На планшете дальше не растём: сетка во всю
 * ширину экрана превращает переписку в фотогалерею.
 */
const PREFERRED_WIDTH = 244;
/**
 * Запас на паддинги пузыря (15 слева и справа) плюс его отступы от края экрана.
 * Пузырь ограничен 82% ширины, поэтому на узких устройствах вроде SE сетка
 * фиксированной ширины вылезала бы за его границу.
 */
const BUBBLE_CHROME = 68;
/** Зазор между плитками. */
const GAP = 2;
/** Больше этого числа плиток не показываем — остаток уходит в плашку «+N». */
const MAX_TILES = 4;

/** Ширина сетки под текущую ширину экрана. */
function useAlbumWidth(): number {
	const { width } = useWindowDimensions();
	return Math.min(PREFERRED_WIDTH, Math.max(160, width * 0.82 - BUBBLE_CHROME));
}

interface AlbumGridProps {
	/** Только изображения, уже отфильтрованные вызывающим кодом. */
	images: ChatAttachment[];
	onPress: (attachment: ChatAttachment) => void;
}

interface TileProps {
	attachment: ChatAttachment;
	width: number;
	height: number;
	/** Число скрытых фото; выводит полупрозрачную плашку «+N» поверх плитки. */
	overflowCount?: number;
	onPress: (attachment: ChatAttachment) => void;
}

function Tile({ attachment, width, height, overflowCount, onPress }: TileProps) {
	return (
		<Pressable
			onPress={() => onPress(attachment)}
			style={[styles.tile, { width, height }]}
			accessibilityRole="imagebutton"
			accessibilityLabel={
				overflowCount ? `Открыть фото, ещё ${overflowCount}` : 'Открыть фото'
			}
		>
			<Image source={{ uri: attachment.url }} style={StyleSheet.absoluteFill} contentFit="cover" />
			{overflowCount ? (
				<View style={styles.overflow}>
					<Text style={styles.overflowText}>+{overflowCount}</Text>
				</View>
			) : null}
		</Pressable>
	);
}

/**
 * Сетка фотографий в сообщении-альбоме.
 *
 * Раскладки:
 * - 2 фото — две плитки на всю ширину, поровну;
 * - 3 фото — одно крупное слева, два поменьше справа столбиком;
 * - 4 и более — сетка 2x2, на последней плитке плашка «+N» с числом скрытых.
 *
 * Пропорции задаются самой раскладкой, а не размерами оригиналов: часть старых
 * вложений записана без width/height, и высота сетки прыгала бы в зависимости от
 * того, какие фото попали в сообщение. Одиночное изображение сюда не попадает —
 * его рендерит ImageAttachment по реальным пропорциям.
 */
export const AlbumGrid = React.memo(function AlbumGrid({ images, onPress }: AlbumGridProps) {
	const albumWidth = useAlbumWidth();
	const count = images.length;

	if (count === 2) {
		const size = (albumWidth - GAP) / 2;
		return (
			<View style={[styles.row, { width: albumWidth }]}>
				<Tile attachment={images[0]} width={size} height={size} onPress={onPress} />
				<Tile attachment={images[1]} width={size} height={size} onPress={onPress} />
			</View>
		);
	}

	if (count === 3) {
		const mainWidth = (albumWidth - GAP) * 0.62;
		const sideWidth = albumWidth - GAP - mainWidth;
		const sideHeight = (mainWidth - GAP) / 2;
		return (
			<View style={[styles.row, { width: albumWidth }]}>
				<Tile attachment={images[0]} width={mainWidth} height={mainWidth} onPress={onPress} />
				<View style={styles.column}>
					<Tile attachment={images[1]} width={sideWidth} height={sideHeight} onPress={onPress} />
					<Tile attachment={images[2]} width={sideWidth} height={sideHeight} onPress={onPress} />
				</View>
			</View>
		);
	}

	// 4 и более: сетка 2x2, лишнее прячется за плашкой на четвёртой плитке.
	const size = (albumWidth - GAP) / 2;
	const visible = images.slice(0, MAX_TILES);
	const hidden = count - MAX_TILES;

	return (
		<View style={[styles.grid, { width: albumWidth }]}>
			{visible.map((att, index) => (
				<Tile
					key={att.id}
					attachment={att}
					width={size}
					height={size}
					overflowCount={index === MAX_TILES - 1 && hidden > 0 ? hidden : undefined}
					onPress={onPress}
				/>
			))}
		</View>
	);
});

const styles = StyleSheet.create({
	row: {
		flexDirection: 'row',
		gap: GAP,
		borderRadius: 16,
		overflow: 'hidden',
	},
	column: {
		gap: GAP,
	},
	grid: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: GAP,
		borderRadius: 16,
		overflow: 'hidden',
	},
	tile: {
		overflow: 'hidden',
		backgroundColor: 'rgba(18,24,32,0.06)',
	},
	overflow: {
		position: 'absolute',
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		backgroundColor: 'rgba(0,0,0,0.55)',
		alignItems: 'center',
		justifyContent: 'center',
	},
	overflowText: {
		color: '#FFFFFF',
		fontSize: 22,
		fontWeight: '700',
	},
});
