import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/EmptyState';
import { ListingCard } from '@/components/ListingCard';
import { Button } from '@/components/ui';
import { useListingPublication, useMyListings } from '@/lib/api/create-listing';
import { ApiError } from '@/lib/api/client';
import { useAppTheme } from '@/theme/useAppTheme';
import { useActivityScopeSeen } from '@/hooks/useActivityScopeSeen';

export default function MyListingsScreen() {
  useActivityScopeSeen('listings');
  const { palette } = useAppTheme();
  const { data, isLoading, isError, refetch, isRefetching } = useMyListings({ limit: 50 });
  const items = data?.items ?? [];
  const insets = useSafeAreaInsets();
  const publication = useListingPublication();

  const changePublication = (id: number, published: boolean) => {
    const title = published ? 'Опубликовать объявление снова?' : 'Снять объявление с публикации?';
    const message = published
      ? 'Объявление снова появится в поиске.'
      : 'Объявление исчезнет из поиска. Активное продвижение будет приостановлено.';
    Alert.alert(title, message, [
      { text: 'Отмена', style: 'cancel' },
      {
        text: published ? 'Опубликовать' : 'Снять',
        style: published ? 'default' : 'destructive',
        onPress: async () => {
          try {
            await publication.mutateAsync({ id, published });
          } catch (error) {
            Alert.alert('Не удалось изменить статус', error instanceof ApiError ? error.message : 'Попробуйте ещё раз.');
          }
        },
      },
    ]);
  };

  return (
    <View className="flex-1 bg-surface">
      <SafeAreaView edges={['top']} className="flex-1">
        <View className="flex-row items-center px-4 py-2">
          <Pressable
            onPress={() => router.back()}
            accessibilityLabel="Назад"
            className="h-10 w-10 items-center justify-center rounded-full bg-surface-muted">
            <Ionicons name="chevron-back" size={22} color={palette.ink} />
          </Pressable>
          <Text className="flex-1 text-center text-lg font-semibold text-ink">Мои объявления</Text>
          <View className="h-10 w-10" />
        </View>

        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={palette.primary} />
          </View>
        ) : isError ? (
          <View 
            style={{ paddingBottom: insets.bottom > 0 ? insets.bottom : 16 }}
            className="flex-1 justify-center gap-4 px-4"
          >
            <EmptyState
              icon="cloud-offline-outline"
              title="Не удалось загрузить"
              subtitle="Проверьте подключение и попробуйте снова."
            />
            <Button label="Повторить" variant="secondary" onPress={() => refetch()} />
          </View>
        ) : items.length === 0 ? (
          <View 
            style={{ paddingBottom: insets.bottom > 0 ? insets.bottom : 16 }}
            className="flex-1 justify-center gap-4 px-4"
          >
            <EmptyState
              icon="home-outline"
              title="Пока нет объявлений"
              subtitle="Разместите своё первое жильё — это займёт пару минут."
            />
            <Button label="Разместить объявление" onPress={() => router.push('/create')} />
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={{ padding: 16, gap: 12 }}
            refreshControl={
              <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={palette.primary} />
            }
            renderItem={({ item }) => (
              <ListingCard
                listing={item}
                showOwnerStats
                onPress={() =>
                  router.push({ pathname: '/listing/[id]', params: { id: String(item.id) } })
                }
                onPromote={item.status !== 'rejected' && item.status !== 'unpublished'
                  ? () => router.push({pathname:'/listing/[id]/promote' as any,params:{id:String(item.id)}})
                  : undefined}
                onUnpublish={item.status === 'active' ? () => changePublication(item.id, false) : undefined}
                onPublish={item.status === 'unpublished' ? () => changePublication(item.id, true) : undefined}
              />
            )}
          />
        )}
      </SafeAreaView>
    </View>
  );
}
