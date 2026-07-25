import React from 'react';

import { useAppTheme } from '@/theme/useAppTheme';

/**
 * Палитра поверхностей чата.
 *
 * Экран диалога — единственное место в приложении, где нужны полупрозрачные
 * слои поверх ленты сообщений (блюр-хедер, «стекло» композера) и отдельный фон
 * входящего пузыря, отличающийся от общего surface. В токенах таких значений
 * нет, поэтому раньше объект собирался инлайном в самом экране.
 *
 * Вынесено сюда, чтобы вынутые из экрана компоненты (пузырь, композер, сетка
 * альбома) использовали те же значения и не расползались по оттенкам.
 */
export interface ChatColors {
	/** Фон ленты сообщений. */
	background: string;
	/** Полупрозрачный слой хедера и композера — поверх него идёт BlurView. */
	chrome: string;
	/** Плотная поверхность: карточки, панели. */
	panel: string;
	/** Приподнятая поверхность: поле ввода, чипы, кнопки-иконки. */
	panelRaised: string;
	/** Фон входящего пузыря. Исходящий берёт palette.primary. */
	incoming: string;
	/** Заметная граница. */
	border: string;
	/** Едва различимая граница — разделители внутри поверхностей. */
	softBorder: string;
}

export function useChatColors(): ChatColors {
	const { isDark } = useAppTheme();

	return React.useMemo(
		() => ({
			background: isDark ? '#0D0F12' : '#F4F5F7',
			chrome: isDark ? 'rgba(20, 22, 27, 0.97)' : 'rgba(255, 255, 255, 0.97)',
			panel: isDark ? '#181A1F' : '#FFFFFF',
			panelRaised: isDark ? '#202329' : '#F0F1F3',
			incoming: isDark ? '#1B1E23' : '#FFFFFF',
			border: isDark ? 'rgba(255,255,255,0.09)' : 'rgba(18,24,32,0.09)',
			softBorder: isDark ? 'rgba(255,255,255,0.055)' : 'rgba(18,24,32,0.06)',
		}),
		[isDark],
	);
}
