import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { PhoneInput } from '@/components/PhoneInput';
import { BottomSheet, Button, MaterialSurface } from '@/components/ui';
import {
  requestChangePhoneVoiceFallback,
  requestReauthCode,
  requestReauthVoiceFallback,
  useConfirmPhoneChange,
  useRequestChangePhoneCode,
  verifyReauthCode,
} from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';
import { cn } from '@/lib/cn';
import { formatPhoneMask, normalizePhoneDigits, toFullPhone } from '@/lib/phone';
import { useSessionStore } from '@/store/session';
import { useAppTheme } from '@/theme/useAppTheme';

const DEFAULT_CODE_LENGTH = 4;
const EMAIL_CODE_LENGTH = 6;

interface PhoneChangeSheetProps {
  visible: boolean;
  onClose: () => void;
}

/**
 * 'reauth' proves the user still controls the factor already on the account
 * before they may rebind the phone. It is not optional UX politeness: the
 * backend answers 403 to change-phone/request without the proof token this
 * step produces, because a session alone is not enough to hand over the
 * credential that grants passwordless login.
 */
type Step = 'reauth' | 'input_phone' | 'verify_code' | 'success';

function translateError(message: string): string {
  const clean = message.toLowerCase().trim();
  if (clean.includes('already taken') || clean.includes('taken')) {
    return 'Этот номер телефона уже используется другим аккаунтом.';
  }
  if (clean.includes('already linked') || clean.includes('linked')) {
    return 'Этот номер телефона уже привязан к вашему аккаунту.';
  }
  if (clean.includes('invalid phone') || clean.includes('format')) {
    return 'Некорректный формат номера телефона. Используйте российский номер.';
  }
  if (clean.includes('invalid code') || clean.includes('code invalid')) {
    return 'Неверный код подтверждения. Проверьте цифры и попробуйте снова.';
  }
  if (clean.includes('expired')) {
    return 'Срок действия кода истёк. Запросите новый звонок.';
  }
  if (clean.includes('too many attempts') || clean.includes('many attempts')) {
    return 'Превышено количество попыток. Повторите позже.';
  }
  if (clean.includes('wait before') || clean.includes('too soon')) {
    return 'Подождите немного перед повторным запросом.';
  }
  if (clean.includes('unauthorized')) {
    return 'Сессия завершилась. Войдите в аккаунт заново.';
  }
  if (clean.includes('reauthentication required') || clean.includes('подтвердите текущий')) {
    return 'Подтверждение устарело. Начните заново.';
  }
  if (clean.includes('no factor available') || clean.includes('не привязан контакт')) {
    return 'К аккаунту не привязан контакт для подтверждения. Обратитесь в поддержку.';
  }
  if (clean.includes('internal error')) {
    return 'Сервис временно недоступен. Попробуйте позже.';
  }
  return message;
}

function formatCountdown(seconds: number) {
  const minutes = String(Math.floor(seconds / 60)).padStart(2, '0');
  const remainder = String(seconds % 60).padStart(2, '0');
  return `${minutes}:${remainder}`;
}

export function PhoneChangeSheet({ visible, onClose }: PhoneChangeSheetProps) {
  const { palette } = useAppTheme();
  const user = useSessionStore((state) => state.user);
  const setUser = useSessionStore((state) => state.setUser);

  const [step, setStep] = useState<Step>('reauth');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [mode, setMode] = useState('flash_call');
  const [challengeId, setChallengeId] = useState('');
  const [codeLength, setCodeLength] = useState(DEFAULT_CODE_LENGTH);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [localPhoneError, setLocalPhoneError] = useState<string | null>(null);

  // Proof that the current factor was just verified. Every request below sends
  // it; the backend re-checks it at both the request and the confirm step.
  const [tempToken, setTempToken] = useState('');
  const [reauthFactor, setReauthFactor] = useState<'phone' | 'email' | null>(null);
  const [reauthPending, setReauthPending] = useState(false);
  const [verifyingReauth, setVerifyingReauth] = useState(false);
  // Only true once a challenge actually came back, so the code boxes are never
  // rendered against a stale/default length.
  const [reauthSent, setReauthSent] = useState(false);

  const requestChangeCode = useRequestChangePhoneCode();
  const confirmChange = useConfirmPhoneChange();
  const hiddenInputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (seconds <= 0) return;
    const timer = setInterval(() => setSeconds((value) => value - 1), 1000);
    return () => clearInterval(timer);
  }, [seconds]);

  const startReauth = async () => {
    setError(null);
    setReauthPending(true);
    try {
      const response = await requestReauthCode('change_phone');
      // Only the success path touches these. A failed request (the 60s resend
      // cooldown returns 429, which is easy to hit by reopening the sheet)
      // must not leave the screen rendering 4 boxes for a 6-digit email code.
      setReauthFactor(response.factor);
      setChallengeId(response.challenge_id ?? '');
      setMode(response.delivery_mode ?? 'flash_call');
      setCodeLength(
        response.factor === 'email'
          ? EMAIL_CODE_LENGTH
          : (response.code_length ?? DEFAULT_CODE_LENGTH),
      );
      setSeconds(response.retry_after ?? 60);
      setCode('');
      setReauthSent(true);
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : 'Не удалось отправить код подтверждения.',
      );
    } finally {
      setReauthPending(false);
    }
  };

  useEffect(() => {
    if (!visible) return;
    setPhone(user?.phone ? formatPhoneMask(normalizePhoneDigits(user.phone)) : '');
    setStep('reauth');
    setCode('');
    setMode('flash_call');
    setChallengeId('');
    setCodeLength(DEFAULT_CODE_LENGTH);
    setSeconds(0);
    setError(null);
    setLocalPhoneError(null);
    setTempToken('');
    setReauthFactor(null);
    setReauthSent(false);
    void startReauth();
    // Deliberately keyed on `visible` alone. Depending on user?.phone would
    // re-run this when handleConfirm calls setUser() with the freshly bound
    // number: the success screen would be replaced by a restarted re-auth and
    // the provider would place another billable call.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => {
    if (!visible || (step !== 'verify_code' && step !== 'reauth')) return;
    const timer = setTimeout(() => hiddenInputRef.current?.focus(), 350);
    return () => clearTimeout(timer);
    // reauthSent is in the deps because the hidden input only mounts once the
    // challenge comes back; without it the focus timer fires against a null ref
    // while the request is still in flight and the keypad never opens.
  }, [step, visible, reauthSent]);

  const handleVerifyReauth = async (enteredCode: string) => {
    if (enteredCode.length !== codeLength || verifyingReauth) return;
    setError(null);
    setVerifyingReauth(true);
    try {
      const { temp_token } = await verifyReauthCode(enteredCode);
      setTempToken(temp_token);
      setStep('input_phone');
      setCode('');
      setChallengeId('');
      setMode('flash_call');
      setCodeLength(DEFAULT_CODE_LENGTH);
      setSeconds(0);
    } catch (verifyError) {
      setError(
        verifyError instanceof ApiError
          ? verifyError.message
          : 'Не удалось подтвердить код.',
      );
      setCode('');
      setTimeout(() => hiddenInputRef.current?.focus(), 120);
    } finally {
      setVerifyingReauth(false);
    }
  };

  const handleReauthVoiceFallback = async () => {
    // Gated on the local flag, not on a challenge id: the server resolves which
    // challenge to re-deliver from the attempt it recorded.
    if (!reauthSent) return;
    setError(null);
    try {
      const response = await requestReauthVoiceFallback();
      setSeconds(response.retry_after ?? 60);
      setMode(response.delivery_mode ?? 'voice');
      setCodeLength(response.code_length ?? DEFAULT_CODE_LENGTH);
      setCode('');
      setTimeout(() => hiddenInputRef.current?.focus(), 120);
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : 'Не удалось запустить голосовой звонок.',
      );
    }
  };

  const handleRequestCode = async () => {
    setError(null);
    setLocalPhoneError(null);
    if (phone.replace(/\D/g, '').length !== 10) {
      setLocalPhoneError('Укажите полный номер телефона');
      return;
    }

    try {
      const response = await requestChangeCode.mutateAsync({
        phone: toFullPhone(phone),
        tempToken,
      });
      setSeconds(response.retry_after ?? 60);
      setMode(response.delivery_mode ?? 'flash_call');
      setChallengeId(response.challenge_id ?? '');
      setCodeLength(response.code_length ?? DEFAULT_CODE_LENGTH);
      setCode('');
      setStep('verify_code');
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : 'Не удалось заказать звонок. Попробуйте ещё раз.',
      );
    }
  };

  const handleVoiceFallback = async () => {
    if (!challengeId) return;
    setError(null);
    try {
      const response = await requestChangePhoneVoiceFallback(toFullPhone(phone), challengeId);
      setSeconds(response.retry_after ?? 60);
      setMode(response.delivery_mode ?? 'voice');
      setCodeLength(response.code_length ?? DEFAULT_CODE_LENGTH);
      setCode('');
      setTimeout(() => hiddenInputRef.current?.focus(), 120);
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : 'Не удалось запустить голосовой звонок.',
      );
    }
  };

  const handleConfirm = async (enteredCode: string) => {
    if (enteredCode.length !== codeLength || confirmChange.isPending) return;
    setError(null);
    try {
      const updatedUser = await confirmChange.mutateAsync({
        phone: toFullPhone(phone),
        code: enteredCode,
        challengeId,
        tempToken,
      });
      setUser(updatedUser);
      setStep('success');
      setTimeout(onClose, 1500);
    } catch (confirmError) {
      setError(
        confirmError instanceof ApiError
          ? confirmError.message
          : 'Не удалось подтвердить номер.',
      );
      setCode('');
      setTimeout(() => hiddenInputRef.current?.focus(), 120);
    }
  };

  const handleReset = () => {
    setStep('input_phone');
    setCode('');
    setMode('flash_call');
    setChallengeId('');
    setCodeLength(DEFAULT_CODE_LENGTH);
    setSeconds(0);
    setError(null);
    setLocalPhoneError(null);
  };

  const reauthSubtitle =
    reauthFactor === 'email'
      ? 'Отправили код на почту, указанную в аккаунте'
      : mode === 'flash_call'
        ? `Звоним на ваш текущий номер — введите последние ${codeLength} цифры`
        : `Введите ${codeLength}-значный код, который продиктует робот`;

  const title =
    step === 'reauth'
      ? 'Подтвердите, что это вы'
      : step === 'input_phone'
        ? 'Номер телефона'
        : step === 'verify_code'
          ? 'Подтвердите номер'
          : 'Номер подтверждён';
  const subtitle =
    step === 'reauth'
      ? reauthSubtitle
      : step === 'input_phone'
        ? 'Позвоним на номер и покажем код без SMS'
        : step === 'verify_code'
          ? mode === 'flash_call'
            ? `Введите последние ${codeLength} цифры входящего номера`
            : `Введите ${codeLength}-значный код, который продиктует робот`
          : 'Телефон привязан к вашему аккаунту';

  return (
    <BottomSheet visible={visible} onClose={onClose} height={630}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}>
        <View style={{ flex: 1 }}>
          <View className="flex-row items-center gap-3">
            <View className="h-12 w-12 items-center justify-center rounded-full bg-primary-light">
              <Ionicons
                name={
                  step === 'success'
                    ? 'checkmark'
                    : step === 'reauth'
                      ? 'shield-checkmark-outline'
                      : 'call-outline'
                }
                size={24}
                color={step === 'success' ? palette.success : palette.primary}
              />
            </View>
            <View className="flex-1">
              <Text className="text-xl font-extrabold text-ink">{title}</Text>
              <Text className="mt-1 text-sm leading-5 text-ink-secondary">{subtitle}</Text>
            </View>
          </View>

          {step !== 'success' ? (
            <View className="mt-5 flex-row gap-2">
              <View className="h-1 flex-1 rounded-full bg-primary" />
              <View
                className={cn(
                  'h-1 flex-1 rounded-full',
                  step === 'input_phone' || step === 'verify_code' ? 'bg-primary' : 'bg-line',
                )}
              />
              <View className={cn('h-1 flex-1 rounded-full', step === 'verify_code' ? 'bg-primary' : 'bg-line')} />
            </View>
          ) : null}

          {error ? (
            <MaterialSurface level="raised" radius={18} style={{ marginTop: 16, padding: 14 }}>
              <View className="flex-row items-start gap-3">
                <Ionicons name="alert-circle-outline" size={20} color={palette.danger} />
                <Text className="flex-1 text-sm font-semibold leading-5 text-danger">
                  {translateError(error)}
                </Text>
              </View>
            </MaterialSurface>
          ) : null}

          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            style={{ flex: 1 }}
            contentContainerStyle={{ flexGrow: 1, paddingTop: 20, paddingBottom: 12 }}>
            {step === 'reauth' && !reauthSent ? (
              <View className="flex-1 items-center justify-center gap-4 pb-8">
                <Text className="text-center text-base leading-6 text-ink-secondary">
                  {reauthPending
                    ? 'Отправляем код подтверждения…'
                    : 'Не удалось отправить код подтверждения.'}
                </Text>
                {!reauthPending ? (
                  <Button label="Попробовать снова" size="md" onPress={() => void startReauth()} />
                ) : null}
              </View>
            ) : null}

            {step === 'reauth' && reauthSent ? (
              <View className="gap-4">
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Ввести код подтверждения личности"
                  onPress={() => hiddenInputRef.current?.focus()}
                  className="flex-row justify-center gap-2 py-1">
                  {Array.from({ length: codeLength }).map((_, index) => {
                    const active = code.length === index;
                    return (
                      <MaterialSurface
                        key={index}
                        level="raised"
                        radius={18}
                        style={{
                          height: 62,
                          flex: 1,
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderWidth: active ? 2 : 1,
                          borderColor: active ? palette.primary : palette.line,
                        }}>
                        <Text className="text-2xl font-extrabold text-ink">{code[index] ?? ''}</Text>
                      </MaterialSurface>
                    );
                  })}
                </Pressable>

                <Pressable disabled={seconds > 0 || reauthPending} onPress={() => void startReauth()} className="py-2 active:opacity-70">
                  <Text
                    className={cn(
                      'text-center text-sm font-bold',
                      seconds > 0 || reauthPending ? 'text-ink-muted' : 'text-primary',
                    )}>
                    {seconds > 0
                      ? `Отправить код повторно через ${formatCountdown(seconds)}`
                      : 'Отправить код повторно'}
                  </Text>
                </Pressable>

                {reauthFactor === 'phone' && mode === 'flash_call' ? (
                  <Pressable onPress={() => void handleReauthVoiceFallback()} className="py-2 active:opacity-70">
                    <Text className="text-center text-sm font-bold text-primary">
                      Не видно номер? Получить код голосом
                    </Text>
                  </Pressable>
                ) : null}

                <View className="mt-1 flex-row items-start gap-3 rounded-[18px] bg-primary-light p-4">
                  <Ionicons name="lock-closed-outline" size={21} color={palette.primary} />
                  <Text className="flex-1 text-sm leading-5 text-ink-secondary">
                    Номер телефона — это вход в аккаунт, поэтому меняем его только после
                    подтверждения текущего контакта. После смены остальные устройства выйдут из
                    аккаунта.
                  </Text>
                </View>
              </View>
            ) : null}

            {step === 'input_phone' ? (
              <View className="gap-3">
                <Text className="px-1 text-sm font-bold text-ink-secondary">Телефон</Text>
                <PhoneInput
                  value={phone}
                  onChange={(value) => {
                    setPhone(value);
                    setLocalPhoneError(null);
                  }}
                  error={localPhoneError ?? undefined}
                />
                <View className="mt-2 flex-row items-start gap-3 rounded-[18px] bg-primary-light p-4">
                  <Ionicons name="shield-checkmark-outline" size={21} color={palette.primary} />
                  <Text className="flex-1 text-sm leading-5 text-ink-secondary">
                    Номер используется для входа, звонков и связи по бронированиям.
                  </Text>
                </View>
              </View>
            ) : null}

            {step === 'verify_code' ? (
              <View className="gap-4">
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Ввести код подтверждения"
                  onPress={() => hiddenInputRef.current?.focus()}
                  className="flex-row justify-center gap-2 py-1">
                  {Array.from({ length: codeLength }).map((_, index) => {
                    const active = code.length === index;
                    return (
                      <MaterialSurface
                        key={index}
                        level="raised"
                        radius={18}
                        style={{
                          height: 62,
                          flex: 1,
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderWidth: active ? 2 : 1,
                          borderColor: active ? palette.primary : palette.line,
                        }}>
                        <Text className="text-2xl font-extrabold text-ink">{code[index] ?? ''}</Text>
                      </MaterialSurface>
                    );
                  })}
                </Pressable>

                <Text className="text-center text-sm text-ink-secondary">+7 {phone}</Text>

                <Pressable disabled={seconds > 0} onPress={handleRequestCode} className="py-2 active:opacity-70">
                  <Text className={cn('text-center text-sm font-bold', seconds > 0 ? 'text-ink-muted' : 'text-primary')}>
                    {seconds > 0 ? `Повторный звонок через ${formatCountdown(seconds)}` : 'Позвонить повторно'}
                  </Text>
                </Pressable>

                {mode === 'flash_call' ? (
                  <Pressable onPress={handleVoiceFallback} className="py-2 active:opacity-70">
                    <Text className="text-center text-sm font-bold text-primary">
                      Не видно номер? Получить код голосом
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            {step === 'success' ? (
              <View className="flex-1 items-center justify-center gap-4 pb-8">
                <View className="h-20 w-20 items-center justify-center rounded-full bg-success-light">
                  <Ionicons name="checkmark" size={40} color={palette.success} />
                </View>
                <Text className="text-center text-base leading-6 text-ink-secondary">
                  +7 {phone} теперь подтверждён и доступен для входа в аккаунт.
                </Text>
              </View>
            ) : null}
          </ScrollView>

          {step === 'verify_code' || (step === 'reauth' && reauthSent) ? (
            <TextInput
              ref={hiddenInputRef}
              value={code}
              onChangeText={(value) => {
                const clean = value.replace(/\D/g, '').slice(0, codeLength);
                setCode(clean);
                if (clean.length !== codeLength) return;
                if (step === 'reauth') void handleVerifyReauth(clean);
                else void handleConfirm(clean);
              }}
              keyboardType="number-pad"
              maxLength={codeLength}
              caretHidden
              style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }}
            />
          ) : null}

          <View className="flex-row gap-3 pt-2">
            {step === 'reauth' ? (
              <>
                <Button label="Закрыть" variant="secondary" size="md" className="flex-1" onPress={onClose} />
                <Button
                  label="Продолжить"
                  size="md"
                  className="flex-1"
                  disabled={!reauthSent || code.length !== codeLength}
                  loading={verifyingReauth || reauthPending}
                  onPress={() => void handleVerifyReauth(code)}
                />
              </>
            ) : step === 'input_phone' ? (
              <>
                <Button label="Закрыть" variant="secondary" size="md" className="flex-1" onPress={onClose} />
                <Button
                  label="Получить звонок"
                  size="md"
                  className="flex-1"
                  loading={requestChangeCode.isPending}
                  onPress={handleRequestCode}
                />
              </>
            ) : step === 'verify_code' ? (
              <>
                <Button label="Назад" variant="secondary" size="md" className="flex-1" onPress={handleReset} />
                <Button
                  label="Подтвердить"
                  size="md"
                  className="flex-1"
                  disabled={code.length !== codeLength}
                  loading={confirmChange.isPending}
                  onPress={() => void handleConfirm(code)}
                />
              </>
            ) : (
              <Button label="Готово" size="md" className="w-full" onPress={onClose} />
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </BottomSheet>
  );
}
