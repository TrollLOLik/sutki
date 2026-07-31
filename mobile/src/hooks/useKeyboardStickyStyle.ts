import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {
  useGenericKeyboardHandler,
  useReanimatedKeyboardAnimation,
} from 'react-native-keyboard-controller';

/** Keeps a bottom control attached to the IME, including keyboard mode changes. */
export function useKeyboardStickyStyle() {
  const insets = useSafeAreaInsets();
  const { height: nativeKeyboardHeight } = useReanimatedKeyboardAnimation();
  const keyboardHeight = useSharedValue(0);
  const hasKeyboardEvent = useSharedValue(false);
  const keyboardIsResizing = useSharedValue(false);

  useGenericKeyboardHandler(
    {
      onStart: (event) => {
        'worklet';

        if (!hasKeyboardEvent.value) {
          keyboardHeight.value = Math.max(0, -nativeKeyboardHeight.value);
          hasKeyboardEvent.value = true;
        }

        // Opening and closing follow the native IME. Smooth only an in-place
        // height change, such as switching from letters to a taller emoji panel.
        keyboardIsResizing.value = keyboardHeight.value > 0 && event.height > 0;
        if (keyboardIsResizing.value) {
          keyboardHeight.value = withTiming(event.height, {
            duration: 120,
            easing: Easing.out(Easing.cubic),
          });
        }
      },
      onMove: (event) => {
        'worklet';

        hasKeyboardEvent.value = true;
        if (!keyboardIsResizing.value) {
          keyboardHeight.value = event.height;
        }
      },
      onInteractive: (event) => {
        'worklet';

        hasKeyboardEvent.value = true;
        keyboardIsResizing.value = false;
        keyboardHeight.value = event.height;
      },
      onEnd: (event) => {
        'worklet';

        hasKeyboardEvent.value = true;
        if (keyboardIsResizing.value) {
          keyboardHeight.value = withTiming(event.height, {
            duration: 80,
            easing: Easing.out(Easing.cubic),
          });
        } else {
          keyboardHeight.value = event.height;
        }
        keyboardIsResizing.value = false;
      },
    },
    [],
  );

  return useAnimatedStyle(
    () => {
      const height = hasKeyboardEvent.value
        ? keyboardHeight.value
        : Math.max(0, -nativeKeyboardHeight.value);

      return {
        transform: [
          {
            translateY: -Math.max(0, height - insets.bottom),
          },
        ],
      };
    },
    [insets.bottom],
  );
}
