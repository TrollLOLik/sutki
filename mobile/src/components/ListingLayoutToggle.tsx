import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import type { ListingLayoutMode } from '@/store/listing-layout';
import { useAppTheme } from '@/theme/useAppTheme';

interface ListingLayoutToggleProps {
  mode: ListingLayoutMode;
  onToggle: () => void;
  marginRight?: number;
}

export function ListingLayoutToggle({
  mode,
  onToggle,
  marginRight = 0,
}: ListingLayoutToggleProps) {
  const { palette } = useAppTheme();
  const nextModeLabel = mode === 'list' ? 'Показать сеткой' : 'Показать списком';

  return (
    <View
      style={{
        width: 48,
        height: 48,
        marginRight,
        flexShrink: 0,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 24,
        borderWidth: 1,
        borderColor: palette.line,
        backgroundColor: palette.surface,
        shadowColor: '#1A1A1A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
        elevation: 3,
        overflow: 'hidden',
      }}
    >
      <Pressable
        accessibilityLabel={nextModeLabel}
        accessibilityRole="button"
        accessibilityHint="Меняет вид карточек объявлений"
        android_ripple={{ color: palette.primaryLight, radius: 24 }}
        onPress={onToggle}
        style={StyleSheet.absoluteFill}
      />
      <View pointerEvents="none">
        <Ionicons
          name={mode === 'list' ? 'grid-outline' : 'list-outline'}
          size={22}
          color={palette.primary}
        />
      </View>
    </View>
  );
}
