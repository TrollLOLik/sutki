import React, { useCallback, useRef, useState } from 'react';
import { FlatList, Modal, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import Gallery, { type GalleryRef } from 'react-native-awesome-gallery';

import { ComponentMarker } from '@/components/debug/ComponentMarker';
import { useAppTheme } from '@/theme/useAppTheme';

const THUMBNAIL_SIZE = 58;
const THUMBNAIL_GAP = 9;

interface ImageViewerModalProps {
	visible: boolean;
	images: string[];
	initialIndex?: number;
	onClose: () => void;
}

export const ImageViewerModal: React.FC<ImageViewerModalProps> = ({
	visible,
	images,
	initialIndex = 0,
	onClose,
}) => {
	if (!visible || images.length === 0) {
		return null;
	}

	const safeInitialIndex = Math.min(Math.max(initialIndex, 0), images.length - 1);
	const galleryKey = `${safeInitialIndex}:${images.join('|')}`;

	return (
		<OpenImageViewer
			key={galleryKey}
			images={images}
			initialIndex={safeInitialIndex}
			onClose={onClose}
		/>
	);
};

interface OpenImageViewerProps {
	images: string[];
	initialIndex: number;
	onClose: () => void;
}

const OpenImageViewer: React.FC<OpenImageViewerProps> = ({ images, initialIndex, onClose }) => {
	const insets = useSafeAreaInsets();
	const { palette } = useAppTheme();
	const galleryRef = useRef<GalleryRef>(null);
	const thumbnailsRef = useRef<FlatList<string>>(null);
	const [currentIndex, setCurrentIndex] = useState(initialIndex);

	const scrollThumbnailToIndex = useCallback((index: number, animated = true) => {
		thumbnailsRef.current?.scrollToIndex({
			index,
			animated,
			viewPosition: 0.5,
		});
	}, []);

	const handleIndexChange = useCallback((index: number) => {
		setCurrentIndex(index);
		scrollThumbnailToIndex(index);
	}, [scrollThumbnailToIndex]);

	const handleThumbnailPress = useCallback((index: number) => {
		setCurrentIndex(index);
		galleryRef.current?.setIndex(index, true);
		scrollThumbnailToIndex(index);
	}, [scrollThumbnailToIndex]);

	return (
		<Modal
			visible
			transparent
			animationType="fade"
			onRequestClose={onClose}
			statusBarTranslucent
			navigationBarTranslucent
			hardwareAccelerated
		>
			<View className="flex-1 bg-black">
				<ComponentMarker kind="modal" name="ImageViewerModal" />
				<StatusBar barStyle="light-content" translucent />

				{/* Image Gallery */}
				<View className="flex-1">
					<Gallery
						ref={galleryRef}
						data={images}
						initialIndex={initialIndex}
						onIndexChange={handleIndexChange}
						onSwipeToClose={onClose}
						maxScale={4}
						doubleTapScale={2.5}
						disableTransitionOnScaledImage
						hideAdjacentImagesOnScaledImage
						renderItem={({ item, setImageDimensions }) => (
							<Image
								source={{ uri: item }}
								style={{ flex: 1 }}
								contentFit="contain"
								transition={0}
								onLoad={(e) => {
									const { width, height } = e.source;
									setImageDimensions({ width, height });
								}}
							/>
						)}
					/>
				</View>

				{/* Header Overlay */}
				<View
					className="absolute left-0 right-0 flex-row items-center justify-between px-5"
					style={{ top: Math.max(insets.top, 12) }}
				>
					{/* Spacer to balance the layout */}
					<View className="w-10 h-10" />

					{/* Page Indicator */}
					{images.length > 1 && (
						<View className="rounded-full bg-black/50 px-3.5 py-1.5 border border-white/10">
							<Text className="text-sm font-semibold text-white/90">
								{currentIndex + 1} / {images.length}
							</Text>
						</View>
					)}

					{/* Close Button */}
					<TouchableOpacity
						onPress={onClose}
						activeOpacity={0.7}
						className="h-10 w-10 items-center justify-center rounded-full bg-black/50 border border-white/10"
					>
						<Ionicons name="close" size={24} color="#FFFFFF" />
					</TouchableOpacity>
				</View>

				{images.length > 1 ? (
					<View
						style={[
							styles.thumbnailsBar,
							{ paddingBottom: Math.max(insets.bottom, 12) },
						]}>
						<FlatList
							ref={thumbnailsRef}
							data={images}
							horizontal
							showsHorizontalScrollIndicator={false}
							initialScrollIndex={initialIndex}
							contentContainerStyle={styles.thumbnailsContent}
							keyExtractor={(item, index) => `${item}-${index}`}
							getItemLayout={(_, index) => ({
								length: THUMBNAIL_SIZE + THUMBNAIL_GAP,
								offset: (THUMBNAIL_SIZE + THUMBNAIL_GAP) * index,
								index,
							})}
							onLayout={() => scrollThumbnailToIndex(currentIndex, false)}
							onScrollToIndexFailed={({ index }) => {
								thumbnailsRef.current?.scrollToOffset({
									offset: Math.max(0, index * (THUMBNAIL_SIZE + THUMBNAIL_GAP)),
									animated: false,
								});
							}}
							renderItem={({ item, index }) => {
								const selected = index === currentIndex;
								return (
									<TouchableOpacity
										accessibilityLabel={`Открыть изображение ${index + 1} из ${images.length}`}
										accessibilityRole="button"
										accessibilityState={{ selected }}
										activeOpacity={0.82}
										onPress={() => handleThumbnailPress(index)}
										style={[
											styles.thumbnail,
											{
												borderColor: selected ? palette.primary : 'rgba(255,255,255,0.18)',
												opacity: selected ? 1 : 0.58,
											},
										]}>
										<Image source={{ uri: item }} style={styles.thumbnailImage} contentFit="cover" transition={100} />
									</TouchableOpacity>
								);
							}}
						/>
					</View>
				) : null}
			</View>
		</Modal>
	);
};

const styles = StyleSheet.create({
	thumbnailsBar: {
		position: 'absolute',
		left: 0,
		right: 0,
		bottom: 0,
		paddingTop: 12,
		backgroundColor: 'rgba(0,0,0,0.72)',
	},
	thumbnailsContent: {
		gap: THUMBNAIL_GAP,
		paddingHorizontal: 16,
	},
	thumbnail: {
		width: THUMBNAIL_SIZE,
		height: THUMBNAIL_SIZE,
		padding: 2,
		borderWidth: 2,
		borderRadius: 13,
		overflow: 'hidden',
		backgroundColor: '#111111',
	},
	thumbnailImage: {
		flex: 1,
		borderRadius: 9,
	},
});
