import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { Button, ScreenContainer } from '@/components/ui';
import {
  requestEmailCode,
  requestPhoneCode,
  requestPhoneVoiceFallback,
  useVerifyEmailCode,
  useVerifyPhoneCode,
} from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';
import { cn } from '@/lib/cn';
import { setGlobalFromBooking } from '@/lib/requireAuth';
import { useSessionStore } from '@/store/session';

const RESEND_SECONDS = 60;

export default function CodeScreen() {
  const { email, phone, challengeId, deliveryMode, codeLength, devCode, fromBooking } = useLocalSearchParams<{
    email?: string;
    phone?: string;
    challengeId?: string;
    deliveryMode?: string;
    codeLength?: string;
    devCode?: string;
    fromBooking?: string;
  }>();
  const length = Number(codeLength ?? (email ? 6 : 4));
  const [code, setCode] = useState('');
  const [seconds, setSeconds] = useState(RESEND_SECONDS);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState(deliveryMode ?? 'flash_call');
  const inputRef = useRef<TextInput>(null);

  const verifyEmail = useVerifyEmailCode();
  const verifyPhone = useVerifyPhoneCode();
  const beginSession = useSessionStore((s) => s.beginSession);

  useEffect(() => {
    if (seconds <= 0) return;
    const id = setInterval(() => setSeconds((s) => s - 1), 1000);
    return () => clearInterval(id);
  }, [seconds]);

  const onConfirm = async () => {
    if (code.length !== length) return;
    setError(null);
    try {
      let res;
      if (phone) {
        res = await verifyPhone.mutateAsync({ phone, code, challengeId: challengeId ?? '' });
      } else if (email) {
        res = await verifyEmail.mutateAsync({ email, code });
      } else {
        return;
      }
      if (fromBooking === 'true') setGlobalFromBooking(true);
      const needsProfile = await beginSession(
        { accessToken: res.access_token, refreshToken: res.refresh_token },
        res.user,
      );
      if (!needsProfile && fromBooking === 'true') {
        setTimeout(() => router.replace('/bookings'), 100);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось проверить код. Попробуйте снова.');
    }
  };

  const onResend = async () => {
    setError(null);
    try {
      const response = phone
        ? await requestPhoneCode(phone)
        : await requestEmailCode(email ?? '');
      if (phone) {
        setMode(response.delivery_mode ?? 'flash_call');
      }
      setSeconds(response.retry_after ?? RESEND_SECONDS);
      setCode('');
    } catch (err) {
      setError(err instanceof ApiError && err.status === 429
        ? 'Слишком частый запрос. Подождите немного.'
        : 'Не удалось повторить отправку.');
    }
  };

  const onVoiceFallback = async () => {
    if (!phone || !challengeId) return;
    setError(null);
    try {
      const response = await requestPhoneVoiceFallback(phone, challengeId);
      setMode(response.delivery_mode ?? 'voice');
      setSeconds(response.retry_after ?? RESEND_SECONDS);
      setCode('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось запустить голосовой звонок.');
    }
  };

  const isLoading = verifyEmail.isPending || verifyPhone.isPending;

  return (
    <ScreenContainer centered>
      <View className="flex-1 gap-6 pt-6">
        <View className="gap-2">
          <Text className="text-2xl font-bold text-ink">Введите код</Text>
          <Text className="text-base text-ink-secondary">
            {phone
              ? mode === 'flash_call'
                ? `Вам поступит звонок на номер ${phone}. Введите последние 4 цифры номера звонящего.`
                : `Робот продиктует код по телефону ${phone}.`
              : `Мы отправили код подтверждения на почту ${email ?? ''}`}
          </Text>
        </View>

        <Pressable className="flex-row justify-center gap-2" onPress={() => inputRef.current?.focus()}>
          {Array.from({ length }).map((_, i) => (
            <View key={i} className={cn('h-14 flex-1 items-center justify-center rounded-field border', code.length === i ? 'border-primary' : 'border-line')}>
              <Text className="text-2xl font-bold text-ink">{code[i] ?? ''}</Text>
            </View>
          ))}
        </Pressable>

        {error ? <Text className="text-center text-sm text-danger">{error}</Text> : null}
        <TextInput
          ref={inputRef}
          value={code}
          onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, length))}
          keyboardType="number-pad"
          maxLength={length}
          autoFocus
          caretHidden
          className="absolute h-px w-px opacity-0"
        />

        <Pressable disabled={seconds > 0} onPress={onResend}>
          <Text className={cn('text-center text-base', seconds > 0 ? 'text-ink-muted' : 'text-primary')}>
            {seconds > 0
              ? `Повторить через ${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
              : 'Получить звонок повторно'}
          </Text>
        </Pressable>

        {phone && mode === 'flash_call' && (
          <Pressable onPress={onVoiceFallback} disabled={!challengeId}>
            <Text className="text-center text-base text-primary font-medium">Не пришёл звонок? Позвонить голосом</Text>
          </Pressable>
        )}
      </View>

      <View className="pb-6">
        <Button label="Подтвердить" loading={isLoading} disabled={code.length !== length} onPress={onConfirm} />
      </View>
    </ScreenContainer>
  );
}
