import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { ChatMessage } from '@/store/chatStore';
import { useAppTheme } from '@/theme/useAppTheme';
import { useChatColors } from './useChatColors';
import { IconButton } from '@/components/ui';

interface EditPreviewBarProps {
	/** Сообщение, которое сейчас редактируется. */
	message: ChatMessage;
	onCancel: () => void;
}

/**
 * Полоса над полем ввода в режиме правки.
 *
 * Показывает исходный текст, а не текущий из поля: пока пользователь правит,
 * важно видеть, от чего он отталкивался. Визуально отличается от блока ответа
 * иконкой и подписью — иначе два похожих состояния композера легко спутать, и
 * правка уходит новым сообщением.
 */
export function EditPreviewBar({ message, onCancel }: EditPreviewBarProps) {
	const { palette } = useAppTheme();
	const chatColors = useChatColors();

	const original = message.body ?? '';
	const preview = original.length > 120 ? `${original.slice(0, 120)}…` : original;

	return (
		<View
			style={[styles.container, { borderTopColor: chatColors.softBorder }]}
			accessibilityLabel={`Изменение сообщения: ${preview}`}
		>
			<View style={[styles.bar, { backgroundColor: palette.primary }]} />

			<Ionicons
				name="create-outline"
				size={16}
				color={palette.primary}
				style={styles.leadingIcon}
			/>

			<View style={styles.textWrap}>
				<Text className="text-[12px] font-bold text-primary">Изменение сообщения</Text>
				<Text numberOfLines={1} className="text-[12px] text-ink-secondary mt-0.5">
					{preview}
				</Text>
			</View>

			<IconButton
				icon="close"
				size={32}
				iconSize={16}
				onPress={onCancel}
				accessibilityLabel="Отменить изменение"
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
	textWrap: {
		flex: 1,
		paddingLeft: 8,
		minWidth: 0,
	},
});
