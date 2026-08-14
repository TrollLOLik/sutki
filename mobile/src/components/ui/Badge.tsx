import { useEffect } from 'react';
import Animated, {
  Easing,
  FadeInDown,
  FadeOutUp,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { AppText } from '@/components/ui/AppText';
import { cn } from '@/lib/cn';
import { useAppTheme } from '@/theme/useAppTheme';

type Tone = 'success' | 'info' | 'neutral' | 'primary';

const tones: Record<Tone, { bg: string; text: string }> = {
  success: { bg: 'bg-success', text: 'text-white' },
  info: { bg: 'bg-info', text: 'text-white' },
  primary: { bg: 'bg-primary', text: 'text-white' },
  neutral: { bg: 'bg-surface-muted', text: 'text-ink-secondary' },
};

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  const t = tones[tone];
  const { palette } = useAppTheme();
  const reduceMotion = useReducedMotion();
  const toneProgress = useSharedValue(
    tone === 'primary' ? 1 : tone === 'info' ? 2 : tone === 'success' ? 3 : 0,
  );

  useEffect(() => {
    const target = tone === 'primary' ? 1 : tone === 'info' ? 2 : tone === 'success' ? 3 : 0;
    toneProgress.value = reduceMotion
      ? target
      : withTiming(target, { duration: 180, easing: Easing.out(Easing.cubic) });
  }, [reduceMotion, tone, toneProgress]);

  const backgroundStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      toneProgress.value,
      [0, 1, 2, 3],
      [palette.surfaceMuted, palette.primary, palette.info, palette.success],
    ),
  }));

  return (
    <Animated.View
      className={cn('max-w-full self-start overflow-hidden rounded-pill px-2.5 py-1', t.bg)}
      style={backgroundStyle}>
      <Animated.View
        key={label}
        entering={reduceMotion ? undefined : FadeInDown.duration(145)}
        exiting={reduceMotion ? undefined : FadeOutUp.duration(105)}>
        <AppText
          variant="caption"
          tone={tone === 'neutral' ? 'secondary' : 'inverse'}
          numberOfLines={1}
          ellipsizeMode="tail"
          className={cn('shrink text-xs font-semibold', t.text)}>
          {label}
        </AppText>
      </Animated.View>
    </Animated.View>
  );
}
