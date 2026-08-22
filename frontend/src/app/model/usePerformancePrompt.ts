import { useCallback, useEffect, useState } from 'react';
import { readMotionPreference, setMotionPreference } from '@shared/lib/theme';

export function usePerformancePrompt() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (readMotionPreference() === 'reduced') return undefined;
    let animationFrame = 0;
    let sampleStartedAt = performance.now();
    let frames = 0;
    let slowSamples = 0;
    const warmupUntil = sampleStartedAt + 6000;
    const monitoringUntil = sampleStartedAt + 16000;

    const resetSample = (now: number) => {
      sampleStartedAt = now;
      frames = 0;
    };

    const measure = (now: number) => {
      if (document.documentElement.dataset.motion === 'reduced' || now >= monitoringUntil) return;
      if (document.hidden) {
        slowSamples = 0;
        resetSample(now);
        animationFrame = window.requestAnimationFrame(measure);
        return;
      }

      frames += 1;
      const elapsed = now - sampleStartedAt;
      if (elapsed >= 4000) {
        const fps = frames * 1000 / elapsed;
        slowSamples = now >= warmupUntil && fps < 44 ? slowSamples + 1 : 0;
        resetSample(now);
        if (slowSamples >= 2) {
          setOpen(true);
          return;
        }
      }
      animationFrame = window.requestAnimationFrame(measure);
    };

    animationFrame = window.requestAnimationFrame(measure);
    return () => window.cancelAnimationFrame(animationFrame);
  }, []);

  const dismiss = useCallback(() => setOpen(false), []);
  const disableMotion = useCallback(() => {
    setMotionPreference('reduced');
    setOpen(false);
  }, []);

  return { open, dismiss, disableMotion };
}
