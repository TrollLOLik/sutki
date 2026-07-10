import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, Text, TextInput, View, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';

import { Button } from '@/components/ui';
import { PhoneInput } from '@/components/PhoneInput';
import {
  useRequestChangePhoneCode,
  requestChangePhoneVoiceFallback,
  useConfirmPhoneChange,
} from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';
import { cn } from '@/lib/cn';
import { useSessionStore } from '@/store/session';
import { radii } from '@/theme/tokens';
import { useAppTheme } from '@/theme/useAppTheme';
import { toFullPhone, normalizePhoneDigits, formatPhoneMask } from '@/lib/phone';

const DEFAULT_CODE_LENGTH = 4;

interface PhoneChangeSheetProps {
  visible: boolean;
  onClose: () => void;
}

type Step = 'input_phone' | 'verify_code' | 'success';

function translateError(msg: string): string {
  const clean = msg.toLowerCase().trim();
  if (clean.includes('already taken') || clean.includes('taken')) {
    return 'Этот номер телефона уже используется другим аккаунтом.';
  }
  if (clean.includes('already linked') || clean.includes('linked')) {
    return 'Этот номер телефона уже привязан к вашему аккаунту.';
  }
  if (clean.includes('invalid phone') || clean.includes('format')) {
    return 'Некорректный формат номера телефона. Используйте +7 или 8.';
  }
  if (clean.includes('invalid code') || clean.includes('code invalid')) {
    return 'Неверный код подтверждения. Пожалуйста, проверьте и введите еще раз.';
  }
  if (clean.includes('expired')) {
    return 'Срок действия кода подтверждения истек. Запросите код повторно.';
  }
  if (clean.includes('too many attempts') || clean.includes('many attempts')) {
    return 'Превышено количество попыток ввода. Повторный запрос доступен позже.';
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

export function PhoneChangeSheet({ visible, onClose }: PhoneChangeSheetProps) {
  const { palette } = useAppTheme();
  const user = useSessionStore((s) => s.user);
  const setUser = useSessionStore((s) => s.setUser);

  const [step, setStep] = useState<Step>('input_phone');
  
  // Forms & values
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [mode, setMode] = useState('flash_call');
  const [challengeId, setChallengeId] = useState('');
  const [codeLength, setCodeLength] = useState(DEFAULT_CODE_LENGTH);

  // Dev codes are returned only when AUTH_EXPOSE_CODE is enabled locally.
  const [devCode, setDevCode] = useState<string | null>(null);

  // Timers
  const [seconds, setSeconds] = useState(0);

  // Errors & loading
  const [error, setError] = useState<string | null>(null);
  const [localPhoneError, setLocalPhoneError] = useState<string | null>(null);

  // Mutations
  const requestChangeCode = useRequestChangePhoneCode();
  const confirmChange = useConfirmPhoneChange();

  // Animation values
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(600)).current;

  // Input refs
  const hiddenInputRef = useRef<TextInput>(null);

  // Timer countdown
  useEffect(() => {
    if (seconds <= 0) return;
    const id = setInterval(() => setSeconds((s) => s - 1), 1000);
    return () => clearInterval(id);
  }, [seconds]);

  // Open/Reset animations
  useEffect(() => {
    if (visible) {
      // Pre-fill phone if user has unverified phone
      setPhone(user?.phone ? formatPhoneMask(normalizePhoneDigits(user.phone)) : '');
      setStep('input_phone');
      setCode('');
      setMode('flash_call');
      setChallengeId('');
      setCodeLength(DEFAULT_CODE_LENGTH);
      setDevCode(null);
      setSeconds(0);
      setError(null);
      setLocalPhoneError(null);

      fade.setValue(0);
      slide.setValue(600);

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

  // Auto-focus inputs
  useEffect(() => {
    if (!visible) return;
    if (step === 'verify_code') {
      const t = setTimeout(() => hiddenInputRef.current?.focus(), 350);
      return () => clearTimeout(t);
    }
  }, [step, visible]);

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

  const handleRequestCode = async () => {
    setLocalPhoneError(null);
    setError(null);
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length !== 10) {
      setLocalPhoneError('Укажите полный номер телефона (10 цифр)');
      return;
    }

    const fullPhone = toFullPhone(phone);
    try {
      const res = await requestChangeCode.mutateAsync({ phone: fullPhone });
      setSeconds(res.retry_after ?? 60);
      setMode(res.delivery_mode ?? 'flash_call');
      setChallengeId(res.challenge_id ?? '');
      setCodeLength(res.code_length ?? DEFAULT_CODE_LENGTH);
      if (res.dev_code) {
        setDevCode(res.dev_code);
      }
      setStep('verify_code');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось отправить код подтверждения.');
    }
  };

  const handleVoiceFallback = async () => {
    if (!challengeId) return;
    setError(null);
    try {
      const res = await requestChangePhoneVoiceFallback(toFullPhone(phone), challengeId);
      setSeconds(res.retry_after ?? 60);
      setMode(res.delivery_mode ?? 'voice');
      setCodeLength(res.code_length ?? DEFAULT_CODE_LENGTH);
      setCode('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось запустить голосовой звонок.');
    }
  };

  const handleConfirm = async (enteredCode: string) => {
    setError(null);
    const fullPhone = toFullPhone(phone);
    try {
      const updatedUser = await confirmChange.mutateAsync({ phone: fullPhone, code: enteredCode, challengeId });
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
    setStep('input_phone');
    setCode('');
    setMode('flash_call');
    setChallengeId('');
    setCodeLength(DEFAULT_CODE_LENGTH);
    setDevCode(null);
    setSeconds(0);
    setError(null);
    setLocalPhoneError(null);
  };

  if (!visible) return null;

  const stepIndex = step === 'input_phone' ? 1 : 2;

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
            height: '72%',
          }}
          className="px-4 pb-8 pt-4"
        >
          {/* Top drag handle indicator */}
          <View className="items-center pb-4">
            <View className="h-1 w-12 rounded-full bg-line mb-3" />
            <Text className="text-lg font-extrabold text-ink">
              {step === 'input_phone' && 'Подтверждение телефона'}
              {step === 'verify_code' && 'Ввод кода подтверждения'}
              {step === 'success' && 'Успешно'}
            </Text>
          </View>

          {/* Stepper bar */}
          {step !== 'success' ? (
            <View className="flex-row gap-2 mb-4 px-4">
              <View className={cn('h-1 flex-1 rounded-full', stepIndex >= 1 ? 'bg-primary' : 'bg-line')} />
              <View className={cn('h-1 flex-1 rounded-full', stepIndex >= 2 ? 'bg-primary' : 'bg-line')} />
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
            {/* Step 1: Input phone number */}
            {step === 'input_phone' ? (
              <View className="gap-5">
                <Text className="text-base text-ink-secondary text-center px-4 leading-6">
                  Укажите номер телефона. Мы позвоним вам для подтверждения номера.
                </Text>

                <PhoneInput
                  value={phone}
                  onChange={(v) => {
                    setPhone(v);
                    setLocalPhoneError(null);
                  }}
                  error={localPhoneError ?? undefined}
                />
              </View>
            ) : null}

            {/* Step 2: Verify code */}
            {step === 'verify_code' ? (
              <View className="gap-5">
                <Text className="text-base text-ink-secondary text-center px-4 leading-6">
                  {mode === 'flash_call'
                    ? `Вам поступит звонок-сброс на номер +7 ${phone}. Код подтверждения — последние ${codeLength} цифры входящего номера.`
                    : `Робот позвонит на номер +7 ${phone} и продиктует ${codeLength}-значный код подтверждения.`}
                </Text>

                <Pressable
                  className="flex-row justify-center gap-2 py-2"
                  onPress={() => hiddenInputRef.current?.focus()}
                >
                  {Array.from({ length: codeLength }).map((_, i) => (
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



                <Pressable disabled={seconds > 0} onPress={handleRequestCode} className="py-2">
                  <Text
                    className={cn(
                      'text-center text-base font-semibold',
                      seconds > 0 ? 'text-ink-muted' : 'text-primary active:opacity-80',
                    )}
                  >
                    {seconds > 0
                      ? `Запросить повторно через ${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(
                          seconds % 60,
                        ).padStart(2, '0')}`
                      : 'Запросить повторно'}
                  </Text>
                </Pressable>

                {mode === 'flash_call' && (
                  <Pressable onPress={handleVoiceFallback}>
                    <Text className="text-center text-base text-primary font-medium">
                      Не пришел звонок? Позвонить голосом
                    </Text>
                  </Pressable>
                )}
              </View>
            ) : null}

            {/* Success screen */}
            {step === 'success' ? (
              <View className="items-center justify-center py-6 gap-4 animate-fade-in">
                <View className="h-16 w-16 items-center justify-center rounded-full bg-successLight">
                  <Ionicons name="checkmark-circle-outline" size={44} color={palette.success} />
                </View>
                <View className="gap-1 items-center">
                  <Text className="text-xl font-extrabold text-ink">Номер успешно подтвержден!</Text>
                  <Text className="text-sm text-ink-secondary text-center px-6 leading-5">
                    Телефон +7 {phone} привязан к вашему аккаунту. Все гостевые бронирования линкованы.
                  </Text>
                </View>
              </View>
            ) : null}
          </ScrollView>

          {/* Hidden input for code verification */}
          {step === 'verify_code' ? (
            <TextInput
              ref={hiddenInputRef}
              value={code}
              onChangeText={(t) => {
                const clean = t.replace(/\D/g, '').slice(0, codeLength);
                setCode(clean);
                if (clean.length === codeLength) {
                  handleConfirm(clean);
                }
              }}
              keyboardType="number-pad"
              maxLength={codeLength}
              caretHidden
              className="absolute h-px w-px opacity-0"
              style={{ top: -100 }}
            />
          ) : null}

          {/* Action buttons footer */}
          <View className="flex-row gap-3 pt-2">
            {step !== 'success' ? (
              <>
                {step === 'input_phone' ? (
                  <>
                    <Button
                      label="Закрыть"
                      variant="secondary"
                      size="md"
                      className="flex-1"
                      onPress={handleClose}
                    />
                    <Button
                      label="Получить звонок"
                      size="md"
                      className="flex-1"
                      loading={requestChangeCode.isPending}
                      onPress={handleRequestCode}
                    />
                  </>
                ) : (
                  <>
                    <Button
                      label="Назад"
                      variant="secondary"
                      size="md"
                      className="flex-1"
                      onPress={handleReset}
                    />
                    <Button
                      label="Подтвердить"
                      size="md"
                      className="flex-1"
                      disabled={code.length < codeLength}
                      loading={confirmChange.isPending}
                      onPress={() => handleConfirm(code)}
                    />
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
