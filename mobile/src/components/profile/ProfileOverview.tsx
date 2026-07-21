import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type ViewStyle,
} from 'react-native';

import { MaterialSurface } from '@/components/ui/MaterialSurface';
import { useAppTheme } from '@/theme/useAppTheme';

export interface ProfileMetric {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string | number;
  loading?: boolean;
  tone?: 'primary' | 'success' | 'neutral';
}

export interface ProfileActionItem {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
  count?: number;
  disabled?: boolean;
  tone?: 'primary' | 'danger';
}

interface ProfileHeroProps {
  avatarUri?: string | null;
  badge?: string;
  city?: string | null;
  initials: string;
  name: string;
  onAvatarPress?: () => void;
  onRatingPress?: () => void;
  rating?: number;
  reviewsCount?: number;
  subtitle?: string;
  uploadingAvatar?: boolean;
  verifiedLabel?: string;
}

export function ProfileHero({
  avatarUri,
  badge = 'Дом рядом',
  city,
  initials,
  name,
  onAvatarPress,
  onRatingPress,
  rating = 0,
  reviewsCount = 0,
  subtitle,
  uploadingAvatar = false,
  verifiedLabel,
}: ProfileHeroProps) {
  const { palette, isDark } = useAppTheme();
  const AvatarWrapper = onAvatarPress ? TouchableOpacity : View;

  return (
    <MaterialSurface
      level="raised"
      radius={26}
      style={[styles.hero, { shadowColor: isDark ? '#000000' : '#16181D' }]}>
      <View style={styles.heroContent}>
        <AvatarWrapper
          {...(onAvatarPress
            ? {
                accessibilityLabel: 'Изменить фото профиля',
                accessibilityRole: 'button' as const,
                activeOpacity: 0.78,
                disabled: uploadingAvatar,
                onPress: onAvatarPress,
              }
            : {})}
          style={styles.avatarOuter}>
          <View
            style={[
              styles.avatarRing,
              {
                backgroundColor: palette.surface,
                borderColor: palette.primary,
              },
            ]}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatar} contentFit="cover" transition={160} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: palette.primaryLight }]}>
                <Text style={[styles.initials, { color: palette.primary }]}>{initials}</Text>
              </View>
            )}
          </View>

          {onAvatarPress ? (
            <View
              style={[
                styles.avatarAction,
                {
                  backgroundColor: palette.primary,
                  borderColor: palette.surface,
                },
              ]}>
              {uploadingAvatar ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="camera-outline" size={15} color="#FFFFFF" />
              )}
            </View>
          ) : null}
        </AvatarWrapper>

        <View style={styles.heroText}>
          <View style={styles.badges}>
            <View style={[styles.badge, { backgroundColor: palette.primaryLight }]}>
              <Text style={[styles.badgeText, { color: palette.primary }]}>{badge}</Text>
            </View>
            {verifiedLabel ? (
              <View style={[styles.badge, { backgroundColor: palette.successLight }]}>
                <Ionicons name="checkmark-circle" size={13} color={palette.success} />
                <Text style={[styles.badgeText, { color: palette.success }]}>{verifiedLabel}</Text>
              </View>
            ) : null}
          </View>

          <Text numberOfLines={2} style={[styles.name, { color: palette.ink }]}>
            {name}
          </Text>

          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={15} color={palette.inkMuted} />
            <Text numberOfLines={1} style={[styles.metaText, { color: palette.inkSecondary }]}>
              {[city || 'Город не указан', subtitle].filter(Boolean).join(' · ')}
            </Text>
          </View>

          {rating > 0 || reviewsCount > 0 ? (
            <Pressable
              accessibilityRole={onRatingPress ? 'button' : undefined}
              disabled={!onRatingPress}
              hitSlop={6}
              onPress={onRatingPress}
              style={({ pressed }) => [styles.ratingRow, pressed && onRatingPress ? { opacity: 0.68 } : null]}>
              <Ionicons name="star" size={15} color={palette.star} />
              <Text style={[styles.ratingValue, { color: palette.ink }]}>{rating > 0 ? rating.toFixed(1) : '—'}</Text>
              <Text style={[styles.ratingCount, { color: palette.inkSecondary }]}>({reviewsCount})</Text>
              {onRatingPress ? <Ionicons name="chevron-forward" size={14} color={palette.inkMuted} /> : null}
            </Pressable>
          ) : null}
        </View>
      </View>
    </MaterialSurface>
  );
}

export function ProfileMetricGrid({ metrics }: { metrics: ProfileMetric[] }) {
  const { palette } = useAppTheme();

  return (
    <MaterialSurface level="raised" radius={24} style={styles.metricGrid}>
      {metrics.map((metric, index) => {
        const row = Math.floor(index / 2);
        const column = index % 2;
        const toneColor =
          metric.tone === 'success'
            ? palette.success
            : metric.tone === 'neutral'
              ? palette.inkSecondary
              : palette.primary;
        const toneBackground =
          metric.tone === 'success'
            ? palette.successLight
            : metric.tone === 'neutral'
              ? palette.surfaceMuted
              : palette.primaryLight;

        return (
          <View
            key={`${metric.label}-${index}`}
            style={[
              styles.metricCell,
              column === 0 ? { borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: palette.line } : null,
              row === 0 ? { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.line } : null,
            ]}>
              <View style={[styles.metricIcon, { backgroundColor: toneBackground }]}>
                <Ionicons name={metric.icon} size={18} color={toneColor} />
              </View>
              <View style={styles.metricContent}>
                {metric.loading ? (
                  <ActivityIndicator size="small" color={toneColor} style={styles.metricLoader} />
                ) : (
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.78}
                    style={[styles.metricValue, { color: palette.ink }]}>
                    {metric.value}
                  </Text>
                )}
                <Text numberOfLines={2} style={[styles.metricLabel, { color: palette.inkSecondary }]}>
                  {metric.label}
                </Text>
              </View>
          </View>
        );
      })}
    </MaterialSurface>
  );
}

export function ProfileActionGroup({
  items,
  title,
}: {
  items: ProfileActionItem[];
  title?: string;
}) {
  const { palette } = useAppTheme();

  return (
    <View style={styles.section}>
      {title ? <Text style={[styles.sectionTitle, { color: palette.ink }]}>{title}</Text> : null}
      <MaterialSurface level="raised" radius={24} style={styles.actionGroup}>
        {items.map((item, index) => {
          const iconColor = item.tone === 'danger' ? palette.danger : palette.primary;
          const iconBackground = item.tone === 'danger' ? palette.dangerLight : palette.primaryLight;
          return (
            <View key={item.title}>
              <TouchableOpacity
                accessibilityRole="button"
                activeOpacity={0.66}
                disabled={item.disabled}
                onPress={item.onPress}
                style={[styles.actionRow, item.disabled ? { opacity: 0.48 } : null]}>
                <View style={[styles.actionIcon, { backgroundColor: iconBackground }]}>
                  <Ionicons name={item.icon} size={21} color={iconColor} />
                </View>
                <View style={styles.actionCopy}>
                  <Text numberOfLines={1} style={[styles.actionTitle, { color: palette.ink }]}>
                    {item.title}
                  </Text>
                  <Text numberOfLines={2} style={[styles.actionSubtitle, { color: palette.inkSecondary }]}>
                    {item.subtitle}
                  </Text>
                </View>
                {item.count && item.count > 0 ? (
                  <View style={[styles.counter, { backgroundColor: palette.primary }]}>
                    <Text style={styles.counterText}>{item.count > 99 ? '99+' : item.count}</Text>
                  </View>
                ) : null}
                <Ionicons
                  name={item.disabled ? 'lock-closed-outline' : 'chevron-forward'}
                  size={19}
                  color={palette.inkMuted}
                />
              </TouchableOpacity>
              {index < items.length - 1 ? (
                <View style={[styles.separator, { backgroundColor: palette.line }]} />
              ) : null}
            </View>
          );
        })}
      </MaterialSurface>
    </View>
  );
}

export function ProfileInfoPanel({ children, title }: { children: ReactNode; title?: string }) {
  const { palette } = useAppTheme();
  return (
    <View style={styles.section}>
      {title ? <Text style={[styles.sectionTitle, { color: palette.ink }]}>{title}</Text> : null}
      <MaterialSurface level="raised" radius={24} style={styles.infoPanel}>
        {children}
      </MaterialSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    padding: 18,
    shadowOpacity: 0.12,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  heroContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
  avatarOuter: {
    width: 92,
    height: 92,
    flexShrink: 0,
  },
  avatarRing: {
    width: 88,
    height: 88,
    padding: 3,
    borderRadius: 44,
    borderWidth: 1.5,
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 40,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontSize: 25,
    lineHeight: 30,
    fontWeight: '800',
  },
  avatarAction: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroText: {
    flex: 1,
    minWidth: 0,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 7,
  },
  badge: {
    minHeight: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
  },
  name: {
    fontSize: 23,
    lineHeight: 28,
    fontWeight: '800',
  },
  metaRow: {
    marginTop: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  ratingRow: {
    alignSelf: 'flex-start',
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingValue: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '800',
  },
  ratingCount: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    overflow: 'hidden',
  },
  metricCell: {
    width: '50%',
    minHeight: 94,
    paddingHorizontal: 15,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  metricIcon: {
    width: 38,
    height: 38,
    flexShrink: 0,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricContent: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  metricLoader: {
    alignSelf: 'flex-start',
    height: 24,
  },
  metricValue: {
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '800',
  },
  metricLabel: {
    marginTop: 3,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    paddingHorizontal: 3,
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '800',
  },
  actionGroup: {
    overflow: 'hidden',
  },
  actionRow: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  actionTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
  },
  actionSubtitle: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 70,
  },
  counter: {
    minWidth: 23,
    height: 23,
    paddingHorizontal: 6,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  infoPanel: {
    padding: 16,
  },
});
