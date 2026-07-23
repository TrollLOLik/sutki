import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import Gallery from 'react-native-awesome-gallery';

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
	const insets = useSafeAreaInsets();
	const [currentIndex, setCurrentIndex] = useState(initialIndex);

	// Sync current index when modal opens
	useEffect(() => {
		if (visible) {
			setCurrentIndex(initialIndex);
		}
	}, [visible, initialIndex]);

	if (!visible || images.length === 0) {
		return null;
	}

	return (
		<Modal
			visible={visible}
			transparent
			animationType="fade"
			onRequestClose={onClose}
			statusBarTranslucent
			navigationBarTranslucent
			hardwareAccelerated
		>
			<View className="flex-1 bg-black">
				<StatusBar barStyle="light-content" translucent />

				{/* Image Gallery */}
				<View className="flex-1">
					<Gallery
						data={images}
						initialIndex={initialIndex}
						onIndexChange={setCurrentIndex}
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
			</View>
		</Modal>
	);
};
