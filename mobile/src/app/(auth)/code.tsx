import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { MotiView } from 'moti';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, TextInput, useWindowDimensions, View } from 'react-native';

import { AuthStepScreen } from '@/components/auth/AuthStepScreen';
import { Button, MaterialSurface } from '@/components/ui';
import {
  requestEmailCode,
  requestPhoneCode,
  requestPhoneVoiceFallback,
  useVerifyEmailCode,
  useVerifyPhoneCode,
} from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';
import { cn } from '@/lib/cn';
import { formatPhoneMask, normalizePhoneDigits } from '@/lib/phone';
import { setGlobalFromBooking } from '@/lib/requireAuth';
import { useSessionStore } from '@/store/session';
import { useAppTheme } from '@/theme/useAppTheme';

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
  const { width } = useWindowDimensions();
  const { palette } = useAppTheme();

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
  const cellGap = length > 4 ? 6 : 10;
  const availableWidth = Math.min(width - 64, 520);
  const cellSize = Math.max(
    40,
    Math.min(length > 4 ? 50 : 60, Math.floor((availableWidth - cellGap * (length - 1)) / length)),
  );
  const formattedPhone = phone
    ? `+7 ${formatPhoneMask(normalizePhoneDigits(phone))}`
    : '';
  const description = phone
    ? mode === 'flash_call'
      ? `Сейчас поступит короткий звонок на ${formattedPhone}. Введите последние 4 цифры номера звонящего.`
      : `Робот продиктует код по телефону ${formattedPhone}.`
    : `Код подтверждения отправлен на ${email ?? ''}.`;

  return (
    <AuthStepScreen
      icon="shield-checkmark-outline"
      title="Введите код"
      description={description}
      footer={(
        <Button
          label="Подтвердить"
          icon="checkmark-circle-outline"
          loading={isLoading}
          disabled={code.length !== length}
          onPress={onConfirm}
        />
      )}>
      <MaterialSurface
        level="raised"
        radius={24}
        style={{ paddingHorizontal: 12, paddingVertical: 18 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Поле ввода кода"
          style={{ flexDirection: 'row', justifyContent: 'center', gap: cellGap }}
          onPress={() => inputRef.current?.focus()}>
          {Array.from({ length }).map((_, i) => {
            const isFilled = Boolean(code[i]);
            const isActive = code.length === i || (code.length === length && i === length - 1);
            return (
              <MotiView
                key={i}
                animate={{ scale: isFilled ? 1 : 0.985 }}
                transition={{ type: 'spring', damping: 17, stiffness: 250 }}
                style={{
                  width: cellSize,
                  height: 58,
                  borderRadius: 18,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: isActive || isFilled ? 1.5 : 1,
                  borderColor: isActive || isFilled ? palette.primary : palette.line,
                  backgroundColor: isFilled ? palette.primaryLight : palette.surface,
                }}>
                <Text style={{ color: palette.ink, fontSize: 24, fontWeight: '800' }}>
                  {code[i] ?? ''}
                </Text>
              </MotiView>
            );
          })}
        </Pressable>
      </MaterialSurface>

      {error ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: 9,
            marginTop: 14,
            paddingHorizontal: 14,
            paddingVertical: 12,
            borderRadius: 16,
            backgroundColor: palette.dangerLight,
          }}>
          <Ionicons name="alert-circle-outline" size={20} color={palette.danger} />
          <Text style={{ flex: 1, color: palette.danger, fontSize: 14, lineHeight: 20 }}>
            {error}
          </Text>
        </View>
      ) : null}

      <TextInput
        ref={inputRef}
        value={code}
        onChangeText={(text) => setCode(text.replace(/\D/g, '').slice(0, length))}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        maxLength={length}
        autoFocus
        caretHidden
        className="absolute h-px w-px opacity-0"
      />

      <View style={{ marginTop: 22, gap: 10 }}>
        <Pressable
          accessibilityRole="button"
          disabled={seconds > 0}
          onPress={onResend}
          style={({ pressed }) => ({
            minHeight: 44,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.65 : 1,
          })}>
          <Text className={cn('text-center text-base font-semibold', seconds > 0 ? 'text-ink-muted' : 'text-primary')}>
            {seconds > 0
              ? `Повторить через ${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
              : phone ? 'Получить звонок повторно' : 'Отправить код повторно'}
          </Text>
        </Pressable>

        {phone && mode === 'flash_call' ? (
          <Pressable
            accessibilityRole="button"
            onPress={onVoiceFallback}
            disabled={!challengeId}
            style={({ pressed }) => ({
              minHeight: 44,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: !challengeId ? 0.42 : pressed ? 0.65 : 1,
            })}>
            <View
              style={{
                width: '100%',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 7,
              }}>
              <Ionicons name="volume-high-outline" size={19} color={palette.primary} />
              <Text style={{ color: palette.primary, fontSize: 15, fontWeight: '700' }}>
                Продиктовать код голосом
              </Text>
            </View>
          </Pressable>
        ) : null}
      </View>
    </AuthStepScreen>
  );
}
