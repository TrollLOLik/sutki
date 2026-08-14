/**
 * Тактильный отклик для интерфейса приложения.
 *
 * Обёртка над expo-haptics по трём причинам:
 *
 * 1. Отклик — украшение, а не функциональность. Любая ошибка (нет вибромотора,
 *    отключено в системе, веб-платформа) должна тихо игнорироваться, а не рвать
 *    жест свайпа. Поэтому каждый вызов проглатывает исключение.
 * 2. Вызовы асинхронные, но нам не нужно их ждать — жест не должен ждать
 *    вибромотор. Функции синхронные (fire-and-forget).
 * 3. Модуль загружается лениво. Он нужен только при реальном взаимодействии,
 *    а на старте приложения удлинял бы TTI.
 *
 * Вызывать можно и из worklet'ов reanimated — но только через runOnJS,
 * потому что нативный модуль недоступен на UI-потоке.
 */

type HapticsModule = typeof import('expo-haptics');

let cached: HapticsModule | null = null;
let failed = false;

function load(): HapticsModule | null {
	if (cached || failed) return cached;
	try {
		cached = require('expo-haptics') as HapticsModule;
	} catch {
		// Модуль не собран в текущем бинарнике (например, старый дев-клиент).
		// Запоминаем провал, чтобы не пытаться на каждый жест.
		failed = true;
	}
	return cached;
}

/**
 * Короткий лёгкий отклик. Порог свайпа-на-ответ, переключение состояния.
 * Вызывать один раз на жест, а не на каждый кадр перемещения.
 */
export function hapticTapLight(): void {
	const mod = load();
	if (!mod) return;
	mod.impactAsync(mod.ImpactFeedbackStyle.Light).catch(() => {});
}

/** Более весомый отклик. Открытие панели действий по долгому нажатию. */
export function hapticTapMedium(): void {
	const mod = load();
	if (!mod) return;
	mod.impactAsync(mod.ImpactFeedbackStyle.Medium).catch(() => {});
}

/** Успешное завершение: сообщение ушло, файл сохранён. */
export function hapticSuccess(): void {
	const mod = load();
	if (!mod) return;
	mod.notificationAsync(mod.NotificationFeedbackType.Success).catch(() => {});
}

/** Ошибка: отправка не удалась, вложение отклонено модерацией. */
export function hapticError(): void {
	const mod = load();
	if (!mod) return;
	mod.notificationAsync(mod.NotificationFeedbackType.Error).catch(() => {});
}
