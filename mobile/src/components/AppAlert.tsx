import { useCallback, useEffect, useRef } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  View,
  type AlertButton,
  type AlertStatic,
} from 'react-native';
import { create } from 'zustand';

import { Button } from '@/components/ui/Button';
import type { AppIconName } from '@/components/ui/AppIcon';
import { DialogHeader, type DialogTone } from '@/components/ui/DialogHeader';
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
  const toneIcon: Record<AlertTone, AppIconName> = {
    info: 'information-circle-outline',
    success: 'checkmark-circle-outline',
    warning: 'warning-outline',
    danger: 'alert-circle-outline',
    choice: 'image-outline',
  };
  const dialogTone: DialogTone = tone === 'info' || tone === 'choice' ? 'primary' : tone;
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
    const actionIcon: AppIconName = isDestructive
      ? 'trash-outline'
      : isCancel
        ? 'close-outline'
        : tone === 'choice'
          ? 'images-outline'
          : 'checkmark-outline';

    return (
      <Button
        key={`${button.text ?? 'button'}-${index}`}
        label={button.text ?? 'Понятно'}
        startIcon={actionIcon}
        onPress={() => close(button)}
        mode={isPrimary ? 'solid' : 'soft'}
        tone={isDestructive ? 'danger' : isCancel ? 'neutral' : 'primary'}
        size="md"
        style={[
          flex ? { flex } : null,
          isPrimary && compactChoice ? { height: 52 } : null,
        ]}
      />
    );
  };

  return (
    <Modal
      visible
      transparent
      presentationStyle="overFullScreen"
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
            overflow: 'hidden',
            opacity,
            transform: [{ scale }],
            shadowColor: '#000000',
            shadowOffset: { width: 0, height: 12 },
            shadowOpacity: 0.22,
            shadowRadius: 24,
            elevation: 14,
          }}>
          <DialogHeader
            title={request.title}
            description={request.message}
            icon={toneIcon[tone]}
            tone={dialogTone}
            showClose={false}
          />

          <View style={{ paddingHorizontal: 18, paddingTop: 15, paddingBottom: 18 }}>
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
