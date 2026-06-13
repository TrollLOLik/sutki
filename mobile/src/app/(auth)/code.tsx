import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { Button, ScreenContainer } from '@/components/ui';
import { cn } from '@/lib/cn';

const CODE_LENGTH = 4;

export default function CodeScreen() {
  const { phone } = useLocalSearchParams<{ phone?: string }>();
  const [code, setCode] = useState('');
  const [seconds, setSeconds] = useState(45);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (seconds <= 0) return;
    const id = setInterval(() => setSeconds((s) => s - 1), 1000);
    return () => clearInterval(id);
  }, [seconds]);

  const onConfirm = () => {
    router.push({ pathname: '/profile-setup', params: { phone } });
  };

  return (
    <ScreenContainer centered>
      <View className="flex-1 gap-6 pt-6">
        <View className="gap-2">
          <Text className="text-2xl font-bold text-ink">Введите код</Text>
          <Text className="text-base text-ink-secondary">
            Мы отправили код на номер {phone ? `+7${phone.replace(/\D/g, '').slice(-10)}` : ''}
          </Text>
        </View>

        <Pressable className="flex-row justify-center gap-3" onPress={() => inputRef.current?.focus()}>
          {Array.from({ length: CODE_LENGTH }).map((_, i) => (
            <View
              key={i}
              className={cn(
                'h-14 w-14 items-center justify-center rounded-field border',
                code.length === i ? 'border-primary' : 'border-line',
              )}>
              <Text className="text-2xl font-bold text-ink">{code[i] ?? ''}</Text>
            </View>
          ))}
        </Pressable>

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

        <Pressable disabled={seconds > 0} onPress={() => setSeconds(45)}>
          <Text className={cn('text-center text-base', seconds > 0 ? 'text-ink-muted' : 'text-primary')}>
            {seconds > 0
              ? `Отправить код повторно через 00:${String(seconds).padStart(2, '0')}`
              : 'Отправить код повторно'}
          </Text>
        </Pressable>
      </View>

      <View className="pb-6">
        <Button label="Подтвердить" disabled={code.length < CODE_LENGTH} onPress={onConfirm} />
      </View>
    </ScreenContainer>
  );
}
