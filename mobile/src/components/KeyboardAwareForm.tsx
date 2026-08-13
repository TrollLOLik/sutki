import { forwardRef, useCallback, useState, type ReactNode } from 'react';
import {
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated from 'react-native-reanimated';
import {
  KeyboardAwareScrollView,
  type KeyboardAwareScrollViewProps,
  type KeyboardAwareScrollViewRef,
} from 'react-native-keyboard-controller';

import { useKeyboardStickyStyle } from '@/hooks/useKeyboardStickyStyle';

type KeyboardAwareFormProps = Omit<
  KeyboardAwareScrollViewProps,
  'bottomOffset' | 'children'
> & {
  children: ReactNode;
  footer: ReactNode;
  rootStyle?: StyleProp<ViewStyle>;
  footerStyle?: StyleProp<ViewStyle>;
  /** Free space between the focused caret and the controls above the keyboard. */
  keyboardGap?: number;
  /** Free scrollable space above the footer when the keyboard is closed. */
  contentFooterGap?: number;
};

type KeyboardAwareFormScrollViewProps = Omit<
  KeyboardAwareScrollViewProps,
  'bottomOffset'
> & {
  /** Free space between the focused caret and the keyboard. */
  keyboardGap?: number;
};

export const KeyboardAwareFormScrollView = forwardRef<
  KeyboardAwareScrollViewRef,
  KeyboardAwareFormScrollViewProps
>(function KeyboardAwareFormScrollView(
  {
    keyboardGap = 16,
    keyboardDismissMode = 'on-drag',
    keyboardShouldPersistTaps = 'handled',
    showsVerticalScrollIndicator = false,
    ...props
  },
  ref,
) {
  return (
    <KeyboardAwareScrollView
      ref={ref}
      mode="insets"
      bottomOffset={keyboardGap}
      keyboardDismissMode={keyboardDismissMode}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      showsVerticalScrollIndicator={showsVerticalScrollIndicator}
      {...props}
    />
  );
});

/**
 * Form layout with caret-aware scrolling and a footer that follows every IME
 * height change, including switching an Android keyboard to its emoji panel.
 */
export const KeyboardAwareForm = forwardRef<
  KeyboardAwareScrollViewRef,
  KeyboardAwareFormProps
>(function KeyboardAwareForm(
  {
    children,
    footer,
    rootStyle,
    footerStyle,
    keyboardGap = 16,
    contentFooterGap = 12,
    keyboardDismissMode = 'on-drag',
    keyboardShouldPersistTaps = 'handled',
    showsVerticalScrollIndicator = false,
    ...scrollProps
  },
  ref,
) {
  const keyboardStickyStyle = useKeyboardStickyStyle();
  const [footerHeight, setFooterHeight] = useState(0);

  const handleFooterLayout = useCallback((event: LayoutChangeEvent) => {
    const nextHeight = Math.ceil(event.nativeEvent.layout.height);
    setFooterHeight((currentHeight) =>
      currentHeight === nextHeight ? currentHeight : nextHeight,
    );
  }, []);

  return (
    <View style={[styles.root, rootStyle]}>
      <KeyboardAwareScrollView
        ref={ref}
        mode="insets"
        bottomOffset={footerHeight + keyboardGap}
        keyboardDismissMode={keyboardDismissMode}
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        showsVerticalScrollIndicator={showsVerticalScrollIndicator}
        {...scrollProps}>
        {children}
        <View
          pointerEvents="none"
          style={{ height: footerHeight + contentFooterGap }}
        />
      </KeyboardAwareScrollView>

      <Animated.View
        onLayout={handleFooterLayout}
        style={[styles.footer, footerStyle, keyboardStickyStyle]}>
        {footer}
      </Animated.View>
    </View>
  );
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  footer: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 20,
  },
});
