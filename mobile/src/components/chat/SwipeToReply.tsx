import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
	interpolate,
	runOnJS,
	useAnimatedStyle,
	useSharedValue,
	withSpring,
} from 'react-native-reanimated';

import { useAppTheme } from '@/theme/useAppTheme';
import { hapticTapLight } from '@/lib/haptics';

/** Сдвиг, после которого жест считается ответом. */
const TRIGGER_DISTANCE = 56;
/** Дальше этого пузырь не тянется — резиновый упор. */
const MAX_TRANSLATION = 76;

interface SwipeToReplyProps {
	children: React.ReactNode;
	/** Ответ на это сообщение. Не вызывается, если жест не дошёл до порога. */
	onReply: () => void;
	/** Выключает жест: удалённые сообщения и диалог с удалённым профилем. */
	disabled?: boolean;
}

/**
 * Свайп по сообщению вправо — ответить (как в Telegram).
 *
 * Реализовано на Gesture.Pan, а не на устаревшем Swipeable: этот API уже
 * используется в проекте, и он даёт прямой контроль над порогами распознавания,
 * без которых жест конфликтует со скроллом ленты.
 *
 * Три вещи, от которых зависит, будет ли это ощущаться правильно:
 *
 * 1. activeOffsetX / failOffsetY. Лента сообщений скроллится вертикально, и без
 *    этих порогов любое движение пальцем по диагонали то тянуло бы пузырь, то
 *    дёргало список. Жест активируется только после явного горизонтального
 *    сдвига и сдаётся, если палец ушёл вверх или вниз.
 * 2. Направление всегда вправо, независимо от автора сообщения. В Telegram так
 *    же: свайп «к центру» одинаков для своих и чужих, поэтому мышечная память
 *    не ломается на границе пузырей.
 * 3. Отклик срабатывает один раз за жест, в момент пересечения порога — а не
 *    на каждом кадре. Отсюда флаг hasTriggered в shared value: вибромотор на
 *    60 кадрах в секунду превращается в жужжание.
 *
 * Иконка появляется по мере вытягивания и уезжает вместе с пузырём.
 */
export const SwipeToReply = React.memo(function SwipeToReply({
	children,
	onReply,
	disabled = false,
}: SwipeToReplyProps) {
	const { palette } = useAppTheme();
	const translateX = useSharedValue(0);
	const hasTriggered = useSharedValue(false);

	const gesture = React.useMemo(
		() =>
			Gesture.Pan()
				.enabled(!disabled)
				// Порог активации: пока палец не сдвинулся по горизонтали, жест
				// не забирает управление у FlatList.
				.activeOffsetX([-24, 24])
				// Вертикальное движение отдаёт управление скроллу.
				.failOffsetY([-16, 16])
				.onBegin(() => {
					hasTriggered.value = false;
				})
				.onUpdate((event) => {
					// Только вправо: тянуть влево нечему — действий там нет.
					if (event.translationX <= 0) {
						translateX.value = 0;
						return;
					}
					// Резиновое сопротивление за порогом: пузырь продолжает
					// двигаться, но всё неохотнее, и понятно, что дальше некуда.
					const raw = event.translationX;
					translateX.value =
						raw <= TRIGGER_DISTANCE
							? raw
							: TRIGGER_DISTANCE + (raw - TRIGGER_DISTANCE) * 0.25;

					if (!hasTriggered.value && raw >= TRIGGER_DISTANCE) {
						hasTriggered.value = true;
						runOnJS(hapticTapLight)();
					}
				})
				.onEnd(() => {
					if (hasTriggered.value) {
						runOnJS(onReply)();
					}
					// Пружина, а не линейный возврат: жест должен ощущаться
					// упругим, иначе пузырь «отваливается» назад.
					translateX.value = withSpring(0, { damping: 20, stiffness: 220 });
				})
				.onFinalize(() => {
					// Прерванный жест (например, перехваченный навигацией) тоже
					// обязан вернуть пузырь на место.
					if (translateX.value !== 0) {
						translateX.value = withSpring(0, { damping: 20, stiffness: 220 });
					}
				}),
		[disabled, hasTriggered, onReply, translateX],
	);

	const contentStyle = useAnimatedStyle(() => ({
		transform: [{ translateX: translateX.value }],
	}));

	const iconStyle = useAnimatedStyle(() => ({
		opacity: interpolate(translateX.value, [0, TRIGGER_DISTANCE * 0.5, TRIGGER_DISTANCE], [0, 0.5, 1]),
		transform: [
			{ translateX: translateX.value - MAX_TRANSLATION * 0.55 },
			{ scale: interpolate(translateX.value, [0, TRIGGER_DISTANCE], [0.7, 1]) },
		],
	}));

	if (disabled) {
		return <>{children}</>;
	}

	return (
		<View>
			<Animated.View
				pointerEvents="none"
				style={[styles.iconWrap, iconStyle]}
				accessibilityElementsHidden
				importantForAccessibility="no-hide-descendants"
			>
				<View style={[styles.iconCircle, { backgroundColor: palette.primaryLight }]}>
					<Ionicons name="arrow-undo" size={16} color={palette.primary} />
				</View>
			</Animated.View>

			<GestureDetector gesture={gesture}>
				<Animated.View style={contentStyle}>{children}</Animated.View>
			</GestureDetector>
		</View>
	);
});

const styles = StyleSheet.create({
	iconWrap: {
		position: 'absolute',
		left: 0,
		top: 0,
		bottom: 0,
		justifyContent: 'center',
		zIndex: 0,
	},
	iconCircle: {
		width: 32,
		height: 32,
		borderRadius: 16,
		alignItems: 'center',
		justifyContent: 'center',
	},
});
