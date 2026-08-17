import { View } from 'react-native';

import { DomainCard } from '@/components/domain/DomainCard';
import { AppIcon, BottomSheet, ListCell, type AppIconName } from '@/components/ui';
import { useAppTheme } from '@/theme/useAppTheme';

interface ContentAction {
  key: string;
  title: string;
  subtitle?: string;
  icon: AppIconName;
  danger?: boolean;
  onPress: () => void;
}

interface ContentActionsSheetProps {
  visible: boolean;
  title: string;
  subtitle?: string;
  actions: ContentAction[];
  onClose: () => void;
}

export function ContentActionsSheet({
  visible,
  title,
  subtitle = 'Действия',
  actions,
  onClose,
}: ContentActionsSheetProps) {
  const { palette } = useAppTheme();

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      icon="ellipsis-horizontal">
      <DomainCard radius={22} style={{ overflow: 'hidden' }}>
        {actions.map((action, index) => (
          <ListCell
            key={action.key}
            title={action.title}
            subtitle={action.subtitle}
            multiline={Boolean(action.subtitle)}
            chevron={false}
            onPress={action.onPress}
            style={index > 0 ? { borderTopWidth: 1, borderTopColor: palette.line } : undefined}
            before={
              <View
                style={{
                  width: 44,
                  height: 44,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 16,
                  backgroundColor: action.danger ? palette.dangerLight : palette.primaryLight,
                }}>
                <AppIcon
                  name={action.icon}
                  size={21}
                  color={action.danger ? palette.danger : palette.primary}
                />
              </View>
            }
          />
        ))}
      </DomainCard>
    </BottomSheet>
  );
}
