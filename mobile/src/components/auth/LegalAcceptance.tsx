import { Linking, Text, View } from 'react-native';

import { Checkbox } from '@/components/ui';
import { useAppTheme } from '@/theme/useAppTheme';

interface LegalAcceptanceProps {
  acceptTerms: boolean;
  acceptPersonalData: boolean;
  onAcceptTermsChange: (value: boolean) => void;
  onAcceptPersonalDataChange: (value: boolean) => void;
  error?: string;
}

function ConsentRow({
  checked,
  label,
  linkLabel,
  url,
  onChange,
}: {
  checked: boolean;
  label: string;
  linkLabel: string;
  url: string;
  onChange: (value: boolean) => void;
}) {
  const { palette } = useAppTheme();

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
      <Checkbox checked={checked} onCheckedChange={onChange} style={{ marginTop: 1 }} />
      <Text style={{ color: palette.inkSecondary, fontSize: 14, lineHeight: 20, flex: 1 }}>
        {label}{' '}
        <Text
          accessibilityRole="link"
          onPress={() => void Linking.openURL(url)}
          style={{ color: palette.primary, fontWeight: '700' }}>
          {linkLabel}
        </Text>
      </Text>
    </View>
  );
}

export function LegalAcceptance({
  acceptTerms,
  acceptPersonalData,
  onAcceptTermsChange,
  onAcceptPersonalDataChange,
  error,
}: LegalAcceptanceProps) {
  const { palette } = useAppTheme();

  return (
    <View style={{ marginTop: 22, gap: 14 }}>
      <ConsentRow
        checked={acceptTerms}
        label="Я принимаю"
        linkLabel="Пользовательское соглашение"
        url="https://wigaj.ru/legal/terms"
        onChange={onAcceptTermsChange}
      />
      <ConsentRow
        checked={acceptPersonalData}
        label="Я даю"
        linkLabel="согласие на обработку персональных данных"
        url="https://wigaj.ru/legal/personal-data-consent"
        onChange={onAcceptPersonalDataChange}
      />
      {error ? <Text style={{ color: palette.danger, fontSize: 13, lineHeight: 18 }}>{error}</Text> : null}
    </View>
  );
}
