import { Text, View } from 'react-native';

import { cn } from '@/lib/cn';

type Tone = 'success' | 'info' | 'neutral' | 'primary';

const tones: Record<Tone, { bg: string; text: string }> = {
  success: { bg: 'bg-success', text: 'text-white' },
  info: { bg: 'bg-info', text: 'text-white' },
  primary: { bg: 'bg-primary', text: 'text-white' },
  neutral: { bg: 'bg-surface-muted', text: 'text-ink-secondary' },
};

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  const t = tones[tone];
  return (
    <View className={cn('self-start rounded-pill px-2.5 py-1', t.bg)}>
      <Text className={cn('text-xs font-semibold', t.text)}>{label}</Text>
    </View>
  );
}
