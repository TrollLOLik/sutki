import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

import { Button } from '@/components/ui';
import { useSessionStore } from '@/store/session';
import { palette } from '@/theme/tokens';

export default function ProfileScreen() {
  const user = useSessionStore((s) => s.user);
  const signOut = useSessionStore((s) => s.signOut);

  return (
    <View className="flex-1 bg-surface px-5 pt-16">
      <View className="items-center gap-3">
        <View className="h-20 w-20 items-center justify-center rounded-full bg-primary-light">
          <Ionicons name="person" size={36} color={palette.primary} />
        </View>
        <View className="items-center">
          <Text className="text-xl font-bold text-ink">{user?.name ?? 'Гость'}</Text>
          {user?.phone ? <Text className="text-base text-ink-secondary">{user.phone}</Text> : null}
        </View>
      </View>

      <View className="mt-auto pb-8">
        <Button label="Выйти" variant="secondary" onPress={signOut} />
      </View>
    </View>
  );
}
