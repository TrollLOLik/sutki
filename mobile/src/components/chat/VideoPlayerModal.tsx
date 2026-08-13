import React from 'react';
import { View, Modal, StatusBar, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { VideoView, useVideoPlayer } from 'expo-video';

import { IconButton } from '@/components/ui';

interface VideoPlayerModalProps {
	/** null — плеер закрыт. Плеер размонтируется, освобождая декодер. */
	uri: string | null;
	onClose: () => void;
}

/**
 * Полноэкранный проигрыватель видео из чата.
 *
 * Открывается только по тапу на обложку — в ленте видео живёт статичной
 * картинкой. Плеер существует лишь пока модалка открыта: держать декодер живым
 * ради невидимого сообщения незачем, а на слабых устройствах несколько
 * инстансов заметно тормозят скролл.
 *
 * Управление отдано нативным контролам: свой набор кнопок пришлось бы
 * поддерживать на двух платформах, а пользователи и так знают системный плеер.
 */
export function VideoPlayerModal({ uri, onClose }: VideoPlayerModalProps) {
	const insets = useSafeAreaInsets();

	// Пустая строка вместо null: хук нельзя вызывать условно, а пустой источник
	// плеер просто не грузит.
	const player = useVideoPlayer(uri ?? '', (instance) => {
		// Автозапуск оправдан здесь и только здесь: пользователь уже нажал Play на
		// обложке, и второй тап был бы лишним.
		instance.loop = false;
		if (uri) instance.play();
	});

	// Остановка при закрытии: иначе звук продолжает играть за закрытой модалкой.
	const handleClose = React.useCallback(() => {
		try {
			player.pause();
		} catch {
			// Плеер мог быть уже освобождён — не мешаем закрытию.
		}
		onClose();
	}, [onClose, player]);

	if (!uri) return null;

	return (
		<Modal
			visible
			transparent={false}
			animationType="fade"
			onRequestClose={handleClose}
			statusBarTranslucent
			navigationBarTranslucent
			hardwareAccelerated
			supportedOrientations={['portrait', 'landscape']}
		>
			<View style={styles.container}>
				<StatusBar barStyle="light-content" translucent />

				<VideoView
					player={player}
					style={styles.video}
					contentFit="contain"
					nativeControls
					// PiP выключен: видео из переписки не тот контент, для которого
					// нужен плавающий плеер поверх других экранов.
					allowsPictureInPicture={false}
				/>

				<View style={[styles.closeWrap, { top: insets.top + 8 }]}>
					<IconButton
						icon="close"
						size={44}
						iconSize={22}
						onPress={handleClose}
						accessibilityLabel="Закрыть видео"
					/>
				</View>
			</View>
		</Modal>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#000',
	},
	video: {
		flex: 1,
	},
	closeWrap: {
		position: 'absolute',
		right: 12,
	},
});
