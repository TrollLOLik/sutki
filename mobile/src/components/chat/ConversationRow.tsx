import { Ionicons } from '@expo/vector-icons';
import { differenceInDays, format, isToday, isYesterday } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Image } from 'expo-image';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { ComponentMarker } from '@/components/debug/ComponentMarker';
import type { ConversationSummary } from '@/lib/api/chat';
import { formatRooms } from '@/lib/format';
import { useAppTheme } from '@/theme/useAppTheme';

interface ConversationRowProps {
  conversation: ConversationSummary;
  currentUserId?: number;
  isLast?: boolean;
  screenBackground: string;
  dividerColor: string;
  onPress: () => void;
}

function formatRelativeTime(value: string) {
  try {
    const date = new Date(value);
    if (isToday(date)) return format(date, 'HH:mm');
    if (isYesterday(date)) return 'Вчера';
    if (differenceInDays(new Date(), date) < 7) return format(date, 'EEEE', { locale: ru });
    return format(date, 'd MMM', { locale: ru });
  } catch {
    return '';
  }
}

export function ConversationRow({ conversation, currentUserId, isLast = false, screenBackground, dividerColor, onPress }: ConversationRowProps) {
  const { palette } = useAppTheme();
  const hasUnread = conversation.unread_count > 0;
  const hasPreview = Boolean(conversation.last_message_body);
  const isMine = conversation.last_message_sender_id === currentUserId;
  const isRead = Boolean(conversation.other_last_read_message_id && conversation.last_message_id && conversation.last_message_id <= conversation.other_last_read_message_id);
  const name = conversation.other_user_deleted ? 'Удалённый профиль' : `${conversation.other_user_name} ${conversation.other_user_surname}`.trim() || 'Пользователь';

  return (
    <TouchableOpacity activeOpacity={0.62} onPress={onPress} style={styles.touchable}>
      <ComponentMarker kind="surface" name="ConversationRow" />
      <View style={styles.row}>
        <View style={styles.avatarWrap}>
          {conversation.other_user_avatar_url && !conversation.other_user_deleted ? (
            <Image source={{ uri: conversation.other_user_avatar_url }} style={styles.avatar} contentFit="cover" transition={160} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: palette.surfaceMuted }]}>
              <Ionicons name="person-outline" size={23} color={palette.inkMuted} />
            </View>
          )}
          {hasUnread ? <View style={[styles.unreadDot, { borderColor: screenBackground, backgroundColor: palette.primary }]} /> : null}
        </View>
        <View style={[styles.copy, { borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth, borderBottomColor: dividerColor }]}>
          <View style={styles.contentRow}>
            <View style={styles.contentCopy}>
              <View style={styles.titleRow}>
                <Text numberOfLines={1} style={[styles.title, { color: palette.ink }, hasUnread && styles.titleUnread]}>{name}</Text>
                <Text style={[styles.time, { color: hasUnread ? palette.primary : palette.inkMuted }, hasUnread && styles.timeUnread]}>{formatRelativeTime(conversation.last_activity)}</Text>
              </View>
              {conversation.house_id ? (
                <View style={styles.listingRow}>
                  <Ionicons name="home-outline" size={14} color={palette.inkMuted} />
                  <Text numberOfLines={1} style={[styles.listingText, { color: palette.inkMuted }]}>
                    {conversation.house_count_room ? `${formatRooms(conversation.house_count_room)}, ` : ''}
                    {conversation.house_street ?? ''}{conversation.house_number ? `, д. ${conversation.house_number}` : ''}
                  </Text>
                </View>
              ) : null}
              <View style={styles.previewRow}>
                {isMine && hasPreview ? <Ionicons name={isRead ? 'checkmark-done' : 'checkmark'} size={16} color={isRead ? palette.primary : palette.inkMuted} style={styles.readIcon} /> : null}
                <Text numberOfLines={1} style={[styles.preview, { color: hasUnread ? palette.ink : hasPreview ? palette.inkSecondary : palette.inkMuted }, hasUnread ? styles.previewUnread : !hasPreview ? styles.previewEmpty : null]}>
                  {hasPreview ? conversation.last_message_body : 'Начните переписку'}
                </Text>
                {hasUnread ? <View style={[styles.counter, { backgroundColor: palette.primary }]}><Text style={styles.counterText}>{conversation.unread_count > 99 ? '99+' : conversation.unread_count}</Text></View> : null}
              </View>
            </View>
            {conversation.house_id && conversation.house_cover_path ? <Image source={{ uri: conversation.house_cover_path }} style={styles.cover} contentFit="cover" transition={160} /> : null}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  touchable: { paddingLeft: 18 },
  row: { flexDirection: 'row', alignItems: 'center' },
  avatarWrap: { position: 'relative' },
  avatar: { width: 58, height: 58, borderRadius: 29 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  unreadDot: { position: 'absolute', right: -2, top: -2, width: 16, height: 16, borderRadius: 8, borderWidth: 3 },
  copy: { flex: 1, minHeight: 90, marginLeft: 14, paddingVertical: 14, paddingRight: 18 },
  contentRow: { flexDirection: 'row', alignItems: 'center' },
  contentCopy: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  title: { flex: 1, marginRight: 12, fontSize: 17, lineHeight: 24, fontWeight: '700' },
  titleUnread: { fontWeight: '800' },
  time: { fontSize: 12, lineHeight: 20, fontWeight: '500' },
  timeUnread: { fontWeight: '700' },
  listingRow: { marginTop: 4, flexDirection: 'row', alignItems: 'center' },
  listingText: { marginLeft: 6, flex: 1, fontSize: 12, lineHeight: 20 },
  previewRow: { marginTop: 4, flexDirection: 'row', alignItems: 'center' },
  readIcon: { marginRight: 5 },
  preview: { flex: 1, fontSize: 14, lineHeight: 20 },
  previewUnread: { fontWeight: '700' },
  previewEmpty: { fontStyle: 'italic' },
  counter: { marginLeft: 8, minWidth: 22, alignItems: 'center', justifyContent: 'center', borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2 },
  counterText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  cover: { width: 48, height: 48, marginLeft: 12, borderRadius: 12 },
});
