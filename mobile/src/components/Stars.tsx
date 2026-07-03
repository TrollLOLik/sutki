import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';

import { useAppTheme } from '@/theme/useAppTheme';

interface StarsProps {
  /** Rating value, 0..5 (fractions render a half star). */
  value: number;
  size?: number;
}

/** Read-only five-star rating row used on review screens and listing headers. */
export function Stars({ value, size = 16 }: StarsProps) {
  const { palette } = useAppTheme();
  return (
    <View className="flex-row" accessibilityLabel={`Рейтинг ${value} из 5`}>
      {[0, 1, 2, 3, 4].map((i) => {
        const filled = value - i;
        const name = filled >= 0.75 ? 'star' : filled >= 0.25 ? 'star-half' : 'star-outline';
        return <Ionicons key={i} name={name} size={size} color={palette.star} />;
      })}
    </View>
  );
}
