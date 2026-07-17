import { useCallback, useMemo, type ReactElement } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

import { useAppTheme } from '@/theme/useAppTheme';

const TAB_ORDER = ['index', 'map', 'messages', 'profile'] as const;
const SWIPE_DISTANCE = 64;
const SWIPE_VELOCITY = 650;
const MAP_EDGE_WIDTH = 28;
const SEARCH_HEADER_GESTURE_INSET = 190;

type TabName = (typeof TAB_ORDER)[number];

interface SwipeableTabSceneProps {
  children: ReactElement;
  routeName: string;
  navigate: (name: TabName) => void;
}

export function SwipeableTabScene({ children, routeName, navigate }: SwipeableTabSceneProps) {
  const { palette } = useAppTheme();
  const routeIndex = TAB_ORDER.indexOf(routeName as TabName);

  const switchTab = useCallback(
    (direction: -1 | 1) => {
      const next = TAB_ORDER[routeIndex + direction];
      if (next) navigate(next);
    },
    [navigate, routeIndex],
  );

  const createPanGesture = useCallback(() => {
    const gesture = Gesture.Pan()
      .activeOffsetX([-22, 22])
      .failOffsetY([-14, 14])
      .onEnd(({ translationX, velocityX }) => {
        const swipedLeft = translationX < -SWIPE_DISTANCE || velocityX < -SWIPE_VELOCITY;
        const swipedRight = translationX > SWIPE_DISTANCE || velocityX > SWIPE_VELOCITY;

        if (swipedLeft && routeIndex < TAB_ORDER.length - 1) {
          runOnJS(switchTab)(1);
        } else if (swipedRight && routeIndex > 0) {
          runOnJS(switchTab)(-1);
        }
      });

    // The search header has its own horizontal room picker. Keep that gesture
    // local while allowing tab swipes across the rest of the screen.
    if (routeName === 'index') {
      gesture.hitSlop({ top: -SEARCH_HEADER_GESTURE_INSET });
    }

    return gesture;
  }, [routeIndex, routeName, switchTab]);
  const panGesture = useMemo(createPanGesture, [createPanGesture]);
  const leftEdgeGesture = useMemo(createPanGesture, [createPanGesture]);
  const rightEdgeGesture = useMemo(createPanGesture, [createPanGesture]);

  if (routeName === 'map') {
    return (
      <View style={[styles.scene, { backgroundColor: palette.surface }]}>
        {children}
        {routeIndex > 0 ? (
          <GestureDetector gesture={leftEdgeGesture}>
            <View style={[styles.mapEdge, styles.leftEdge]} />
          </GestureDetector>
        ) : null}
        {routeIndex < TAB_ORDER.length - 1 ? (
          <GestureDetector gesture={rightEdgeGesture}>
            <View style={[styles.mapEdge, styles.rightEdge]} />
          </GestureDetector>
        ) : null}
      </View>
    );
  }

  return (
    <GestureDetector gesture={panGesture}>
      <View style={[styles.scene, { backgroundColor: palette.surface }]}>{children}</View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  scene: {
    flex: 1,
  },
  mapEdge: {
    bottom: 0,
    position: 'absolute',
    top: 0,
    width: MAP_EDGE_WIDTH,
    zIndex: 10,
  },
  leftEdge: {
    left: 0,
  },
  rightEdge: {
    right: 0,
  },
});
