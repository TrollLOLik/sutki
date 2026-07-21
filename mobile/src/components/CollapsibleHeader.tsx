import type { ReactNode } from 'react';
import { useCallback, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';

type ScrollEvent = NativeSyntheticEvent<NativeScrollEvent>;

export type CollapsibleHeaderController = {
  expanded: boolean;
  height: number;
  onScroll: (event: ScrollEvent) => void;
  onScrollBeginDrag: (event: ScrollEvent) => void;
  onScrollEndDrag: () => void;
  progress: Animated.Value;
  setMeasuredHeight: (height: number) => void;
  show: () => void;
};

type CollapsibleHeaderProps = {
  children: ReactNode;
  controller: CollapsibleHeaderController;
  style?: ViewStyle;
};

const HIDE_DISTANCE = 1;
const SHOW_DISTANCE = 12;
const ALWAYS_VISIBLE_OFFSET = 1;

export function useCollapsibleHeader(): CollapsibleHeaderController {
  const progress = useRef(new Animated.Value(1)).current;
  const [expanded, setExpanded] = useState(true);
  const [height, setHeight] = useState(140);
  const expandedRef = useRef(true);
  const lastOffsetRef = useRef(0);
  const directionRef = useRef<-1 | 0 | 1>(0);
  const distanceRef = useRef(0);
  const keepExpandedForDragRef = useRef(false);

  const setVisibility = useCallback((nextExpanded: boolean) => {
    if (expandedRef.current === nextExpanded) return;

    expandedRef.current = nextExpanded;
    setExpanded(nextExpanded);
    progress.stopAnimation();
    Animated.timing(progress, {
      toValue: nextExpanded ? 1 : 0,
      duration: nextExpanded ? 280 : 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      directionRef.current = 0;
      distanceRef.current = 0;
    });
  }, [progress]);

  const show = useCallback(() => {
    directionRef.current = 0;
    distanceRef.current = 0;
    setVisibility(true);
  }, [setVisibility]);

  const onScrollBeginDrag = useCallback((event: ScrollEvent) => {
    const offset = Math.max(0, event.nativeEvent.contentOffset.y);
    lastOffsetRef.current = offset;
    directionRef.current = 0;
    distanceRef.current = 0;

    // Once a collapsed list has returned to its top, the next deliberate
    // gesture reveals the controls. Keep them open for the rest of this drag
    // so the same gesture cannot immediately collapse them again.
    keepExpandedForDragRef.current = !expandedRef.current && offset <= ALWAYS_VISIBLE_OFFSET;
    if (keepExpandedForDragRef.current) {
      setVisibility(true);
    }
  }, [setVisibility]);

  const onScrollEndDrag = useCallback(() => {
    keepExpandedForDragRef.current = false;
    directionRef.current = 0;
    distanceRef.current = 0;
  }, []);

  const setMeasuredHeight = useCallback((nextHeight: number) => {
    setHeight((currentHeight) => currentHeight === nextHeight ? currentHeight : nextHeight);
  }, []);

  const onScroll = useCallback((event: ScrollEvent) => {
    const offset = Math.max(0, event.nativeEvent.contentOffset.y);
    const delta = offset - lastOffsetRef.current;
    lastOffsetRef.current = offset;

    if (keepExpandedForDragRef.current) return;

    if (offset <= ALWAYS_VISIBLE_OFFSET) {
      directionRef.current = 0;
      distanceRef.current = 0;
      return;
    }

    if (Math.abs(delta) < 0.1 || Math.abs(delta) > 120) return;

    const direction: -1 | 1 = delta > 0 ? 1 : -1;
    if (directionRef.current !== direction) {
      directionRef.current = direction;
      distanceRef.current = 0;
    }
    distanceRef.current += Math.abs(delta);

    if (direction === 1 && distanceRef.current >= HIDE_DISTANCE) {
      setVisibility(false);
      distanceRef.current = 0;
    } else if (direction === -1 && distanceRef.current >= SHOW_DISTANCE) {
      setVisibility(true);
      distanceRef.current = 0;
    }
  }, [setVisibility]);

  return {
    expanded,
    height,
    onScroll,
    onScrollBeginDrag,
    onScrollEndDrag,
    progress,
    setMeasuredHeight,
    show,
  };
}

export function CollapsibleHeader({ children, controller, style }: CollapsibleHeaderProps) {
  const [contentHeight, setContentHeight] = useState<number | null>(null);

  const animatedStyle = contentHeight === null
    ? undefined
    : {
        opacity: controller.progress,
        transform: [
          {
            translateY: controller.progress.interpolate({
              inputRange: [0, 1],
              outputRange: [-contentHeight - 8, 0],
            }),
          },
        ],
      };

  return (
    <Animated.View
      pointerEvents={controller.expanded ? 'auto' : 'none'}
      style={[styles.shell, style, animatedStyle]}
    >
      <View
        collapsable={false}
        onLayout={(event) => {
          const nextHeight = Math.ceil(event.nativeEvent.layout.height);
          if (nextHeight > 0 && nextHeight !== contentHeight) {
            setContentHeight(nextHeight);
            controller.setMeasuredHeight(nextHeight);
          }
        }}
      >
        {children}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shell: {
    position: 'absolute',
    top: 0,
    right: 0,
    left: 0,
    zIndex: 20,
    elevation: 8,
    overflow: 'hidden',
  },
});
