import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import BrandLogo from '@/assets/images/brand-logo-dark.png';
import { ComponentMarker } from '@/components/debug/ComponentMarker';

const LOGO_WIDTH = 236;
const LOGO_HEIGHT = 55;
const MARK_WIDTH = 49;
const MARK_OFFSET = (LOGO_WIDTH - MARK_WIDTH) / 2;

const MARK_PATH =
  'M67.7396 166.669L2.79732 6.88261C1.46098 3.59465 3.88021 0 7.42936 0H94.3987C97.4506 0 100.505 0.400872 103.387 1.40491C146.182 16.3143 141.777 52.0822 132.77 71.4931C131.798 73.587 132.231 76.1039 133.877 77.723C166.576 109.9 147.937 136.577 130.141 149.166C126.203 151.952 121.696 153.761 117.116 155.274L73.9397 169.534C71.441 170.359 68.7303 169.106 67.7396 166.669Z';
const PIN_PATH =
  'M52.8334 81L77.5149 136.17C77.8517 136.923 78.904 136.968 79.3029 136.246L107.075 85.9915C108.898 82.6934 110.181 79.0806 110.305 75.3144C111.165 49.1538 92.1237 41.8118 81.8334 41.5C51.3334 43 49.1668 69.1667 52.8334 81Z';

function BrandMark() {
  return (
    <View style={styles.mark}>
      <View>
        <Svg width={MARK_WIDTH} height={LOGO_HEIGHT} viewBox="0 0 152 171">
          <Defs>
            <LinearGradient id="launch-mark" x1="76" y1="0" x2="76" y2="171">
              <Stop offset="0" stopColor="#FB501C" />
              <Stop offset="1" stopColor="#FF9553" />
            </LinearGradient>
          </Defs>
          <Path d={MARK_PATH} fill="url(#launch-mark)" />
        </Svg>
      </View>
      <View style={styles.pinLayer}>
        <Svg width={MARK_WIDTH} height={LOGO_HEIGHT} viewBox="0 0 152 171">
          <Path d={PIN_PATH} fill="#FFFFFF" />
        </Svg>
      </View>
    </View>
  );
}

export function AppLaunchSplash({
  playing,
  onFinished,
}: {
  playing: boolean;
  onFinished: () => void;
}) {
  const [screenOpacity] = useState(() => new Animated.Value(1));
  const [standaloneMarkOpacity] = useState(() => new Animated.Value(1));
  const [standaloneMarkTranslateX] = useState(() => new Animated.Value(0));
  const [fullLogoOpacity] = useState(() => new Animated.Value(0));
  const [revealTranslateX] = useState(() => new Animated.Value(MARK_OFFSET));

  useEffect(() => {
    if (!playing) return;

    let cancelled = false;

    const finish = ({ finished }: { finished: boolean }) => {
      if (finished && !cancelled) onFinished();
    };

    const playReducedMotion = () => {
      standaloneMarkOpacity.setValue(0);
      fullLogoOpacity.setValue(1);
      revealTranslateX.setValue(0);
      Animated.sequence([
        Animated.delay(180),
        Animated.timing(screenOpacity, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start(finish);
    };

    const playBrandSequence = () => {
      Animated.sequence([
        Animated.delay(150),
        Animated.parallel([
          Animated.timing(standaloneMarkTranslateX, {
            toValue: -MARK_OFFSET,
            duration: 360,
            easing: Easing.inOut(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.delay(70),
            Animated.timing(standaloneMarkOpacity, {
              toValue: 0,
              duration: 150,
              useNativeDriver: true,
            }),
          ]),
          Animated.timing(fullLogoOpacity, {
            toValue: 1,
            duration: 220,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(revealTranslateX, {
            toValue: 0,
            duration: 360,
            easing: Easing.inOut(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
        Animated.delay(170),
        Animated.timing(screenOpacity, {
          toValue: 0,
          duration: 270,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(finish);
    };

    void AccessibilityInfo.isReduceMotionEnabled()
      .then((reduceMotion) => {
        if (cancelled) return;
        if (reduceMotion) playReducedMotion();
        else playBrandSequence();
      })
      .catch(() => {
        if (!cancelled) playBrandSequence();
      });

    return () => {
      cancelled = true;
      screenOpacity.stopAnimation();
      standaloneMarkOpacity.stopAnimation();
      standaloneMarkTranslateX.stopAnimation();
      fullLogoOpacity.stopAnimation();
      revealTranslateX.stopAnimation();
    };
  }, [
    fullLogoOpacity,
    onFinished,
    playing,
    revealTranslateX,
    screenOpacity,
    standaloneMarkOpacity,
    standaloneMarkTranslateX,
  ]);

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.screen, { opacity: screenOpacity }]}>
      <ComponentMarker kind="state" name="AppLaunchSplash" />
      <View style={styles.stage}>
        <Animated.View
          style={[
            styles.standaloneMark,
            {
              opacity: standaloneMarkOpacity,
              transform: [{ translateX: standaloneMarkTranslateX }],
            },
          ]}>
          <BrandMark />
        </Animated.View>

        <Animated.View
          style={[
            styles.logoReveal,
            {
              opacity: fullLogoOpacity,
              transform: [{ translateX: revealTranslateX }],
            },
          ]}>
          <Animated.Image source={BrandLogo} resizeMode="contain" style={styles.fullLogo} />
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#15171B',
  },
  stage: {
    width: LOGO_WIDTH,
    height: LOGO_HEIGHT,
  },
  standaloneMark: {
    position: 'absolute',
    left: MARK_OFFSET,
    top: 0,
    width: MARK_WIDTH,
    height: LOGO_HEIGHT,
  },
  mark: {
    width: MARK_WIDTH,
    height: LOGO_HEIGHT,
  },
  pinLayer: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  logoReveal: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: LOGO_WIDTH,
    height: LOGO_HEIGHT,
    overflow: 'hidden',
  },
  fullLogo: {
    width: LOGO_WIDTH,
    height: LOGO_HEIGHT,
  },
});
