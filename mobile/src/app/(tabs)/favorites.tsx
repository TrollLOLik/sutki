import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/EmptyState';

export default function FavoritesScreen() {
  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-surface">
      <EmptyState
        icon="heart-outline"
        title="В избранном пока пусто"
        subtitle="Сохраняйте понравившиеся квартиры, чтобы вернуться к ним позже."
      />
    </SafeAreaView>
  );
}
