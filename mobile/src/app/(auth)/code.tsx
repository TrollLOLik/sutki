import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { Button, ScreenContainer } from '@/components/ui';
import { requestEmailCode, useVerifyEmailCode } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';
import { cn } from '@/lib/cn';
import { useSessionStore } from '@/store/session';
import { setGlobalFromBooking } from '@/lib/requireAuth';

const CODE_LENGTH = 6;
const RESEND_SECONDS = 60;

export default function CodeScreen() {
  const { email, devCode, fromBooking } = useLocalSearchParams<{ email?: string; devCode?: string; fromBooking?: string }>();
  const [code, setCode] = useState('');
  const [seconds, setSeconds] = useState(RESEND_SECONDS);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);
  const verify = useVerifyEmailCode();
  const beginSession = useSessionStore((s) => s.beginSession);

  useEffect(() => {
    if (seconds <= 0) return;
    const id = setInterval(() => setSeconds((s) => s - 1), 1000);
    return () => clearInterval(id);
  }, [seconds]);

  const onConfirm = async () => {
    if (!email || code.length < CODE_LENGTH) return;
    setError(null);
    try {
      const res = await verify.mutateAsync({ email, code });
      if (fromBooking === 'true') {
        setGlobalFromBooking(true);
      }
      // beginSession sets status to 'onboarding' (incomplete profile) or
      // 'authenticated'; the root layout guard swaps stacks accordingly.
      const needsProfile = await beginSession(
        { accessToken: res.access_token, refreshToken: res.refresh_token },
        res.user,
      );
      if (!needsProfile && fromBooking === 'true') {
        setTimeout(() => {
          router.replace('/bookings');
        }, 100);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось проверить код. Попробуйте снова.');
    }
  };

  const onResend = async () => {
    if (!email || seconds > 0) return;
    setError(null);
    try {
      await requestEmailCode(email);
      setSeconds(RESEND_SECONDS);
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 429
          ? 'Слишком частый запрос. Подождите минуту.'
          : 'Не удалось отправить код повторно.',
      );
    }
  };

  return (
    <ScreenContainer centered>
      <View className="flex-1 gap-6 pt-6">
        <View className="gap-2">
          <Text className="text-2xl font-bold text-ink">Введите код</Text>
          <Text className="text-base text-ink-secondary">
            Мы отправили код на {email ?? ''}
          </Text>
        </View>

        <Pressable className="flex-row justify-center gap-2" onPress={() => inputRef.current?.focus()}>
          {Array.from({ length: CODE_LENGTH }).map((_, i) => (
            <View
              key={i}
              className={cn(
                'h-14 flex-1 items-center justify-center rounded-field border',
                code.length === i ? 'border-primary' : 'border-line',
              )}>
              <Text className="text-2xl font-bold text-ink">{code[i] ?? ''}</Text>
            </View>
          ))}
        </Pressable>

        {error ? <Text className="text-center text-sm text-danger">{error}</Text> : null}

        <TextInput
          ref={inputRef}
          value={code}
          onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, CODE_LENGTH))}
          keyboardType="number-pad"
          maxLength={CODE_LENGTH}
          autoFocus
          caretHidden
          className="absolute h-px w-px opacity-0"
        />

        <Pressable disabled={seconds > 0} onPress={onResend}>
          <Text className={cn('text-center text-base', seconds > 0 ? 'text-ink-muted' : 'text-primary')}>
            {seconds > 0
              ? `Отправить код повторно через ${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
              : 'Отправить код повторно'}
          </Text>
        </Pressable>
      </View>

      <View className="pb-6">
        <Button
          label="Подтвердить"
          loading={verify.isPending}
          disabled={code.length < CODE_LENGTH}
          onPress={onConfirm}
        />
      </View>
    </ScreenContainer>
  );
}
