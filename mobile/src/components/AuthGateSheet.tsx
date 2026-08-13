import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';

import { ComponentMarker } from '@/components/debug/ComponentMarker';
import { BottomSheet, Button, DialogActions } from '@/components/ui';
import type { AuthGateContext } from '@/lib/requireAuth';
import { useAppTheme } from '@/theme/useAppTheme';

interface AuthGateSheetProps {
  visible: boolean;
  onClose: () => void;
  context: AuthGateContext;
}

const COPY: Record<
  AuthGateContext,
  { title: string; description: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  generic: {
    title: 'Требуется вход в аккаунт',
    description: 'Войдите, чтобы пользоваться всеми возможностями ВИГАЖ.',
    icon: 'lock-closed-outline',
  },
  listing: {
    title: 'Войдите, чтобы разместить жильё',
    description: 'Управлять объявлениями и заявками могут только пользователи с подтверждённым аккаунтом.',
    icon: 'home-outline',
  },
  review: {
    title: 'Войдите, чтобы оставить отзыв',
    description: 'Отзывы доступны гостям после завершённого проживания.',
    icon: 'star-outline',
  },
  favorites_cloud: {
    title: 'Сохраняйте избранное в аккаунте',
    description: 'После входа объявления будут доступны на всех ваших устройствах.',
    icon: 'heart-outline',
  },
  host: {
    title: 'Войдите для управления жильём',
    description: 'Авторизация нужна для работы с объявлениями и входящими заявками.',
    icon: 'key-outline',
  },
};

export function AuthGateSheet({ visible, onClose, context }: AuthGateSheetProps) {
  const { palette } = useAppTheme();
  const router = useRouter();
  const copy = COPY[context];

  const handleSignIn = () => {
    onClose();
    setTimeout(() => router.push('/welcome'), 180);
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={copy.title}
      subtitle={copy.description}
      icon={copy.icon}
      footer={
        <DialogActions
          secondary={<Button label="Отмена" variant="secondary" size="md" onPress={onClose} />}
          primary={<Button label="Войти" size="md" onPress={handleSignIn} />}
        />
      }>
      <ComponentMarker kind="modal" name="AuthGateSheet" />
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: 12,
          borderRadius: 18,
          backgroundColor: palette.primaryLight,
          padding: 14,
        }}>
        <Ionicons name="shield-checkmark-outline" size={21} color={palette.primary} />
        <Text style={{ minWidth: 0, flex: 1, color: palette.inkSecondary, fontSize: 13, lineHeight: 19 }}>
          Вход защищает ваши данные и позволяет синхронизировать действия между приложением и сайтом.
        </Text>
      </View>
    </BottomSheet>
  );
}
