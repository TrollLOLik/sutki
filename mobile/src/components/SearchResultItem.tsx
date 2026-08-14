import { View } from 'react-native';

import { DomainCard } from '@/components/domain/DomainCard';
import { AppIcon, ListCell, type AppIconName } from '@/components/ui';
import { useAppTheme } from '@/theme/useAppTheme';

interface SearchResultItemProps {
  icon: AppIconName;
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
    <DomainCard radius={18} style={{ overflow: 'hidden' }}>
      <ListCell
        title={title}
        subtitle={subtitle}
        chevron
        onPress={onPress}
        before={
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
            <AppIcon name={icon} size={18} color={iconColor} />
          </View>
        }
      />
    </DomainCard>
  );
}
