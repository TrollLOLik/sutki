import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  Text,
  TouchableOpacity,
  View,
  type AlertButton,
  type AlertStatic,
} from 'react-native';
import { create } from 'zustand';

import { useAppTheme } from '@/theme/useAppTheme';

interface AppAlertOptions {
  cancelable?: boolean;
  userInterfaceStyle?: 'unspecified' | 'light' | 'dark';
  onDismiss?: () => void;
}

interface AlertRequest {
  id: number;
  title: string;
  message?: string;
  buttons: AlertButton[];
  options?: AppAlertOptions;
}

interface AlertState {
  request: AlertRequest | null;
  show: (request: AlertRequest) => void;
  clear: (id: number) => void;
}

let nextAlertID = 1;

const useAlertStore = create<AlertState>((set) => ({
  request: null,
  show: (request) => set({ request }),
  clear: (id) => set((state) => (state.request?.id === id ? { request: null } : state)),
}));

export const appAlert: Pick<AlertStatic, 'alert'> = {
  alert: (title, message, buttons, options) => {
    useAlertStore.getState().show({
      id: nextAlertID++,
      title,
      message,
      buttons: buttons?.length ? buttons : [{ text: 'Понятно' }],
      options,
    });
  },
};

type AlertTone = 'info' | 'success' | 'warning' | 'danger' | 'choice';

function getTone(request: AlertRequest): AlertTone {
  const title = request.title.toLocaleLowerCase('ru');
  if (/успеш|отправлен|готово|подтвержден/.test(title)) return 'success';
  if (/ошиб|не удалось|недоступ|отклонен|отклонён|запрещен|запрещён|занят|превыш/.test(title)) {
    return 'danger';
  }
  if (/фото|выберите|что вы хотите/.test(title) && request.buttons.length > 2) return 'choice';
  if (
    /вниман|разрешен|разрешён|геолокац|недостаточно|отменить|завершить|отклонить/.test(title) ||
    (request.buttons.length <= 2 && request.buttons.some((button) => button.style === 'destructive'))
  ) {
    return 'warning';
  }
  return 'info';
}

export function AppAlertHost() {
  const { palette } = useAppTheme();
  const request = useAlertStore((state) => state.request);
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.94)).current;
  const closing = useRef(false);

  useEffect(() => {
    if (!request) return;
    closing.current = false;
    opacity.setValue(0);
    scale.setValue(0.94);
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 170,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        damping: 18,
        stiffness: 220,
        mass: 0.8,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, request?.id, scale]);

  const close = useCallback(
    (button?: AlertButton, dismissed = false) => {
      if (!request || closing.current) return;
      closing.current = true;
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 130,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 0.97,
          duration: 130,
          useNativeDriver: true,
        }),
      ]).start(() => {
        useAlertStore.getState().clear(request.id);
        closing.current = false;
        if (dismissed) request.options?.onDismiss?.();
        button?.onPress?.();
      });
    },
    [opacity, request, scale],
  );

  if (!request) return null;

  const tone = getTone(request);
  const toneStyle = {
    info: { color: palette.info, background: palette.infoLight, icon: 'information-circle-outline' },
    success: { color: palette.success, background: palette.successLight, icon: 'checkmark-circle-outline' },
    warning: { color: palette.primary, background: palette.primaryLight, icon: 'warning-outline' },
    danger: { color: palette.danger, background: palette.dangerLight, icon: 'alert-circle-outline' },
    choice: { color: palette.primary, background: palette.primaryLight, icon: 'image-outline' },
  }[tone] as { color: string; background: string; icon: keyof typeof Ionicons.glyphMap };
  const verticalButtons = request.buttons.length > 2;
  const canDismiss = request.options?.cancelable !== false;

  return (
    <Modal
      visible
      transparent
      statusBarTranslucent
      animationType="none"
      onRequestClose={() => {
        if (canDismiss) close(undefined, true);
      }}>
      <View
        accessibilityViewIsModal
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 24,
          paddingVertical: 32,
        }}>
        <Pressable
          accessibilityLabel="Закрыть окно"
          disabled={!canDismiss}
          onPress={() => close(undefined, true)}
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.56)',
          }}
        />

        <Animated.View
          style={{
            width: '100%',
            maxWidth: 400,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: palette.line,
            backgroundColor: palette.surface,
            padding: 18,
            opacity,
            transform: [{ scale }],
            shadowColor: '#000000',
            shadowOffset: { width: 0, height: 12 },
            shadowOpacity: 0.22,
            shadowRadius: 24,
            elevation: 14,
          }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
            <View
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: toneStyle.background,
              }}>
              <Ionicons name={toneStyle.icon} size={23} color={toneStyle.color} />
            </View>
            <View style={{ flex: 1, minWidth: 0, paddingTop: 1 }}>
              <Text style={{ color: palette.ink, fontSize: 18, fontWeight: '800', lineHeight: 23 }}>
                {request.title}
              </Text>
              {request.message ? (
                <Text
                  style={{
                    marginTop: 6,
                    color: palette.inkSecondary,
                    fontSize: 14,
                    lineHeight: 20,
                  }}>
                  {request.message}
                </Text>
              ) : null}
            </View>
          </View>

          <View
            style={{
              flexDirection: verticalButtons ? 'column' : 'row',
              gap: verticalButtons ? 8 : 10,
              marginTop: 18,
              paddingTop: 14,
              borderTopWidth: 1,
              borderTopColor: palette.line,
            }}>
            {request.buttons.map((button, index) => {
              const isCancel = button.style === 'cancel';
              const isDestructive = button.style === 'destructive';
              const isPrimary = !isCancel && !isDestructive;
              const actionIcon: keyof typeof Ionicons.glyphMap = isDestructive
                ? 'trash-outline'
                : isCancel
                  ? 'close-outline'
                  : tone === 'choice'
                    ? 'images-outline'
                    : 'checkmark-outline';
              const backgroundColor = isPrimary
                ? palette.primary
                : isDestructive
                  ? verticalButtons
                    ? palette.dangerLight
                    : palette.danger
                  : palette.surfaceMuted;
              const foregroundColor = isPrimary || (isDestructive && !verticalButtons)
                ? '#FFFFFF'
                : isDestructive
                  ? palette.danger
                  : palette.ink;
              return (
                <TouchableOpacity
                  key={`${button.text ?? 'button'}-${index}`}
                  accessibilityRole="button"
                  onPress={() => close(button)}
                  activeOpacity={0.78}
                  style={{
                    flex: verticalButtons ? undefined : isCancel ? 0.8 : 1.2,
                    minHeight: verticalButtons ? 48 : 46,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: verticalButtons ? 'flex-start' : 'center',
                    gap: verticalButtons ? 10 : 0,
                    borderRadius: 12,
                    borderWidth: isPrimary ? 0 : 1,
                    borderColor: isDestructive ? palette.danger : palette.line,
                    backgroundColor,
                    paddingHorizontal: 14,
                  }}>
                  {verticalButtons ? (
                    <View
                      style={{
                        width: 30,
                        height: 30,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 9,
                        backgroundColor: isPrimary
                          ? 'rgba(255, 255, 255, 0.18)'
                          : palette.surface,
                      }}>
                      <Ionicons name={actionIcon} size={18} color={foregroundColor} />
                    </View>
                  ) : null}
                  <Text
                    numberOfLines={2}
                    style={{
                      flexShrink: 1,
                      textAlign: verticalButtons ? 'left' : 'center',
                      color: foregroundColor,
                      fontSize: 14,
                      fontWeight: '700',
                    }}>
                    {button.text ?? 'Понятно'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}
