import { useCallback } from 'react';
import { useFocusEffect } from 'expo-router';

import { type ActivityScope, useMarkActivityRead } from '@/lib/api/activity';

export function useActivityScopeSeen(scope: ActivityScope) {
  const { mutate } = useMarkActivityRead();
  useFocusEffect(
    useCallback(() => {
      mutate(scope);
    }, [mutate, scope]),
  );
}
