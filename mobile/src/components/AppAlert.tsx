import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  Text,
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

interface AlertActionProps {
  children: ReactNode;
  onPress: () => void;
  backgroundColor: string;
  borderColor: string;
  bordered?: boolean;
  flex?: number;
  minHeight?: number;
}

function AlertAction({
  children,
  onPress,
  backgroundColor,
  borderColor,
  bordered = false,
  flex,
  minHeight = 48,
}: AlertActionProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn = () => {
    Animated.timing(scale, {
      toValue: 0.97,
      duration: 70,
      useNativeDriver: true,
    }).start();
  };

  const pressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      damping: 16,
      stiffness: 320,
      mass: 0.55,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View style={{ flex, transform: [{ scale }] }}>
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        style={{
          minHeight,
          borderRadius: 16,
          borderWidth: bordered ? 1 : 0,
          borderColor,
          backgroundColor,
          paddingHorizontal: 14,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        {children}
      </Pressable>
    </Animated.View>
  );
}

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
  const modalShown = useRef(false);
  const presentedRequestID = useRef<number | null>(null);
  const openFrame = useRef<number | null>(null);

  const stopAnimations = useCallback(() => {
    if (openFrame.current != null) {
      cancelAnimationFrame(openFrame.current);
      openFrame.current = null;
    }
    opacity.stopAnimation();
    scale.stopAnimation();
  }, [opacity, scale]);

  const animateOpen = useCallback(() => {
    if (!request || closing.current) return;
    stopAnimations();
    opacity.setValue(0);
    scale.setValue(0.94);
    openFrame.current = requestAnimationFrame(() => {
      openFrame.current = null;
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          damping: 19,
          stiffness: 230,
          mass: 0.78,
          useNativeDriver: true,
        }),
      ]).start();
    });
  }, [opacity, request, scale, stopAnimations]);

  useEffect(() => {
    if (!request) return;
    closing.current = false;
    if (modalShown.current && presentedRequestID.current !== request.id) {
      presentedRequestID.current = request.id;
      animateOpen();
    }
  }, [animateOpen, request?.id]);

  useEffect(() => () => stopAnimations(), [stopAnimations]);

  const close = useCallback(
    (button?: AlertButton, dismissed = false) => {
      if (!request || closing.current) return;
      closing.current = true;
      stopAnimations();
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
        modalShown.current = false;
        presentedRequestID.current = null;
        useAlertStore.getState().clear(request.id);
        closing.current = false;
        if (dismissed) request.options?.onDismiss?.();
        button?.onPress?.();
      });
    },
    [opacity, request, scale, stopAnimations],
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
  const primaryButtons = request.buttons.filter((button) => button.style !== 'cancel' && button.style !== 'destructive');
  const destructiveButtons = request.buttons.filter((button) => button.style === 'destructive');
  const cancelButtons = request.buttons.filter((button) => button.style === 'cancel');
  const compactChoice =
    verticalButtons && primaryButtons.length === 1 && destructiveButtons.length === 1 && cancelButtons.length === 1;
  const canDismiss = request.options?.cancelable !== false;

  const renderAction = (button: AlertButton, index: number, flex?: number) => {
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
        ? palette.dangerLight
        : palette.surfaceMuted;
    const foregroundColor = isPrimary ? '#FFFFFF' : isDestructive ? palette.danger : palette.ink;

    return (
      <AlertAction
        key={`${button.text ?? 'button'}-${index}`}
        onPress={() => close(button)}
        flex={flex}
        minHeight={isPrimary && compactChoice ? 52 : 48}
        backgroundColor={backgroundColor}
        borderColor={isDestructive ? palette.danger : palette.line}
        bordered={!isPrimary}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 }}>
          <Ionicons name={actionIcon} size={18} color={foregroundColor} />
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.82}
            style={{
              flexShrink: 1,
              textAlign: 'center',
              color: foregroundColor,
              fontSize: 14,
              fontWeight: '800',
            }}>
            {button.text ?? 'Понятно'}
          </Text>
        </View>
      </AlertAction>
    );
  };

  return (
    <Modal
      visible
      transparent
      statusBarTranslucent
      navigationBarTranslucent
      hardwareAccelerated
      animationType="none"
      onShow={() => {
        modalShown.current = true;
        presentedRequestID.current = request.id;
        animateOpen();
      }}
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
        <Animated.View
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            backgroundColor: '#000000',
            opacity: opacity.interpolate({ inputRange: [0, 1], outputRange: [0, 0.56] }),
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
            backgroundColor: 'transparent',
          }}
        />
        </Animated.View>

        <Animated.View
          style={{
            width: '100%',
            maxWidth: 400,
            borderRadius: 24,
            borderWidth: 1,
            borderColor: palette.line,
            backgroundColor: palette.surface,
            padding: 20,
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
                borderRadius: 22,
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

          <View style={{ marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: palette.line }}>
            {compactChoice ? (
              <View style={{ gap: 10 }}>
                {renderAction(primaryButtons[0], request.buttons.indexOf(primaryButtons[0]))}
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  {renderAction(destructiveButtons[0], request.buttons.indexOf(destructiveButtons[0]), 1)}
                  {renderAction(cancelButtons[0], request.buttons.indexOf(cancelButtons[0]), 1)}
                </View>
              </View>
            ) : (
              <View style={{ flexDirection: verticalButtons ? 'column' : 'row', gap: 10 }}>
                {request.buttons.map((button, index) =>
                  renderAction(button, index, verticalButtons ? undefined : button.style === 'cancel' ? 0.9 : 1.1),
                )}
              </View>
            )}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}
