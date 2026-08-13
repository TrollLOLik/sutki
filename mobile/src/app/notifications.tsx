import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { NotificationListSkeleton } from '@/components/DomainListSkeletons';
import { NotificationCard, type NotificationPresentation } from '@/components/notifications/NotificationCard';
import { PersonalListToolbar, type SortOption } from '@/components/PersonalListToolbar';
import { AppHeader, EmptyState, IconButton, LoadErrorState, MaterialSurface } from '@/components/ui';
import {
  type UserNotification,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from '@/lib/api/activity';
import { useAppTheme } from '@/theme/useAppTheme';
import { CollapsibleHeader, useCollapsibleHeader } from '@/components/CollapsibleHeader';

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

function reviewNotificationTab(item: UserNotification): 'written' | 'received' {
  const targetType = stringPayload(item, 'target_type');
  if (item.action === 'received') return 'received';
  if (item.action === 'reply_published') return 'written';
  return targetType === 'reply' ? 'received' : 'written';
}

function notificationPresentation(item: UserNotification): NotificationPresentation {
  const id = item.entity_id;
  if (item.scope === 'messages') {
    const sender = stringPayload(item, 'sender_name') || 'Пользователь';
    return {
      icon: 'chatbubble-outline',
      title: `Новое сообщение от ${sender}`,
      body: stringPayload(item, 'preview') || 'Откройте чат, чтобы прочитать сообщение',
      path: id ? `/chat/${id}` : '/(tabs)/messages',
      tone: 'info',
    };
  }
  if (item.scope === 'incoming') {
    const titles: Record<string, string> = {
      created: 'Новая заявка на бронирование',
      cancelled: 'Гость отменил заявку',
      confirmed: 'Заявка подтверждена',
      rejected: 'Заявка отклонена',
    };
    return {
      icon: 'file-tray-full-outline',
      title: titles[item.action] ?? 'Заявка обновлена',
      body: 'Проверьте детали заявки',
      path: id ? `/incoming/${id}` : '/incoming',
      tone: item.action === 'rejected' || item.action === 'cancelled' ? 'danger' : 'primary',
    };
  }
  if (item.scope === 'bookings') {
    const titles: Record<string, string> = {
      confirmed: 'Ваша заявка подтверждена',
      rejected: 'Ваша заявка отклонена',
      cancelled: 'Заявка отменена',
      verified: 'Заявка привязана к аккаунту',
    };
    return {
      icon: 'calendar-outline',
      title: titles[item.action] ?? 'Статус заявки изменился',
      body: 'Откройте заявку, чтобы посмотреть подробности',
      path: id ? `/bookings/${id}` : '/bookings',
      tone:
        item.action === 'confirmed' || item.action === 'verified'
          ? 'success'
          : item.action === 'rejected' || item.action === 'cancelled'
            ? 'danger'
            : 'primary',
    };
  }
  if (item.scope === 'listings') {
    const status = stringPayload(item, 'status');
    const reason = stringPayload(item, 'reason');
    if (status === 'active') {
      return {
        icon: 'checkmark-circle-outline',
        title: 'Объявление опубликовано',
        body: 'Оно доступно гостям в поиске',
        path: id ? `/listing/${id}` : '/my-listings',
        tone: 'success',
      };
    }
    if (status === 'rejected') {
      return {
        icon: 'close-circle-outline',
        title: 'Объявление не прошло проверку',
        body: reason || 'Исправьте объявление и отправьте его повторно',
        path: id ? `/listing/${id}` : '/my-listings',
        tone: 'danger',
      };
    }
    return {
      icon: 'time-outline',
      title: 'Статус объявления изменился',
      body:
        status === 'moderation_review'
          ? 'Объявление ожидает дополнительной проверки'
          : 'Откройте объявление для подробностей',
      path: id ? `/listing/${id}` : '/my-listings',
      tone: 'primary',
    };
  }
  if (item.scope === 'reviews') {
    const status = stringPayload(item, 'status');
    const reason = stringPayload(item, 'reason');
    const targetType = stringPayload(item, 'target_type');
    if (item.action === 'received') {
      return {
        icon: 'star-outline',
        title: 'Вам оставили отзыв',
        body: 'Новый отзыв опубликован в вашем профиле',
        path: '/my-reviews',
        tone: 'primary',
      };
    }
    if (item.action === 'reply_published') {
      return {
        icon: 'chatbox-outline',
        title: 'Владелец ответил на ваш отзыв',
        body: 'Ответ опубликован и доступен в отзывах',
        path: '/my-reviews',
        tone: 'info',
      };
    }
    if (status === 'active') {
      return {
        icon: 'checkmark-circle-outline',
        title: targetType === 'reply' ? 'Ответ на отзыв опубликован' : 'Ваш отзыв опубликован',
        body: 'Текст успешно прошёл проверку',
        path: '/my-reviews',
        tone: 'success',
      };
    }
    if (status === 'rejected') {
      return {
        icon: 'close-circle-outline',
        title: targetType === 'reply' ? 'Ответ не прошёл проверку' : 'Отзыв не прошёл проверку',
        body: reason || 'Текст нарушает правила публикации',
        path: '/my-reviews',
        tone: 'danger',
      };
    }
    return {
      icon: 'time-outline',
      title: 'Отзыв ожидает проверки',
      body: 'Мы сообщим, когда проверка завершится',
      path: '/my-reviews',
      tone: 'primary',
    };
  }
  return {
    icon: 'notifications-outline',
    title: 'Новое уведомление',
    body: 'Откройте раздел, чтобы посмотреть подробности',
    tone: 'neutral',
  };
}

function unreadLabel(count: number): string {
  const lastTwo = count % 100;
  const last = count % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return `${count} непрочитанных`;
  if (last === 1) return `${count} непрочитанное`;
  if (last >= 2 && last <= 4) return `${count} непрочитанных`;
  return `${count} непрочитанных`;
}

function eventsLabel(count: number): string {
  const lastTwo = count % 100;
  const last = count % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return `${count} событий`;
  if (last === 1) return `${count} событие`;
  if (last >= 2 && last <= 4) return `${count} события`;
  return `${count} событий`;
}

function NotificationSummary({
  loading,
  onMarkAllRead,
  total,
  unread,
}: {
  loading: boolean;
  onMarkAllRead: () => void;
  total: number;
  unread: number;
}) {
  const { palette } = useAppTheme();
  const allRead = unread === 0;

  return (
    <MaterialSurface level="raised" radius={24} style={styles.summaryCard}>
      <View
        style={[
          styles.summaryIcon,
          { backgroundColor: allRead ? palette.successLight : palette.primaryLight },
        ]}>
        <Ionicons
          name={allRead ? 'checkmark-done-outline' : 'notifications-outline'}
          size={24}
          color={allRead ? palette.success : palette.primary}
        />
      </View>
      <View style={styles.summaryCopy}>
        <Text style={[styles.summaryTitle, { color: palette.ink }]}>
          {allRead ? 'Всё просмотрено' : unreadLabel(unread)}
        </Text>
        <Text numberOfLines={2} style={[styles.summarySubtitle, { color: palette.inkSecondary }]}>
          {allRead
            ? `${eventsLabel(total)} в центре уведомлений`
            : 'Важные изменения собраны в одном месте'}
        </Text>
      </View>
      {!allRead ? (
        <IconButton
          accessibilityLabel="Прочитать все уведомления"
          disabled={loading}
          icon="checkmark-done-outline"
          iconSize={21}
          onPress={onMarkAllRead}
          selected
          size={44}
          tone="primary"
        />
      ) : null}
    </MaterialSurface>
  );
}

export default function NotificationsScreen() {
  const collapsibleHeader = useCollapsibleHeader();
  const { palette } = useAppTheme();
  const query = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<NotificationSort>('newest');
  const [sortVisible, setSortVisible] = useState(false);
  const allItems = useMemo(() => query.data?.items ?? [], [query.data?.items]);
  const unread = allItems.filter((item) => !item.read_at).length;
  const items = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase('ru');
    return [...allItems]
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
    if (item.scope === 'reviews' && item.entity_id) {
      router.push({
        pathname: '/my-reviews',
        params: {
          focusReviewId: String(item.entity_id),
          focusTab: reviewNotificationTab(item),
          notificationId: String(item.id),
        },
      });
      return;
    }
    const path = notificationPresentation(item).path;
    if (path) router.push(path as never);
  };

  const hasNotifications = allItems.length > 0;

  return (
    <View style={[styles.screen, { backgroundColor: palette.surface }]}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: palette.surface }}>
        <AppHeader fallback="/(tabs)/profile" title="Уведомления" />
      </SafeAreaView>

      <View style={{ flex: 1, overflow: 'hidden' }}>
      <CollapsibleHeader controller={collapsibleHeader} style={{ backgroundColor: palette.surface }}>
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

      {hasNotifications ? (
        <View style={styles.summaryWrap}>
          <NotificationSummary
            loading={markAllRead.isPending}
            onMarkAllRead={() => markAllRead.mutate()}
            total={allItems.length}
            unread={unread}
          />
        </View>
      ) : null}

      </CollapsibleHeader>

      {query.isLoading ? (
        <NotificationListSkeleton />
      ) : query.isError ? (
        <LoadErrorState title="Не удалось загрузить уведомления" onRetry={() => query.refetch()} />
      ) : !hasNotifications ? (
        <EmptyState
          icon="notifications-outline"
          title="Уведомлений пока нет"
          subtitle="Здесь появятся сообщения о заявках, объявлениях, чатах и отзывах."
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon="search-outline"
          title="Ничего не найдено"
          subtitle="Попробуйте изменить поисковый запрос."
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          onScroll={collapsibleHeader.onScroll}
          onScrollBeginDrag={collapsibleHeader.onScrollBeginDrag}
          onScrollEndDrag={collapsibleHeader.onScrollEndDrag}
          scrollEventThrottle={16}
          contentContainerStyle={[styles.listContent, { paddingTop: collapsibleHeader.height + 4 }]}
          refreshing={query.isRefetching}
          onRefresh={() => query.refetch()}
          ListHeaderComponent={
            <View style={styles.listHeader}>
              <Text style={[styles.listTitle, { color: palette.ink }]}>Последние события</Text>
              <Text style={[styles.listCount, { color: palette.inkMuted }]}>{items.length}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <NotificationCard
              presentation={notificationPresentation(item)}
              createdAt={item.created_at}
              unread={!item.read_at}
              onPress={() => openNotification(item)}
            />
          )}
        />
      )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    height: 70,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitleWrap: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  headerTitle: {
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '800',
  },
  headerSpacer: {
    width: 48,
    height: 48,
  },
  summaryWrap: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  summaryCard: {
    minHeight: 86,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    gap: 12,
  },
  summaryIcon: {
    width: 50,
    height: 50,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  summaryTitle: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '800',
  },
  summarySubtitle: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
  },
  centeredState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorState: {
    flex: 1,
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 40,
    gap: 10,
  },
  listHeader: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 3,
  },
  listTitle: {
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '800',
  },
  listCount: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
});
