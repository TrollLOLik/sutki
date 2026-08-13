import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

import type { MessageQuote } from '@/store/chatStore';
import { useAppTheme } from '@/theme/useAppTheme';

interface QuotedMessageProps {
	quote: MessageQuote;
	/** Цитата внутри исходящего пузыря — на фоне primary нужен светлый текст. */
	onDark: boolean;
	/** Имя автора процитированного сообщения. */
	authorName: string;
	/** Переход к оригиналу. Не передаётся, если цитата в превью композера. */
	onPress?: () => void;
	/** Компактный вид без фона — для блока над полем ввода. */
	variant?: 'bubble' | 'composer';
}

/**
 * Процитированное сообщение: вертикальная полоса, автор и превью содержимого.
 *
 * Данные приходят с сервера уже готовыми (body_preview обрезан, миниатюра
 * подписана) — компонент только выбирает, что показать:
 *
 * - удалённый родитель → «Сообщение удалено» курсивом, без текста и миниатюры;
 * - есть текст → сам текст в одну строку;
 * - только вложения → «N фото» либо «Файл», плюс миниатюра, если это картинка.
 *
 * Порядок ветвлений важен: удаление проверяется первым, иначе для сообщения,
 * удалённого до появления этой фичи, можно было бы показать остаточные данные.
 */
export const QuotedMessage = React.memo(function QuotedMessage({
	quote,
	onDark,
	authorName,
	onPress,
	variant = 'bubble',
}: QuotedMessageProps) {
	const { palette } = useAppTheme();

	const accent = onDark ? 'rgba(255,255,255,0.85)' : palette.primary;
	const authorColor = onDark ? 'text-white' : 'text-primary';
	const bodyColor = onDark ? 'text-white/80' : 'text-ink-secondary';
	const background = onDark
		? 'rgba(255,255,255,0.14)'
		: variant === 'composer'
			? 'transparent'
			: 'rgba(18,24,32,0.05)';

	const preview = React.useMemo(() => {
		if (quote.deleted) return 'Сообщение удалено';
		if (quote.body_preview) return quote.body_preview;
		if (quote.attachment_count > 1) return `${quote.attachment_count} фото`;
		if (quote.attachment_count === 1) return quote.first_attachment_url ? 'Фото' : 'Файл';
		return 'Сообщение';
	}, [quote]);

	const showThumb = !quote.deleted && !!quote.first_attachment_url;

	const content = (
		<View style={[styles.container, { backgroundColor: background }]}>
			<View style={[styles.bar, { backgroundColor: accent }]} />

			{showThumb ? (
				<Image source={{ uri: quote.first_attachment_url }} style={styles.thumb} contentFit="cover" />
			) : null}

			<View style={styles.textWrap}>
				<Text numberOfLines={1} className={`text-[12px] font-bold ${authorColor}`}>
					{authorName}
				</Text>
				<Text
					numberOfLines={1}
					className={`text-[12px] mt-0.5 ${bodyColor}`}
					style={quote.deleted ? styles.deletedText : undefined}
				>
					{preview}
				</Text>
			</View>

			{!quote.deleted && !showThumb && quote.attachment_count > 0 ? (
				<Ionicons
					name="document-outline"
					size={14}
					color={onDark ? 'rgba(255,255,255,0.8)' : palette.inkMuted}
					style={styles.trailingIcon}
				/>
			) : null}
		</View>
	);

	if (!onPress) return content;

	return (
		<Pressable
			onPress={onPress}
			accessibilityRole="button"
			accessibilityLabel={`Перейти к сообщению: ${preview}`}
			style={({ pressed }) => (pressed ? styles.pressed : undefined)}
		>
			{content}
		</Pressable>
	);
});

const styles = StyleSheet.create({
	container: {
		flexDirection: 'row',
		alignItems: 'center',
		borderRadius: 10,
		paddingRight: 8,
		marginBottom: 6,
		overflow: 'hidden',
		minHeight: 38,
	},
	bar: {
		width: 3,
		alignSelf: 'stretch',
		borderTopLeftRadius: 10,
		borderBottomLeftRadius: 10,
	},
	thumb: {
		width: 30,
		height: 30,
		borderRadius: 6,
		marginLeft: 6,
	},
	textWrap: {
		flex: 1,
		paddingLeft: 8,
		paddingVertical: 5,
		minWidth: 0,
	},
	deletedText: {
		fontStyle: 'italic',
	},
	trailingIcon: {
		marginLeft: 4,
	},
	pressed: {
		opacity: 0.7,
	},
});
