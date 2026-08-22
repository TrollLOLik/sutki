import { useMediaQuery } from './useMediaQuery';

export type ViewWidth = 'mobile' | 'tablet' | 'desktop';
export type PointerType = 'coarse' | 'fine';

export interface AdaptivitySnapshot {
  viewWidth: ViewWidth;
  pointer: PointerType;
  hover: boolean;
  reducedMotion: boolean;
}

export function useAdaptivity(): AdaptivitySnapshot {
  const tablet = useMediaQuery('(min-width: 720px)');
  const desktop = useMediaQuery('(min-width: 1024px)');
  const pointerFine = useMediaQuery('(pointer: fine)');
  const hover = useMediaQuery('(hover: hover)');
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');

  return {
    viewWidth: desktop ? 'desktop' : tablet ? 'tablet' : 'mobile',
    pointer: pointerFine ? 'fine' : 'coarse',
    hover,
    reducedMotion,
  };
}
