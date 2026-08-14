import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';

import { AppIcon, AppText, Chip } from '@/components/ui';
import { useAppTheme } from '@/theme/useAppTheme';

interface SuggestionChipsProps {
	suggestions: string[];
	/** Подсказки от модели, а не статичный набор — показываем это иконкой. */
	generated: boolean;
	/** Короткий тап — вставить в поле ввода с возможностью правки. */
	onPick: (text: string) => void;
	/** Долгое нажатие — отправить сразу, без правки. */
	onSendNow: (text: string) => void;
}

/**
 * Полоса быстрых ответов над полем ввода.
 *
 * Раньше это были четыре зашитые в экран фразы, показывавшиеся только владельцу.
 * Теперь набор приходит с сервера: под роль (владелец или гость) и с учётом
 * последнего входящего сообщения. Если модель недоступна, подсказки просто не
 * показываются: статичная фраза может не соответствовать вопросу собеседника.
 *
 * Поведение чипа: короткий тап вставляет текст в поле, чтобы его можно было
 * поправить перед отправкой; долгое нажатие отправляет сразу. Вставка выбрана
 * основным действием сознательно — подсказка почти всегда требует правки под
 * конкретные даты, а мгновенная отправка чужой формулировки в переписке по
 * сделке слишком легко приводит к обещанию, которого не имели в виду.
 */
export const SuggestionChips = React.memo(function SuggestionChips({
	suggestions,
	generated,
	onPick,
	onSendNow,
}: SuggestionChipsProps) {
	const { palette } = useAppTheme();

	if (!suggestions.length) return null;

	return (
		<View>
			{generated ? (
				<View style={styles.header}>
					<AppIcon name="sparkles-outline" size={12} color={palette.primary} />
					<AppText variant="caption" tone="muted" style={styles.hint}>
						Варианты ответа · удерживайте, чтобы отправить сразу
					</AppText>
				</View>
			) : null}

			<ScrollView
				horizontal
				showsHorizontalScrollIndicator={false}
				contentContainerStyle={styles.scrollContent}
				keyboardShouldPersistTaps="handled"
			>
				{suggestions.map((text) => (
					<Chip
						key={text}
						label={text}
						onPress={() => onPick(text)}
						onLongPress={() => onSendNow(text)}
						delayLongPress={320}
						accessibilityRole="button"
						accessibilityLabel={`Вариант ответа: ${text}`}
						accessibilityHint="Нажмите, чтобы вставить в поле ввода. Удерживайте, чтобы отправить сразу."
					/>
				))}
			</ScrollView>
		</View>
	);
});

const styles = StyleSheet.create({
	header: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: 16,
		paddingTop: 10,
		paddingBottom: 2,
	},
	hint: {
		marginLeft: 4,
		fontSize: 11,
		fontWeight: '600',
	},
	scrollContent: {
		paddingHorizontal: 16,
		paddingTop: 8,
		gap: 8,
	},
});
