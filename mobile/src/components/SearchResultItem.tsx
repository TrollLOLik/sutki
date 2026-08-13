import { Ionicons } from '@expo/vector-icons';
import { Text, TouchableOpacity, View } from 'react-native';

import { MaterialSurface } from '@/components/ui';
import { useAppTheme } from '@/theme/useAppTheme';

interface SearchResultItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  subtitle?: string | null;
  title: string;
  tone?: 'primary' | 'neutral';
}

export function SearchResultItem({ icon, onPress, subtitle, title, tone = 'primary' }: SearchResultItemProps) {
  const { palette } = useAppTheme();
  const iconColor = tone === 'primary' ? palette.primary : palette.inkSecondary;
  const iconBackground = tone === 'primary' ? palette.primaryLight : palette.surface;

  return (
    <MaterialSurface level="raised" radius={18} style={{ overflow: 'hidden' }}>
      <TouchableOpacity
        accessibilityRole="button"
        activeOpacity={0.7}
        onPress={onPress}
        style={{ width: '100%' }}>
        <View style={{ minHeight: 64, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, paddingVertical: 10 }}>
          <View
            style={{
              width: 38,
              height: 38,
              marginRight: 12,
              flexShrink: 0,
              borderRadius: 19,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: iconBackground,
            }}>
            <Ionicons name={icon} size={18} color={iconColor} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={{ color: palette.ink, fontSize: 15, lineHeight: 20, fontWeight: '700' }}>
              {title}
            </Text>
            {subtitle ? (
              <Text numberOfLines={1} style={{ marginTop: 2, color: palette.inkSecondary, fontSize: 12, lineHeight: 16 }}>
                {subtitle}
              </Text>
            ) : null}
          </View>
          <Ionicons name="chevron-forward" size={17} color={palette.inkMuted} style={{ marginLeft: 10 }} />
        </View>
      </TouchableOpacity>
    </MaterialSurface>
  );
}
