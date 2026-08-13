import { Ionicons } from '@expo/vector-icons';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { ComponentMarker } from '@/components/debug/ComponentMarker';
import { MaterialSurface } from '@/components/ui';
import { useAppTheme } from '@/theme/useAppTheme';

export type NotificationTone = 'primary' | 'info' | 'success' | 'danger' | 'neutral';

export interface NotificationPresentation {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  path?: string;
  tone: NotificationTone;
}

interface NotificationCardProps {
  presentation: NotificationPresentation;
  createdAt: string;
  unread?: boolean;
  onPress: () => void;
}

function relativeDate(value: string) {
  try {
    return formatDistanceToNow(parseISO(value), { addSuffix: true, locale: ru });
  } catch {
    return 'недавно';
  }
}

export function NotificationCard({ presentation, createdAt, unread = false, onPress }: NotificationCardProps) {
  const { palette, isDark } = useAppTheme();
  const [scale] = useState(() => new Animated.Value(1));
  const toneColor = presentation.tone === 'success'
    ? palette.success
    : presentation.tone === 'danger'
      ? palette.danger
      : presentation.tone === 'info'
        ? palette.info
        : presentation.tone === 'neutral'
          ? palette.inkSecondary
          : palette.primary;
  const toneBackground = presentation.tone === 'success'
    ? palette.successLight
    : presentation.tone === 'danger'
      ? palette.dangerLight
      : presentation.tone === 'info'
        ? palette.infoLight
        : presentation.tone === 'neutral'
          ? palette.surfaceMuted
          : palette.primaryLight;
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <ComponentMarker kind="surface" name="NotificationCard" />
      <MaterialSurface
        level="raised"
        radius={22}
        style={[
          styles.card,
          unread ? { borderColor: isDark ? 'rgba(255,107,53,0.32)' : 'rgba(255,90,31,0.24)' } : null,
        ]}>
        <Pressable
          accessibilityLabel={`${presentation.title}. ${presentation.body}`}
          accessibilityRole="button"
          onPress={onPress}
          onPressIn={() => {
            Animated.timing(scale, { toValue: 0.978, duration: 75, useNativeDriver: true }).start();
          }}
          onPressOut={() => {
            Animated.spring(scale, {
              toValue: 1,
              damping: 18,
              stiffness: 270,
              mass: 0.55,
              useNativeDriver: true,
            }).start();
          }}
          style={styles.pressable}>
          <View style={[styles.icon, { backgroundColor: toneBackground }]}>
            <Ionicons name={presentation.icon} size={22} color={toneColor} />
          </View>
          <View style={styles.copy}>
            <View style={styles.titleRow}>
              <Text numberOfLines={2} style={[styles.title, { color: palette.ink, fontWeight: unread ? '800' : '700' }]}>{presentation.title}</Text>
              {unread ? <View style={[styles.unreadDot, { backgroundColor: palette.primary }]} /> : null}
            </View>
            <Text numberOfLines={3} style={[styles.body, { color: palette.inkSecondary }]}>{presentation.body}</Text>
            <View style={styles.meta}>
              <Text style={[styles.date, { color: palette.inkMuted }]}>{relativeDate(createdAt)}</Text>
              {presentation.path ? <Ionicons name="chevron-forward" size={16} color={palette.inkMuted} /> : null}
            </View>
          </View>
        </Pressable>
      </MaterialSurface>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { overflow: 'hidden' },
  pressable: { minHeight: 112, flexDirection: 'row', alignItems: 'flex-start', gap: 13, padding: 15 },
  icon: { width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  title: { flex: 1, fontSize: 15, lineHeight: 20 },
  unreadDot: { width: 8, height: 8, marginTop: 6, borderRadius: 4 },
  body: { marginTop: 5, fontSize: 13, lineHeight: 18 },
  meta: { marginTop: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  date: { fontSize: 11, lineHeight: 15, fontWeight: '600' },
});
