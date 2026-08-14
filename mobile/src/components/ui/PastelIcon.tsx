import { View } from 'react-native';

import { AppIcon, type AppIconName } from '@/components/ui/AppIcon';
import { useAppTheme } from '@/theme/useAppTheme';

interface PastelIconProps {
  name: AppIconName;
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
  color,
  containerSize = 36,
}: PastelIconProps) {
  const { palette } = useAppTheme();
  const iconColor = color ?? palette.primary;
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
      <AppIcon name={name} size={size} color={iconColor} />
    </View>
  );
}
