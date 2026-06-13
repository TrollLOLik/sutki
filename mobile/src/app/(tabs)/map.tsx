import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/EmptyState';

export default function MapScreen() {
  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-surface">
      <EmptyState
        icon="map-outline"
        title="Карта"
        subtitle="Карта объявлений с кластерами появится здесь (Yandex MapKit, фаза 4)."
      />
    </SafeAreaView>
  );
}
