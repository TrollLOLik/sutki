import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/EmptyState';

export default function MessagesScreen() {
  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-surface">
      <EmptyState
        icon="chatbubble-outline"
        title="Сообщений пока нет"
        subtitle="Чат с владельцами появится здесь (Centrifugo по WebSocket, фаза 4)."
      />
    </SafeAreaView>
  );
}
