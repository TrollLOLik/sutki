import { View } from 'react-native';

import { DomainCard } from '@/components/domain/DomainCard';
import { AppIcon, BottomSheet, ListCell, type AppIconName } from '@/components/ui';
import { useAppTheme } from '@/theme/useAppTheme';

interface UserActionsSheetProps {
  visible: boolean;
  userName: string;
  blocked: boolean;
  blockedByMe: boolean;
  busy?: boolean;
  onClose: () => void;
  onReport: () => void;
  onBlock: () => void;
  onUnblock: () => void;
  onShare?: () => void;
  onCall?: () => void;
  onOpenProfile?: () => void;
}

interface Row {
  key: string;
  icon: AppIconName;
  title: string;
  subtitle?: string;
  danger?: boolean;
  onPress: () => void;
}

export function UserActionsSheet({
  visible,
  userName,
  blocked,
  blockedByMe,
  busy = false,
  onClose,
  onReport,
  onBlock,
  onUnblock,
  onShare,
  onCall,
  onOpenProfile,
}: UserActionsSheetProps) {
  const { palette } = useAppTheme();
  const rows: Row[] = [];

  if (onOpenProfile) rows.push({ key: 'profile', icon: 'person-outline', title: 'Открыть профиль', onPress: onOpenProfile });
  if (onCall && !blocked) rows.push({ key: 'call', icon: 'call-outline', title: 'Позвонить', onPress: onCall });
  if (onShare) rows.push({ key: 'share', icon: 'share-outline', title: 'Поделиться профилем', onPress: onShare });
  rows.push({
    key: 'report',
    icon: 'flag-outline',
    title: 'Пожаловаться',
    subtitle: 'Сообщить о нарушении правил',
    onPress: onReport,
  });
  if (blockedByMe) {
    rows.push({
      key: 'unblock',
      icon: 'person-add-outline',
      title: 'Разблокировать',
      subtitle: 'Снова разрешить сообщения и новые заявки',
      onPress: onUnblock,
    });
  } else if (!blocked) {
    rows.push({
      key: 'block',
      icon: 'ban-outline',
      title: 'Заблокировать',
      subtitle: 'Запретить сообщения и новые заявки',
      danger: true,
      onPress: onBlock,
    });
  }

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={userName}
      subtitle={blocked ? 'Взаимодействие ограничено' : 'Действия с пользователем'}
      icon="person-circle-outline">
      <DomainCard radius={22} style={{ overflow: 'hidden', opacity: busy ? 0.58 : 1 }}>
        {rows.map((row, index) => (
          <ListCell
            key={row.key}
            title={row.title}
            subtitle={row.subtitle}
            multiline={Boolean(row.subtitle)}
            chevron={false}
            disabled={busy}
            onPress={row.onPress}
            style={index > 0 ? { borderTopWidth: 1, borderTopColor: palette.line } : undefined}
            before={
              <View
                style={{
                  width: 44,
                  height: 44,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 16,
                  backgroundColor: row.danger ? palette.dangerLight : palette.primaryLight,
                }}>
                <AppIcon name={row.icon} size={21} color={row.danger ? palette.danger : palette.primary} />
              </View>
            }
          />
        ))}
      </DomainCard>
    </BottomSheet>
  );
}
