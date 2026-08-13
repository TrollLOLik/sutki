import { BlurView } from 'expo-blur';
import type { Href } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { NavigationBackButton } from '@/components/NavigationBackButton';
import { useAppTheme } from '@/theme/useAppTheme';

export interface AppHeaderProps {
  title: string;
  subtitle?: string;
  fallback?: Href;
  leading?: ReactNode;
  actions?: ReactNode;
  blurred?: boolean;
  showBorder?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function AppHeader({ title, subtitle, fallback = '/(tabs)', leading, actions, blurred = false, showBorder = true, style }: AppHeaderProps) {
  const { palette, isDark } = useAppTheme();

  return (
    <View style={[styles.root, showBorder ? { borderBottomWidth: 1, borderBottomColor: palette.line } : null, { backgroundColor: palette.surface }, style]}>
      {blurred ? (
        <>
          <BlurView intensity={88} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? 'rgba(20,22,27,0.72)' : 'rgba(255,255,255,0.72)' }]} />
        </>
      ) : null}
      <View style={styles.side}>{leading ?? <NavigationBackButton fallback={fallback} size={48} variant="material" />}</View>
      <View pointerEvents="none" style={styles.copy}>
        <Text numberOfLines={1} style={[styles.title, { color: palette.ink }]}>{title}</Text>
        {subtitle ? <Text numberOfLines={1} style={[styles.subtitle, { color: palette.inkSecondary }]}>{subtitle}</Text> : null}
      </View>
      <View style={[styles.side, styles.right]}>{actions}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    minHeight: 70,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    overflow: 'hidden',
  },
  side: {
    width: 48,
    minHeight: 48,
    alignItems: 'flex-start',
    justifyContent: 'center',
    zIndex: 1,
  },
  right: {
    alignItems: 'flex-end',
  },
  copy: {
    minWidth: 0,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  title: {
    maxWidth: '100%',
    textAlign: 'center',
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '800',
  },
  subtitle: {
    maxWidth: '100%',
    marginTop: 2,
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
});
