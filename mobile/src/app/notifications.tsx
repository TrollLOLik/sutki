import { Ionicons } from '@expo/vector-icons';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/EmptyState';
import { NavigationBackButton } from '@/components/NavigationBackButton';
import { PersonalListToolbar, type SortOption } from '@/components/PersonalListToolbar';
import { Button, IconButton, MaterialSurface } from '@/components/ui';
import {
  type UserNotification,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from '@/lib/api/activity';
import { useAppTheme } from '@/theme/useAppTheme';
import { CollapsibleHeader, useCollapsibleHeader } from '@/components/CollapsibleHeader';

type NotificationTone = 'primary' | 'info' | 'success' | 'danger' | 'neutral';

type Presentation = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  path?: string;
  tone: NotificationTone;
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

function relativeDate(value: string): string {
  try {
    return formatDistanceToNow(parseISO(value), { addSuffix: true, locale: ru });
  } catch {
    return 'недавно';
  }
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

function NotificationRow({ item, onPress }: { item: UserNotification; onPress: () => void }) {
  const { palette, isDark } = useAppTheme();
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const view = notificationPresentation(item);
  const isUnread = !item.read_at;
  const toneColor =
    view.tone === 'success'
      ? palette.success
      : view.tone === 'danger'
        ? palette.danger
        : view.tone === 'info'
          ? palette.info
          : view.tone === 'neutral'
            ? palette.inkSecondary
            : palette.primary;
  const toneBackground =
    view.tone === 'success'
      ? palette.successLight
      : view.tone === 'danger'
        ? palette.dangerLight
        : view.tone === 'info'
          ? palette.infoLight
          : view.tone === 'neutral'
            ? palette.surfaceMuted
            : palette.primaryLight;
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <MaterialSurface
        level="raised"
        radius={22}
        style={[
          styles.notificationCard,
          isUnread
            ? {
                borderColor: isDark ? 'rgba(255,107,53,0.32)' : 'rgba(255,90,31,0.24)',
              }
            : null,
        ]}>
        <Pressable
          accessibilityLabel={`${view.title}. ${view.body}`}
          accessibilityRole="button"
          onPress={onPress}
          onPressIn={() => {
            scale.value = reduceMotion ? 1 : withTiming(0.978, { duration: 75 });
          }}
          onPressOut={() => {
            scale.value = reduceMotion
              ? 1
              : withSpring(1, { damping: 18, stiffness: 270, mass: 0.55 });
          }}
          style={styles.notificationPressable}>
          <View style={[styles.notificationIcon, { backgroundColor: toneBackground }]}>
            <Ionicons name={view.icon} size={22} color={toneColor} />
          </View>

          <View style={styles.notificationCopy}>
            <View style={styles.notificationTitleRow}>
              <Text
                numberOfLines={2}
                style={[
                  styles.notificationTitle,
                  { color: palette.ink, fontWeight: isUnread ? '800' : '700' },
                ]}>
                {view.title}
              </Text>
              {isUnread ? <View style={[styles.unreadDot, { backgroundColor: palette.primary }]} /> : null}
            </View>
            <Text
              numberOfLines={3}
              style={[styles.notificationBody, { color: palette.inkSecondary }]}>
              {view.body}
            </Text>
            <View style={styles.notificationMeta}>
              <Text style={[styles.notificationDate, { color: palette.inkMuted }]}>
                {relativeDate(item.created_at)}
              </Text>
              {view.path ? <Ionicons name="chevron-forward" size={16} color={palette.inkMuted} /> : null}
            </View>
          </View>
        </Pressable>
      </MaterialSurface>
    </Animated.View>
  );
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
  const allItems = query.data?.items ?? [];
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
    const path = notificationPresentation(item).path;
    if (path) router.push(path as never);
  };

  const hasNotifications = allItems.length > 0;

  return (
    <View style={[styles.screen, { backgroundColor: palette.surface }]}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: palette.surface }}>
        <View style={[styles.header, { borderBottomColor: palette.line }]}>
          <NavigationBackButton fallback="/(tabs)/profile" size={48} variant="material" />
          <View style={styles.headerTitleWrap}>
            <Text style={[styles.headerTitle, { color: palette.ink }]}>Уведомления</Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>
      </SafeAreaView>

      <View style={{ flex: 1 }}>
      <CollapsibleHeader controller={collapsibleHeader} style={{ backgroundColor: palette.surface }}>
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
      </CollapsibleHeader>

      {query.isLoading ? (
        <View style={styles.centeredState}>
          <ActivityIndicator color={palette.primary} />
        </View>
      ) : query.isError ? (
        <View style={styles.errorState}>
          <EmptyState
            icon="cloud-offline-outline"
            title="Не удалось загрузить уведомления"
            subtitle="Проверьте соединение и попробуйте снова."
          />
          <Button label="Повторить" variant="secondary" onPress={() => query.refetch()} />
        </View>
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
            <NotificationRow item={item} onPress={() => openNotification(item)} />
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
  notificationCard: {
    overflow: 'hidden',
  },
  notificationPressable: {
    minHeight: 112,
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 15,
    gap: 13,
  },
  notificationIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  notificationCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  notificationTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  notificationTitle: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
  },
  unreadDot: {
    width: 8,
    height: 8,
    marginTop: 6,
    borderRadius: 4,
    flexShrink: 0,
  },
  notificationBody: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  notificationMeta: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  notificationDate: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
  },
});
