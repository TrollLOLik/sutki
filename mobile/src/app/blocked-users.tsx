import { Image } from 'expo-image';
import { FlatList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { appAlert } from '@/components/AppAlert';
import { DomainCard } from '@/components/domain/DomainCard';
import {
  AnimatedListItem,
  AppHeader,
  AppIcon,
  AppText,
  EmptyState,
  ListCell,
  LoadErrorState,
  Skeleton,
} from '@/components/ui';
import {
  useBlockedUsers,
  useUnblockUserMutation,
  type BlockedUser,
} from '@/lib/api/abuse';
import { ApiError } from '@/lib/api/client';
import { useAppTheme } from '@/theme/useAppTheme';

function formatBlockedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Заблокирован';
  return `Заблокирован ${new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)}`;
}

function BlockedUserAvatar({ user }: { user: BlockedUser }) {
  const { palette } = useAppTheme();
  return (
    <View
      style={{
        width: 48,
        height: 48,
        borderRadius: 18,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: palette.surfaceMuted,
      }}>
      {user.avatar_url ? (
        <Image source={{ uri: user.avatar_url }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
      ) : (
        <AppText variant="label" tone="primary">
          {user.name?.trim()?.[0]?.toUpperCase() || 'П'}
        </AppText>
      )}
    </View>
  );
}

function BlockedUsersSkeleton() {
  return (
    <View style={{ gap: 12, paddingHorizontal: 16, paddingTop: 16 }}>
      {Array.from({ length: 4 }).map((_, index) => (
        <Skeleton key={index} height={78} radius={22} />
      ))}
    </View>
  );
}

export default function BlockedUsersScreen() {
  const { palette } = useAppTheme();
  const query = useBlockedUsers();
  const unblock = useUnblockUserMutation();

  const confirmUnblock = (user: BlockedUser) => {
    appAlert.alert(
      `Разблокировать ${user.name || 'пользователя'}?`,
      'Пользователь снова сможет писать вам и отправлять новые заявки.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Разблокировать',
          onPress: () => {
            unblock.mutate(user.user_id, {
              onError: (error) => {
                appAlert.alert(
                  'Не удалось разблокировать',
                  error instanceof ApiError ? error.message : 'Попробуйте ещё раз.',
                );
              },
            });
          },
        },
      ],
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: palette.surface }}>
      <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1 }}>
        <AppHeader title="Заблокированные" fallback="/(tabs)/profile" blurred />

        {query.isLoading ? (
          <BlockedUsersSkeleton />
        ) : query.isError ? (
          <LoadErrorState
            title="Не удалось загрузить список"
            loading={query.isRefetching}
            onRetry={() => query.refetch()}
          />
        ) : (
          <FlatList
            data={query.data?.items ?? []}
            keyExtractor={(item) => String(item.user_id)}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ flexGrow: 1, padding: 16, gap: 12 }}
            onRefresh={() => query.refetch()}
            refreshing={query.isRefetching}
            ListHeaderComponent={
              query.data?.items.length ? (
                <AppText variant="body" tone="secondary" style={{ marginBottom: 4 }}>
                  Эти пользователи не могут отправлять вам сообщения и новые заявки.
                </AppText>
              ) : null
            }
            ListEmptyComponent={
              <EmptyState
                icon="shield-checkmark-outline"
                title="Список пуст"
                subtitle="Заблокированные пользователи появятся здесь."
              />
            }
            renderItem={({ item }) => (
              <AnimatedListItem>
                <DomainCard radius={22} style={{ overflow: 'hidden' }}>
                  <ListCell
                    title={item.name || 'Пользователь'}
                    subtitle={formatBlockedAt(item.blocked_at)}
                    multiline
                    disabled={unblock.isPending && unblock.variables === item.user_id}
                    onPress={() => confirmUnblock(item)}
                    before={<BlockedUserAvatar user={item} />}
                    after={<AppIcon name="person-add-outline" size={20} color={palette.primary} />}
                  />
                </DomainCard>
              </AnimatedListItem>
            )}
          />
        )}
      </SafeAreaView>
    </View>
  );
}
