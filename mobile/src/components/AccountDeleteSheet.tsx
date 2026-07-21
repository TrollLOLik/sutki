import { Ionicons } from '@expo/vector-icons';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, Text, TextInput, View, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native';

import { Button } from '@/components/ui';
import {
  useCheckDeleteMe,
  useRequestDeleteMeCode,
  useConfirmDeleteMe,
} from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';
import { cn } from '@/lib/cn';
import { useSessionStore } from '@/store/session';
import { radii } from '@/theme/tokens';
import { useAppTheme } from '@/theme/useAppTheme';

const CODE_LENGTH = 6;

interface AccountDeleteSheetProps {
  visible: boolean;
  onClose: () => void;
}

type Step = 'checking' | 'active_bookings_blocked' | 'confirm_warning' | 'verify_code' | 'success';

function translateError(msg: string): string {
  const clean = msg.toLowerCase().trim();
  if (clean.includes('cannot delete account') || clean.includes('active bookings') || clean.includes('бронировани')) {
    return 'Невозможно удалить аккаунт: у вас есть активные поездки, аренды или объявления.';
  }
  if (clean.includes('invalid code') || clean.includes('code invalid')) {
    return 'Неверный код подтверждения. Пожалуйста, проверьте и введите еще раз.';
  }
  if (clean.includes('expired')) {
    return 'Срок действия кода подтверждения истек. Запросите код повторно.';
  }
  if (clean.includes('too many attempts') || clean.includes('many attempts')) {
    return 'Слишком много попыток ввода. Повторный запрос доступен позже.';
  }
  if (clean.includes('wait before') || clean.includes('too soon')) {
    return 'Пожалуйста, подождите перед запросом нового кода.';
  }
  if (clean.includes('unauthorized')) {
    return 'Время сессии истекло. Пожалуйста, авторизуйтесь заново.';
  }
  if (clean.includes('internal error')) {
    return 'Произошла внутренняя ошибка сервера. Пожалуйста, попробуйте позже.';
  }
  return msg;
}

export function AccountDeleteSheet({ visible, onClose }: AccountDeleteSheetProps) {
  const { palette } = useAppTheme();
  const signOut = useSessionStore((s) => s.signOut);
  const user = useSessionStore((s) => s.user);

  const [step, setStep] = useState<Step>('checking');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [codeSent, setCodeSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mutations
  const checkDelete = useCheckDeleteMe();
  const requestCode = useRequestDeleteMeCode();
  const confirmDelete = useConfirmDeleteMe();

  // Animation values
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(600)).current;

  // Input refs for automatic focus
  const hiddenInputRef = useRef<TextInput>(null);

  // Timer countdown
  useEffect(() => {
    if (seconds <= 0) return;
    const id = setInterval(() => setSeconds((s) => s - 1), 1000);
    return () => clearInterval(id);
  }, [seconds]);

  const handleStartCheck = async () => {
    setError(null);
    setStep('checking');
    try {
      const res = await checkDelete.mutateAsync();
      if (res.has_active_bookings) {
        setStep('active_bookings_blocked');
      } else {
        setStep('confirm_warning');
      }
    } catch (err) {
      setStep('confirm_warning'); // Fallback to let them request code, backend will still enforce bookings check
      setError(err instanceof ApiError ? err.message : 'Не удалось выполнить проверку бронирований.');
    }
  };

  // Open/Reset animations and values
  useLayoutEffect(() => {
    if (visible) {
      // Only reset the session if the previous deletion completed successfully or was blocked.
      if (step === 'success' || step === 'active_bookings_blocked') {
        setStep('checking');
        setCode('');
        setDevCode(null);
        setSeconds(0);
        setCodeSent(false);
        setError(null);
      }

      fade.stopAnimation();
      slide.stopAnimation();
      fade.setValue(0);
      slide.setValue(600);
    }
  }, [visible]);

  const handleShow = () => {
    requestAnimationFrame(() => {
      Animated.parallel([
        Animated.timing(fade, { toValue: 0.4, duration: 250, useNativeDriver: true }),
        Animated.spring(slide, {
          toValue: 0,
          damping: 26,
          stiffness: 260,
          mass: 1,
          useNativeDriver: true,
        }),
      ]).start(() => {
        if (step === 'checking' || step === 'success' || step === 'active_bookings_blocked') {
          handleStartCheck();
        }
      });
    });
  };

  // Auto-focus input on verify step
  useEffect(() => {
    if (!visible) return;
    if (step === 'verify_code') {
      const t = setTimeout(() => hiddenInputRef.current?.focus(), 350);
      return () => clearTimeout(t);
    }
  }, [step, visible]);

  const handleClose = () => {
    fade.stopAnimation();
    slide.stopAnimation();
    Animated.parallel([
      Animated.timing(fade, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(slide, {
        toValue: 600,
        duration: 200,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start(() => onClose());
  };

  const handleRequestCode = async () => {
    setError(null);
    try {
      const res = await requestCode.mutateAsync();
      setSeconds(60);
      if (res.dev_code) {
        setDevCode(res.dev_code);
      }
      setCodeSent(true);
      setStep('verify_code');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось отправить код подтверждения.');
    }
  };

  const handleConfirm = async (enteredCode: string) => {
    setError(null);
    try {
      await confirmDelete.mutateAsync(enteredCode);
      setStep('success');
      setTimeout(() => {
        handleClose();
        signOut();
      }, 2000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Неверный код подтверждения.');
    }
  };

  const handleReset = () => {
    setCode('');
    setDevCode(null);
    setSeconds(0);
    setCodeSent(false);
    setError(null);
    handleStartCheck();
  };

  if (!visible) return null;

  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      hardwareAccelerated
      onShow={handleShow}
      onRequestClose={handleClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 justify-end"
      >
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
            height: '75%', // Fixed tall height to prevent squishing
          }}
          className="px-4 pb-8 pt-4"
        >
          {/* Top handle and title */}
          <View className="items-center pb-4">
            <View className="h-1 w-12 rounded-full bg-line mb-3" />
            <Text className="text-lg font-extrabold text-ink">
              {step === 'checking' && 'Проверка аккаунта'}
              {step === 'active_bookings_blocked' && 'Удаление невозможно'}
              {step === 'confirm_warning' && 'Удаление аккаунта'}
              {step === 'verify_code' && 'Подтверждение удаления'}
              {step === 'success' && 'Успешно'}
            </Text>
          </View>

          {/* Errors display */}
          {error ? (
            <Text className="mb-4 text-center text-sm font-semibold text-danger px-4 leading-5">
              {translateError(error)}
            </Text>
          ) : null}

          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            className="flex-1 mb-4"
            contentContainerStyle={{ flexGrow: 1 }}
          >
            {/* Step 1: Checking */}
            {step === 'checking' ? (
              <View className="flex-1 items-center justify-center py-8 gap-3">
                <ActivityIndicator size="large" color={palette.primary} />
                <Text className="text-base text-ink-secondary text-center">
                  Проверяем активные бронирования и объявления...
                </Text>
              </View>
            ) : null}

            {/* Step 2: Blocked by active bookings */}
            {step === 'active_bookings_blocked' ? (
              <View className="gap-5 py-4">
                <View className="items-center justify-center py-2">
                  <View className="h-14 w-14 items-center justify-center rounded-full bg-danger-light">
                    <Ionicons name="warning-outline" size={32} color={palette.danger} />
                  </View>
                </View>
                <Text className="text-base text-ink-secondary text-center px-4 leading-6">
                  У вас есть активные бронирования, поездки или объявления в аренде.{'\n\n'}
                  Пожалуйста, завершите все активные поездки и снимите объявления с публикации перед удалением профиля.
                </Text>
              </View>
            ) : null}

            {/* Step 3: Confirmation Warning (FZ-152) */}
            {step === 'confirm_warning' ? (
              <View className="gap-5 py-2">
                <Text className="text-base text-ink-secondary text-center px-4 leading-6 font-semibold">
                  Вы собираетесь удалить свой профиль в приложении «Дом Рядом»
                </Text>

                <View className="bg-surface-muted rounded-card p-4 gap-3 border border-line">
                  <Text className="text-sm font-extrabold text-ink mb-1">Согласно законодательству РФ (ФЗ-152, ФЗ-402, НК РФ):</Text>
                  <View className="flex-row gap-2.5">
                    <Ionicons name="shield-outline" size={16} color={palette.primary} className="mt-0.5" />
                    <Text className="text-sm text-ink-secondary flex-1 leading-5">
                      Ваши персональные данные будут обезличены и скрыты в течение 30 дней.
                    </Text>
                  </View>
                  <View className="flex-row gap-2.5">
                    <Ionicons name="archive-outline" size={16} color={palette.primary} className="mt-0.5" />
                    <Text className="text-sm text-ink-secondary flex-1 leading-5">
                      Все ваши объявления будут навсегда деактивированы и скрыты из поиска.
                    </Text>
                  </View>
                  <View className="flex-row gap-2.5">
                    <Ionicons name="document-text-outline" size={16} color={palette.primary} className="mt-0.5" />
                    <Text className="text-sm text-ink-secondary flex-1 leading-5">
                      История переписок и финансовые документы будут храниться в архиве в течение 5 лет в обезличенном виде для бухучета и налоговой отчетности.
                    </Text>
                  </View>
                </View>

                <Text className="text-sm text-danger text-center font-bold px-4 leading-5 mt-2">
                  Это действие полностью необратимо.
                </Text>
              </View>
            ) : null}

            {/* Step 4: Verify confirmation code */}
            {step === 'verify_code' ? (
              <View className="gap-5 py-2">
                <Text className="text-base text-ink-secondary text-center px-4 leading-6">
                  Для подтверждения удаления мы отправили 6-значный код на вашу почту:{'\n'}
                  <Text className="font-bold text-ink">{user?.email}</Text>
                </Text>

                <Pressable
                  className="flex-row justify-center gap-2 py-2"
                  onPress={() => hiddenInputRef.current?.focus()}
                >
                  {Array.from({ length: CODE_LENGTH }).map((_, i) => (
                    <View
                      key={i}
                      className={cn(
                        'h-14 flex-1 items-center justify-center rounded-field border bg-surface-muted',
                        code.length === i ? 'border-primary border-2 bg-surface' : 'border-line',
                      )}
                    >
                      <Text className="text-2xl font-extrabold text-ink">{code[i] ?? ''}</Text>
                    </View>
                  ))}
                </Pressable>

                {devCode ? (
                  <Pressable
                    onPress={() => {
                      setCode(devCode);
                      handleConfirm(devCode);
                    }}
                    className="self-center bg-primary-light px-3 py-1.5 rounded-pill active:opacity-85"
                  >
                    <Text className="text-xs font-bold text-primary">Тестовый код (dev): {devCode}</Text>
                  </Pressable>
                ) : null}

                <Pressable disabled={seconds > 0} onPress={handleRequestCode} className="py-2">
                  <Text
                    className={cn(
                      'text-center text-base font-semibold',
                      seconds > 0 ? 'text-ink-muted' : 'text-primary active:opacity-80',
                    )}
                  >
                    {seconds > 0
                      ? `Отправить код повторно через ${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(
                          seconds % 60,
                        ).padStart(2, '0')}`
                      : 'Отправить код повторно'}
                  </Text>
                </Pressable>
              </View>
            ) : null}

            {/* Step 5: Success */}
            {step === 'success' ? (
              <View className="items-center justify-center py-10 gap-4">
                <View className="h-16 w-16 items-center justify-center rounded-full bg-successLight">
                  <Ionicons name="checkmark-circle-outline" size={44} color={palette.success} />
                </View>
                <View className="gap-2 items-center">
                  <Text className="text-xl font-extrabold text-ink">Профиль успешно удален</Text>
                  <Text className="text-sm text-ink-secondary text-center px-6 leading-5">
                    Ваши персональные данные обезличены. Вы будете разлогинены.
                  </Text>
                </View>
              </View>
            ) : null}
          </ScrollView>

          {/* Hidden input for verification */}
          {step === 'verify_code' ? (
            <TextInput
              ref={hiddenInputRef}
              value={code}
              onChangeText={(t) => {
                const clean = t.replace(/\D/g, '').slice(0, CODE_LENGTH);
                setCode(clean);
                if (clean.length === CODE_LENGTH) {
                  handleConfirm(clean);
                }
              }}
              keyboardType="number-pad"
              maxLength={CODE_LENGTH}
              caretHidden
              className="absolute h-px w-px opacity-0"
              style={{ top: -100 }}
            />
          ) : null}

          {/* Footer action buttons */}
          <View className="flex-row gap-3 pt-2">
            {step !== 'success' ? (
              <>
                {step === 'checking' && (
                  <Button
                    label="Отмена"
                    variant="secondary"
                    size="md"
                    className="w-full"
                    onPress={handleClose}
                  />
                )}
                {step === 'active_bookings_blocked' && (
                  <Button
                    label="Понятно"
                    size="md"
                    className="w-full"
                    onPress={handleClose}
                  />
                )}
                {step === 'confirm_warning' && (
                  <>
                    <Button
                      label="Отмена"
                      variant="secondary"
                      size="md"
                      className="flex-1"
                      onPress={handleClose}
                    />
                    <Button
                      label="Отправить код"
                      size="md"
                      className="flex-1"
                      loading={requestCode.isPending}
                      onPress={handleRequestCode}
                    />
                  </>
                )}
                {step === 'verify_code' && (
                  <>
                    <Button
                      label="Начать заново"
                      variant="secondary"
                      size="md"
                      className="flex-1"
                      onPress={handleReset}
                    />
                    <Button
                      label="Подтвердить"
                      size="md"
                      className="flex-1"
                      disabled={code.length < CODE_LENGTH}
                      loading={confirmDelete.isPending}
                      onPress={() => handleConfirm(code)}
                    />
                  </>
                )}
              </>
            ) : null}
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
