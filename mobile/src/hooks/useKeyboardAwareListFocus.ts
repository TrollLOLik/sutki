import { useCallback, type RefObject } from 'react';
import type { FlatList } from 'react-native';
import { runOnJS, useSharedValue } from 'react-native-reanimated';
import { useGenericKeyboardHandler } from 'react-native-keyboard-controller';

type ListRef<T> = RefObject<FlatList<T> | null>;

type KeyboardAwareListFocusOptions = {
  viewPosition?: number;
  viewOffset?: number;
};

/** Keeps a dynamically rendered FlatList editor visible after IME size changes. */
export function useKeyboardAwareListFocus<T>(
  listRef: ListRef<T>,
  { viewPosition = 0.12, viewOffset = 8 }: KeyboardAwareListFocusOptions = {},
) {
  const focusedIndex = useSharedValue(-1);

  const scrollToFocusedIndex = useCallback(
    (index: number, animated = true) => {
      if (index < 0) return;
      listRef.current?.scrollToIndex({
        index,
        animated,
        viewPosition,
        viewOffset,
      });
    },
    [listRef, viewOffset, viewPosition],
  );

  useGenericKeyboardHandler(
    {
      onEnd: (event) => {
        'worklet';
        if (event.height <= 0 || focusedIndex.value < 0) return;
        runOnJS(scrollToFocusedIndex)(focusedIndex.value, true);
      },
    },
    [scrollToFocusedIndex],
  );

  const handleFocus = useCallback(
    (index: number) => {
      focusedIndex.value = index;
      scrollToFocusedIndex(index);
    },
    [focusedIndex, scrollToFocusedIndex],
  );

  const clearFocus = useCallback(() => {
    focusedIndex.value = -1;
  }, [focusedIndex]);

  return { handleFocus, clearFocus };
}
