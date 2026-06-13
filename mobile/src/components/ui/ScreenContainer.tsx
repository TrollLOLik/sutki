import type { ReactNode } from 'react';
import { View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { cn } from '@/lib/cn';
import { MAX_CONTENT_WIDTH } from '@/theme/tokens';

interface ScreenContainerProps {
  children: ReactNode;
  /** Center content and cap width (auth/profile screens on tablets, TZ §3). */
  centered?: boolean;
  className?: string;
  edges?: Edge[];
}

export function ScreenContainer({
  children,
  centered = false,
  className,
  edges = ['top', 'bottom'],
}: ScreenContainerProps) {
  return (
    <SafeAreaView edges={edges} className="flex-1 bg-surface">
      <View className={cn('flex-1', centered && 'items-center')}>
        <View
          className={cn('flex-1 w-full px-5', className)}
          style={centered ? { maxWidth: MAX_CONTENT_WIDTH } : undefined}>
          {children}
        </View>
      </View>
    </SafeAreaView>
  );
}
