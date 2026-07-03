import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '@/theme/useAppTheme';

interface PastelIconProps {
  name: keyof typeof Ionicons.glyphMap;
  size?: number;
  color?: string;
  containerSize?: number;
}

/**
 * Reusable icon wrapper with a pastel orange circular background (TZ §2).
 */
export function PastelIcon({
  name,
  size = 18,
  color = palette.primary,
  containerSize = 36,
}: PastelIconProps) {
  const { palette } = useAppTheme();
  return (
    <View
      style={{
        width: containerSize,
        height: containerSize,
        borderRadius: containerSize / 2,
        backgroundColor: palette.primaryLight,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Ionicons name={name} size={size} color={color} />
    </View>
  );
}
