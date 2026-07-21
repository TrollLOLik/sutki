import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, Text, TextInput, View, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';

import { Button } from '@/components/ui';
import {
  useRequestOldEmailCode,
  useVerifyOldEmailCode,
  useRequestNewEmailCode,
  useConfirmEmailChange,
} from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';
import { cn } from '@/lib/cn';
import { useSessionStore } from '@/store/session';
import { radii } from '@/theme/tokens';
import { useAppTheme } from '@/theme/useAppTheme';

const CODE_LENGTH = 6;

interface EmailChangeSheetProps {
  visible: boolean;
  onClose: () => void;
}

type Step = 'verify_old' | 'input_new' | 'verify_new' | 'success';

function maskEmail(email?: string): string {
  if (!email) return '';
  const [local, domain] = email.split('@');
  if (!local || !domain) return email;
  if (local.length <= 2) {
    return `${local[0]}***@${domain}`;
  }
  return `${local[0]}${'*'.repeat(Math.min(6, local.length - 2))}${local[local.length - 1]}@${domain}`;
}

function translateError(msg: string): string {
  const clean = msg.toLowerCase().trim();
  if (clean.includes('already taken') || clean.includes('taken')) {
    return 'Этот адрес электронной почты уже используется другим аккаунтом.';
  }
  if (clean.includes('invalid email')) {
    return 'Некорректный формат адреса электронной почты.';
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
  if (clean.includes('token')) {
    return 'Сессия смены почты недействительна или истекла. Начните заново.';
  }
  if (clean.includes('unauthorized')) {
    return 'Время сессии истекло. Пожалуйста, авторизуйтесь заново.';
  }
  if (clean.includes('internal error')) {
    return 'Произошла внутренняя ошибка сервера. Пожалуйста, попробуйте позже.';
  }
  return msg;
}

export function EmailChangeSheet({ visible, onClose }: EmailChangeSheetProps) {
  const { palette } = useAppTheme();
  const user = useSessionStore((s) => s.user);
  const setUser = useSessionStore((s) => s.setUser);

  const hasCurrentEmail = !!user?.email;

  const [step, setStep] = useState<Step>(() => {
    return user?.email ? 'verify_old' : 'input_new';
  });
  
  // Forms & values
  const [codeOld, setCodeOld] = useState('');
  const [codeNew, setCodeNew] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [tempToken, setTempToken] = useState('');

  // Dev codes (for local testing when SMTP isn't configured)
  const [devCodeOld, setDevCodeOld] = useState<string | null>(null);
  const [devCodeNew, setDevCodeNew] = useState<string | null>(null);

  // Timers
  const [secondsOld, setSecondsOld] = useState(0);
  const [secondsNew, setSecondsNew] = useState(0);

  // Errors & loading
  const [codeSentOld, setCodeSentOld] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localEmailError, setLocalEmailError] = useState<string | null>(null);

  // Mutations
  const requestOld = useRequestOldEmailCode();
  const verifyOld = useVerifyOldEmailCode();
  const requestNew = useRequestNewEmailCode();
  const confirmChange = useConfirmEmailChange();

  // Animation values
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(600)).current;

  // Input refs for automatic focus
  const hiddenInputRef = useRef<TextInput>(null);
  const emailInputRef = useRef<TextInput>(null);

  // Timers countdown
  useEffect(() => {
    if (secondsOld <= 0) return;
    const id = setInterval(() => setSecondsOld((s) => s - 1), 1000);
    return () => clearInterval(id);
  }, [secondsOld]);

  useEffect(() => {
    if (secondsNew <= 0) return;
    const id = setInterval(() => setSecondsNew((s) => s - 1), 1000);
    return () => clearInterval(id);
  }, [secondsNew]);

  // Open/Reset animations and values
  useEffect(() => {
    if (visible) {
      // Always reset the session state when opening the sheet to start fresh
      setStep(hasCurrentEmail ? 'verify_old' : 'input_new');
      setCodeOld('');
      setCodeNew('');
      setNewEmail('');
      setTempToken('');
      setDevCodeOld(null);
      setDevCodeNew(null);
      setSecondsOld(0);
      setSecondsNew(0);
      setCodeSentOld(false);
      setError(null);
      setLocalEmailError(null);

      fade.setValue(0);
      slide.setValue(600);

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
        ]).start();
      });
    }
  }, [visible]);

  // Auto-focus inputs on step change
  useEffect(() => {
    if (!visible) return;
    if (step === 'verify_old') {
      if (codeSentOld) {
        const t = setTimeout(() => hiddenInputRef.current?.focus(), 350);
        return () => clearTimeout(t);
      }
    } else if (step === 'verify_new') {
      const t = setTimeout(() => hiddenInputRef.current?.focus(), 350);
      return () => clearTimeout(t);
    } else if (step === 'input_new') {
      const t = setTimeout(() => emailInputRef.current?.focus(), 350);
      return () => clearTimeout(t);
    }
  }, [step, codeSentOld, visible]);

  const handleClose = () => {
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

  const handleRequestOldCode = async () => {
    setError(null);
    try {
      const res = await requestOld.mutateAsync();
      setSecondsOld(60);
      if (res.dev_code) {
        setDevCodeOld(res.dev_code);
      }
      setCodeSentOld(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось отправить код подтверждения.');
    }
  };

  const handleVerifyOld = async (enteredCode: string) => {
    setError(null);
    try {
      const res = await verifyOld.mutateAsync(enteredCode);
      setTempToken(res.temp_token);
      setStep('input_new');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Неверный код подтверждения.');
    }
  };

  const handleRequestNewCode = async () => {
    setLocalEmailError(null);
    setError(null);
    const trimmed = newEmail.trim();
    if (!trimmed) {
      setLocalEmailError('Введите новый email');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      setLocalEmailError('Некорректный формат email');
      return;
    }
    if (trimmed.toLowerCase() === user?.email.toLowerCase()) {
      setLocalEmailError('Новый email совпадает с текущим');
      return;
    }

    try {
      const res = await requestNew.mutateAsync({ tempToken, newEmail: trimmed });
      setSecondsNew(60);
      if (res.dev_code) {
        setDevCodeNew(res.dev_code);
      }
      setStep('verify_new');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось отправить код на новую почту.');
    }
  };

  const handleConfirm = async (enteredCode: string) => {
    setError(null);
    try {
      const updatedUser = await confirmChange.mutateAsync({ newEmail: newEmail.trim(), code: enteredCode });
      setUser(updatedUser);
      setStep('success');
      setTimeout(() => {
        handleClose();
      }, 2000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Неверный код подтверждения.');
    }
  };

  const handleReset = () => {
    setStep(hasCurrentEmail ? 'verify_old' : 'input_new');
    setCodeOld('');
    setCodeNew('');
    setNewEmail('');
    setTempToken('');
    setDevCodeOld(null);
    setDevCodeNew(null);
    setSecondsOld(0);
    setSecondsNew(0);
    setCodeSentOld(false);
    setError(null);
    setLocalEmailError(null);
  };

  if (!visible) return null;

  const stepIndex = step === 'verify_old' ? 1 : step === 'input_new' ? (hasCurrentEmail ? 2 : 1) : (hasCurrentEmail ? 3 : 2);

  const leftButtonLabel = ((step === 'verify_old' && !codeSentOld) || (step === 'input_new' && !hasCurrentEmail))
    ? 'Закрыть'
    : 'Сбросить';

  const handleLeftButtonPress = ((step === 'verify_old' && !codeSentOld) || (step === 'input_new' && !hasCurrentEmail))
    ? handleClose
    : handleReset;

  return (
    <Modal visible transparent animationType="none" onRequestClose={handleClose}>
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
            height: '72%', // Keep sheet fixed tall to prevent keyboard squishing
          }}
          className="px-4 pb-8 pt-4"
        >
          {/* Top drag handle indicator */}
          <View className="items-center pb-4">
            <View className="h-1 w-12 rounded-full bg-line mb-3" />
            <Text className="text-lg font-extrabold text-ink">
              {step === 'verify_old' && 'Подтверждение текущей почты'}
              {step === 'input_new' && 'Новый адрес почты'}
              {step === 'verify_new' && 'Подтверждение новой почты'}
              {step === 'success' && 'Успешно'}
            </Text>
          </View>

          {/* Stepper bar */}
          {step !== 'success' ? (
            <View className="flex-row gap-2 mb-4 px-4">
              {hasCurrentEmail ? (
                <>
                  <View className={cn('h-1 flex-1 rounded-full', stepIndex >= 1 ? 'bg-primary' : 'bg-line')} />
                  <View className={cn('h-1 flex-1 rounded-full', stepIndex >= 2 ? 'bg-primary' : 'bg-line')} />
                  <View className={cn('h-1 flex-1 rounded-full', stepIndex >= 3 ? 'bg-primary' : 'bg-line')} />
                </>
              ) : (
                <>
                  <View className={cn('h-1 flex-1 rounded-full', stepIndex >= 1 ? 'bg-primary' : 'bg-line')} />
                  <View className={cn('h-1 flex-1 rounded-full', stepIndex >= 2 ? 'bg-primary' : 'bg-line')} />
                </>
              )}
            </View>
          ) : null}

          {/* Error display */}
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
            {/* Step 1: Verify current email */}
            {step === 'verify_old' ? (
              <View className="gap-5">
                {!codeSentOld ? (
                  <View className="gap-5 py-4">
                    <Text className="text-base text-ink-secondary text-center px-4 leading-6">
                      Для смены почты необходимо подтвердить владение аккаунтом.{'\n\n'}
                      Мы отправим код подтверждения на текущую почту:{'\n'}
                      <Text className="font-bold text-ink">{maskEmail(user?.email)}</Text>
                    </Text>
                    <Button
                      label="Отправить код"
                      loading={requestOld.isPending}
                      onPress={handleRequestOldCode}
                      className="mt-2"
                    />
                  </View>
                ) : (
                  <View className="gap-5">
                    <Text className="text-base text-ink-secondary text-center px-4 leading-6">
                      Мы отправили код подтверждения на вашу текущую почту:{'\n'}
                      <Text className="font-bold text-ink">{maskEmail(user?.email)}</Text>
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
                            codeOld.length === i ? 'border-primary border-2 bg-surface' : 'border-line',
                          )}
                        >
                          <Text className="text-2xl font-extrabold text-ink">{codeOld[i] ?? ''}</Text>
                        </View>
                      ))}
                    </Pressable>

                    {devCodeOld ? (
                      <Pressable
                        onPress={() => {
                          setCodeOld(devCodeOld);
                          handleVerifyOld(devCodeOld);
                        }}
                        className="self-center bg-primary-light px-3 py-1.5 rounded-pill active:opacity-85"
                      >
                        <Text className="text-xs font-bold text-primary">Тестовый код (dev): {devCodeOld}</Text>
                      </Pressable>
                    ) : null}

                    <Pressable disabled={secondsOld > 0} onPress={handleRequestOldCode} className="py-2">
                      <Text
                        className={cn(
                          'text-center text-base font-semibold',
                          secondsOld > 0 ? 'text-ink-muted' : 'text-primary active:opacity-80',
                        )}
                      >
                        {secondsOld > 0
                          ? `Отправить код повторно через ${String(Math.floor(secondsOld / 60)).padStart(2, '0')}:${String(
                              secondsOld % 60,
                            ).padStart(2, '0')}`
                          : 'Отправить код повторно'}
                      </Text>
                    </Pressable>
                  </View>
                )}
              </View>
            ) : null}

            {/* Step 2: Input new email */}
            {step === 'input_new' ? (
              <View className="gap-5">
                <Text className="text-base text-ink-secondary text-center px-4 leading-6">
                  Введите новый адрес электронной почты
                </Text>

                <View className="gap-2">
                  <View
                    className={cn(
                      'h-12 flex-row items-center rounded-field border px-3 bg-surface-muted',
                      localEmailError ? 'border-danger' : 'border-line',
                    )}
                  >
                    <Ionicons name="mail-outline" size={18} color={palette.primary} />
                    <TextInput
                      ref={emailInputRef}
                      value={newEmail}
                      onChangeText={(t) => {
                        setNewEmail(t);
                        setLocalEmailError(null);
                      }}
                      placeholder="new-email@example.com"
                      placeholderTextColor={palette.inkMuted}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      className="ml-2 flex-1 text-base text-ink"
                    />
                  </View>
                  {localEmailError ? (
                    <Text className="px-1 text-xs font-semibold text-danger mt-1.5">
                      {localEmailError}
                    </Text>
                  ) : null}
                </View>
              </View>
            ) : null}

            {/* Step 3: Verify new email */}
            {step === 'verify_new' ? (
              <View className="gap-5">
                <Text className="text-base text-ink-secondary text-center px-4 leading-6">
                  Мы отправили код подтверждения на новую почту:{'\n'}
                  <Text className="font-bold text-ink">{newEmail}</Text>
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
                        codeNew.length === i ? 'border-primary border-2 bg-surface' : 'border-line',
                      )}
                    >
                      <Text className="text-2xl font-extrabold text-ink">{codeNew[i] ?? ''}</Text>
                    </View>
                  ))}
                </Pressable>

                {devCodeNew ? (
                  <Pressable
                    onPress={() => {
                      setCodeNew(devCodeNew);
                      handleConfirm(devCodeNew);
                    }}
                    className="self-center bg-primary-light px-3 py-1.5 rounded-pill active:opacity-85"
                  >
                    <Text className="text-xs font-bold text-primary">Тестовый код (dev): {devCodeNew}</Text>
                  </Pressable>
                ) : null}

                <Pressable disabled={secondsNew > 0} onPress={handleRequestNewCode} className="py-2">
                  <Text
                    className={cn(
                      'text-center text-base font-semibold',
                      secondsNew > 0 ? 'text-ink-muted' : 'text-primary active:opacity-80',
                    )}
                  >
                    {secondsNew > 0
                      ? `Отправить код повторно через ${String(Math.floor(secondsNew / 60)).padStart(2, '0')}:${String(
                          secondsNew % 60,
                        ).padStart(2, '0')}`
                      : 'Отправить код повторно'}
                  </Text>
                </Pressable>
              </View>
            ) : null}

            {/* Success screen */}
            {step === 'success' ? (
              <View className="items-center justify-center py-6 gap-4 animate-fade-in">
                <View className="h-16 w-16 items-center justify-center rounded-full bg-successLight">
                  <Ionicons name="checkmark-circle-outline" size={44} color={palette.success} />
                </View>
                <View className="gap-1 items-center">
                  <Text className="text-xl font-extrabold text-ink">Почта успешно изменена!</Text>
                  <Text className="text-sm text-ink-secondary text-center px-6 leading-5">
                    Новый адрес {newEmail} привязан к вашему аккаунту.
                  </Text>
                </View>
              </View>
            ) : null}
          </ScrollView>

          {/* Hidden inputs for code verification steps */}
          {(step === 'verify_old' || step === 'verify_new') ? (
            <TextInput
              ref={hiddenInputRef}
              value={step === 'verify_old' ? codeOld : codeNew}
              onChangeText={(t) => {
                const clean = t.replace(/\D/g, '').slice(0, CODE_LENGTH);
                if (step === 'verify_old') {
                  setCodeOld(clean);
                  if (clean.length === CODE_LENGTH) {
                    handleVerifyOld(clean);
                  }
                } else {
                  setCodeNew(clean);
                  if (clean.length === CODE_LENGTH) {
                    handleConfirm(clean);
                  }
                }
              }}
              keyboardType="number-pad"
              maxLength={CODE_LENGTH}
              caretHidden
              className="absolute h-px w-px opacity-0"
              style={{ top: -100 }}
            />
          ) : null}

          {/* Action buttons footer */}
          <View className="flex-row gap-3 pt-2">
            {step !== 'success' ? (
              <>
                {step === 'verify_old' && !codeSentOld ? (
                  <Button
                    label="Закрыть"
                    variant="secondary"
                    size="md"
                    className="w-full"
                    onPress={handleClose}
                  />
                ) : (
                  <>
                    <Button
                      label={leftButtonLabel}
                      variant="secondary"
                      size="md"
                      className="flex-1"
                      onPress={handleLeftButtonPress}
                    />
                    {step === 'verify_old' ? (
                      <Button
                        label="Подтвердить"
                        size="md"
                        className="flex-1"
                        disabled={codeOld.length < CODE_LENGTH}
                        loading={verifyOld.isPending}
                        onPress={() => handleVerifyOld(codeOld)}
                      />
                    ) : step === 'input_new' ? (
                      <Button
                        label="Получить код"
                        size="md"
                        className="flex-1"
                        loading={requestNew.isPending}
                        onPress={handleRequestNewCode}
                      />
                    ) : step === 'verify_new' ? (
                      <Button
                        label="Подтвердить"
                        size="md"
                        className="flex-1"
                        disabled={codeNew.length < CODE_LENGTH}
                        loading={confirmChange.isPending}
                        onPress={() => handleConfirm(codeNew)}
                      />
                    ) : null}
                  </>
                )}
              </>
            ) : (
              <Button label="Отлично" size="md" className="w-full" onPress={handleClose} />
            )}
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
