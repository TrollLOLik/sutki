import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Modal, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Button } from '@/components/ui';
import { palette, radii } from '@/theme/tokens';
import { AuthGateContext } from '@/lib/requireAuth';

interface AuthGateSheetProps {
  visible: boolean;
  onClose: () => void;
  context: AuthGateContext;
}

export function AuthGateSheet({ visible, onClose, context }: AuthGateSheetProps) {
  const router = useRouter();
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(400)).current;

  useEffect(() => {
    if (visible) {
      fade.setValue(0);
      slide.setValue(400);
      requestAnimationFrame(() => {
        Animated.parallel([
          Animated.timing(fade, { toValue: 0.4, duration: 250, useNativeDriver: true }),
          Animated.timing(slide, {
            toValue: 0,
            duration: 250,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
        ]).start();
      });
    }
  }, [visible]);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(slide, {
        toValue: 400,
        duration: 200,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start(() => onClose());
  };

  const handleSignIn = () => {
    handleClose();
    setTimeout(() => {
      router.push('/email');
    }, 200);
  };

  if (!visible) return null;

  let title = 'Требуется вход в аккаунт';
  let description = 'Войдите, чтобы пользоваться всеми функциями приложения «Дом Рядом».';
  let iconName: keyof typeof Ionicons.glyphMap = 'lock-closed-outline';

  switch (context) {
    case 'listing':
      title = 'Войдите, чтобы разместить жильё';
      description = 'Только зарегистрированные пользователи могут размещать свои объявления и сдавать жильё.';
      iconName = 'home-outline';
      break;
    case 'review':
      title = 'Отзывы могут оставлять гости с подтверждённым аккаунтом';
      description = 'Войдите в профиль, чтобы делиться своими впечатлениями о проживании.';
      iconName = 'star-outline';
      break;
    case 'favorites_cloud':
      title = 'Войдите, чтобы сохранять избранное в облаке';
      description = 'Это позволит вам просматривать избранные объявления на любых ваших устройствах.';
      iconName = 'heart-outline';
      break;
    case 'host':
      title = 'Войдите, чтобы управлять объявлениями и заявками';
      description = 'Для просмотра входящих заявок и управления вашим жильем необходима авторизация.';
      iconName = 'key-outline';
      break;
  }

  return (
    <Modal visible transparent animationType="none" onRequestClose={handleClose}>
      <View className="flex-1 justify-end">
        {/* Backdrop */}
        <Animated.View
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'black', opacity: fade }}
        >
          <Pressable style={{ flex: 1 }} onPress={handleClose} />
        </Animated.View>

        {/* Content Sheet */}
        <Animated.View
          style={{
            transform: [{ translateY: slide }],
            backgroundColor: palette.surface,
            borderTopLeftRadius: radii.card,
            borderTopRightRadius: radii.card,
          }}
          className="px-4 pb-10 pt-4"
        >
          {/* Top handle and title */}
          <View className="items-center pb-4">
            <View className="h-1 w-12 rounded-full bg-line mb-4" />
            <View className="h-14 w-14 items-center justify-center rounded-full bg-primary-light mb-4">
              <Ionicons name={iconName} size={30} color={palette.primary} />
            </View>
            <Text className="text-xl font-extrabold text-ink text-center px-4 leading-6">
              {title}
            </Text>
          </View>

          <Text className="text-base text-ink-secondary text-center px-6 leading-6 mb-8">
            {description}
          </Text>

          {/* Action buttons */}
          <View className="gap-3">
            <Button
              label="Войти по email"
              size="md"
              className="w-full"
              onPress={handleSignIn}
            />
            <Button
              label="Отмена"
              variant="secondary"
              size="md"
              className="w-full"
              onPress={handleClose}
            />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}
