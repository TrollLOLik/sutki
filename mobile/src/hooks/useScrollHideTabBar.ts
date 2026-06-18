import { useRef } from 'react';
import { useTabBarStore } from '@/store/tabbar';

export function useScrollHideTabBar() {
  const lastOffset = useRef(0);

  const handleScroll = (event: any) => {
    const currentOffset = event.nativeEvent.contentOffset.y;

    // Always show tab bar at the very top of the scroll list
    if (currentOffset <= 10) {
      if (!useTabBarStore.getState().visible) {
        useTabBarStore.getState().setVisible(true);
      }
      return;
    }

    const direction = currentOffset > lastOffset.current ? 'down' : 'up';
    lastOffset.current = currentOffset;

    if (direction === 'down' && useTabBarStore.getState().visible) {
      useTabBarStore.getState().setVisible(false);
    } else if (direction === 'up' && !useTabBarStore.getState().visible) {
      useTabBarStore.getState().setVisible(true);
    }
  };

  return handleScroll;
}
