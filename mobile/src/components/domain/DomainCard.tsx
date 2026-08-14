import type { PropsWithChildren } from 'react';
import type { StyleProp, ViewProps, ViewStyle } from 'react-native';

import { MaterialSurface } from '@/components/ui/MaterialSurface';
import {
  PressableScale,
  type PressableScaleProps,
} from '@/components/ui/PressableScale';

export interface DomainCardProps extends ViewProps {
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

/** Shared visual shell for listing-adjacent entities such as bookings and reviews. */
export function DomainCard({
  children,
  radius = 22,
  style,
  ...props
}: PropsWithChildren<DomainCardProps>) {
  return (
    <MaterialSurface level="raised" radius={radius} style={style} {...props}>
      {children}
    </MaterialSurface>
  );
}

/** Consistent, restrained press feedback for tappable regions inside domain cards. */
export function DomainCardPressable({
  pressedScale = 0.985,
  ...props
}: PressableScaleProps) {
  return <PressableScale pressedScale={pressedScale} {...props} />;
}
