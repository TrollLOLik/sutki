import { Ionicons } from '@expo/vector-icons';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/EmptyState';
import { PersonalListToolbar, type SortOption } from '@/components/PersonalListToolbar';
import { Button } from '@/components/ui';
import {
  type UserNotification,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from '@/lib/api/activity';
import { useAppTheme } from '@/theme/useAppTheme';
import { goBackOrReplace } from '@/lib/navigation';

type Presentation = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  path?: string;
};

type NotificationSort = 'newest' | 'oldest' | 'unread';
const SORT_OPTIONS: SortOption<NotificationSort>[] = [
  { value: 'newest', label: 'Сначала новые', icon: 'arrow-down-outline' },
  { value: 'oldest', label: 'Сначала старые', icon: 'arrow-up-outline' },
  { value: 'unread', label: 'Сначала непрочитанные', icon: 'mail-unread-outline' },
];

function stringPayload(item: UserNotification, key: string): string {
  const value = item.payload?.[key];
  return typeof value === 'string' ? value : '';
}

function notificationPresentation(item: UserNotification): Presentation {
  const id = item.entity_id;
  if (item.scope === 'messages') {
    const sender = stringPayload(item, 'sender_name') || 'Пользователь';
    return {
      icon: 'chatbubble-outline',
      title: `Новое сообщение от ${sender}`,
      body: stringPayload(item, 'preview') || 'Откройте чат, чтобы прочитать сообщение',
      path: id ? `/chat/${id}` : '/(tabs)/messages',
    };
  }
  if (item.scope === 'incoming') {
    const titles: Record<string, string> = {
      created: 'Новая заявка на бронирование',
      cancelled: 'Гость отменил заявку',
      confirmed: 'Заявка подтверждена',
      rejected: 'Заявка отклонена',
    };
    return { icon: 'file-tray-full-outline', title: titles[item.action] ?? 'Заявка обновлена', body: 'Проверьте детали заявки', path: id ? `/incoming/${id}` : '/incoming' };
  }
  if (item.scope === 'bookings') {
    const titles: Record<string, string> = {
      confirmed: 'Ваша заявка подтверждена',
      rejected: 'Ваша заявка отклонена',
      cancelled: 'Заявка отменена',
      verified: 'Заявка привязана к аккаунту',
    };
    return { icon: 'calendar-outline', title: titles[item.action] ?? 'Статус заявки изменился', body: 'Откройте заявку, чтобы посмотреть подробности', path: id ? `/bookings/${id}` : '/bookings' };
  }
  if (item.scope === 'listings') {
    const status = stringPayload(item, 'status');
    const reason = stringPayload(item, 'reason');
    if (status === 'active') {
      return { icon: 'checkmark-circle-outline', title: 'Объявление опубликовано', body: 'Оно доступно гостям в поиске', path: id ? `/listing/${id}` : '/my-listings' };
    }
    if (status === 'rejected') {
      return { icon: 'close-circle-outline', title: 'Объявление не прошло проверку', body: reason || 'Исправьте объявление и отправьте его повторно', path: id ? `/listing/${id}` : '/my-listings' };
    }
    return { icon: 'time-outline', title: 'Статус объявления изменился', body: status === 'moderation_review' ? 'Объявление ожидает дополнительной проверки' : 'Откройте объявление для подробностей', path: id ? `/listing/${id}` : '/my-listings' };
  }
  if (item.scope === 'reviews') {
    const status = stringPayload(item, 'status');
    const reason = stringPayload(item, 'reason');
    const targetType = stringPayload(item, 'target_type');
    if (item.action === 'received') {
      return { icon: 'star-outline', title: 'Вам оставили отзыв', body: 'Новый отзыв опубликован в вашем профиле', path: '/my-reviews' };
    }
    if (item.action === 'reply_published') {
      return { icon: 'chatbox-outline', title: 'Владелец ответил на ваш отзыв', body: 'Ответ опубликован и доступен в отзывах', path: '/my-reviews' };
    }
    if (status === 'active') {
      return { icon: 'checkmark-circle-outline', title: targetType === 'reply' ? 'Ответ на отзыв опубликован' : 'Ваш отзыв опубликован', body: 'Текст успешно прошёл проверку', path: '/my-reviews' };
    }
    if (status === 'rejected') {
      return { icon: 'close-circle-outline', title: targetType === 'reply' ? 'Ответ не прошёл проверку' : 'Отзыв не прошёл проверку', body: reason || 'Текст нарушает правила публикации', path: '/my-reviews' };
    }
    return { icon: 'time-outline', title: 'Отзыв ожидает проверки', body: 'Мы сообщим, когда проверка завершится', path: '/my-reviews' };
  }
  return { icon: 'notifications-outline', title: 'Новое уведомление', body: 'Откройте раздел, чтобы посмотреть подробности' };
}

function relativeDate(value: string): string {
  try {
    return formatDistanceToNow(parseISO(value), { addSuffix: true, locale: ru });
  } catch {
    return 'недавно';
  }
}

export default function NotificationsScreen() {
  const { palette } = useAppTheme();
  const query = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<NotificationSort>('newest');
  const [sortVisible, setSortVisible] = useState(false);
  const allItems = query.data?.items ?? [];
  const unread = allItems.filter((item) => !item.read_at).length;
  const items = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase('ru');
    return allItems
      .filter((item) => {
        if (!needle) return true;
        const view = notificationPresentation(item);
        return `${view.title} ${view.body}`.toLocaleLowerCase('ru').includes(needle);
      })
      .sort((a, b) => {
        if (sort === 'oldest') return a.id - b.id;
        if (sort === 'unread') return Number(!!a.read_at) - Number(!!b.read_at) || b.id - a.id;
        return b.id - a.id;
      });
  }, [allItems, search, sort]);

  const openNotification = (item: UserNotification) => {
    if (!item.read_at) markRead.mutate(item.id);
    const path = notificationPresentation(item).path;
    if (path) router.push(path as never);
  };

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top']}>
      <View className="h-14 flex-row items-center border-b border-line px-4">
        <Pressable onPress={() => goBackOrReplace('/(tabs)/profile')} className="h-10 w-10 items-center justify-center rounded-full active:bg-surface-muted">
          <Ionicons name="chevron-back" size={24} color={palette.ink} />
        </Pressable>
        <Text className="flex-1 text-center text-lg font-bold text-ink">Уведомления</Text>
        <View className="w-10" />
      </View>

      <PersonalListToolbar
        query={search}
        onQueryChange={setSearch}
        placeholder="Поиск по уведомлениям"
        sort={sort}
        sortOptions={SORT_OPTIONS}
        sortVisible={sortVisible}
        onSortVisibleChange={setSortVisible}
        onSortChange={setSort}
      />

      {allItems.length > 0 ? (
        <View className="flex-row items-center justify-between border-b border-line px-4 py-3">
          <Text className="text-sm text-ink-secondary">{unread > 0 ? `${unread} непрочитанных` : 'Всё прочитано'}</Text>
          {unread > 0 ? (
            <Pressable onPress={() => markAllRead.mutate()} disabled={markAllRead.isPending}>
              <Text className="text-sm font-bold text-primary">Прочитать все</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {query.isLoading ? (
        <View className="flex-1 items-center justify-center"><ActivityIndicator color={palette.primary} /></View>
      ) : query.isError ? (
        <View className="flex-1 justify-center gap-4 px-6">
          <EmptyState icon="cloud-offline-outline" title="Не удалось загрузить уведомления" subtitle="Проверьте соединение и попробуйте снова." />
          <Button label="Повторить" variant="secondary" onPress={() => query.refetch()} />
        </View>
      ) : allItems.length === 0 ? (
        <EmptyState icon="notifications-outline" title="Уведомлений пока нет" subtitle="Здесь появятся сообщения о заявках, объявлениях, чатах и отзывах." />
      ) : items.length === 0 ? (
        <EmptyState icon="search-outline" title="Ничего не найдено" subtitle="Попробуйте изменить поисковый запрос." />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 10 }}
          refreshing={query.isRefetching}
          onRefresh={() => query.refetch()}
          renderItem={({ item }) => {
            const view = notificationPresentation(item);
            const isUnread = !item.read_at;
            return (
              <Pressable
                onPress={() => openNotification(item)}
                className="flex-row gap-3 rounded-card border p-4 active:opacity-80"
                style={{ borderColor: isUnread ? palette.primary : palette.line, backgroundColor: isUnread ? palette.primaryLight : palette.surface }}>
                <View className="h-11 w-11 items-center justify-center rounded-field bg-surface">
                  <Ionicons name={view.icon} size={22} color={palette.primary} />
                </View>
                <View className="flex-1 gap-1">
                  <View className="flex-row items-start gap-2">
                    <Text className="flex-1 text-sm font-bold text-ink">{view.title}</Text>
                    {isUnread ? <View className="mt-1 h-2 w-2 rounded-full bg-primary" /> : null}
                  </View>
                  <Text className="text-sm leading-5 text-ink-secondary" numberOfLines={3}>{view.body}</Text>
                  <Text className="mt-1 text-xs text-ink-muted">{relativeDate(item.created_at)}</Text>
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}
