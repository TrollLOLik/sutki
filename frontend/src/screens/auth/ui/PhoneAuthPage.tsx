import { Phone } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { createPendingChallenge, requestPhoneCode, WebAuthError } from '@features/auth';
import { useMediaQuery } from '@shared/lib/adaptivity';
import { Button, Field, PhoneField } from '@ui';
import { AuthLegalAcceptance } from './AuthLegalAcceptance';
import { AuthStepScreen } from './AuthStepScreen';

interface PhoneAuthPageProps {
  onBack: () => void;
  onContinue: (identifier: string) => void;
  initialPhone?: string;
}

export function PhoneAuthPage({ onBack, onContinue, initialPhone = '+7' }: PhoneAuthPageProps) {
  const desktopAutoFocus = useMediaQuery('(min-width: 900px)');
  const [phone, setPhone] = useState(() => formatDemoPhone(initialPhone));
  const [error, setError] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPersonalData, setAcceptedPersonalData] = useState(false);
  const [legalError, setLegalError] = useState('');
  const [loading, setLoading] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const formatted = formatDemoPhone(phone);
    if (formatted.replace(/\D/g, '').length !== 11) return setError('Укажите полный номер телефона (10 цифр)');
    if (!acceptedTerms || !acceptedPersonalData) {
      setLegalError('Необходимо принять оба документа, чтобы продолжить.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await requestPhoneCode(formatted);
      createPendingChallenge('phone', formatted, response);
      onContinue(formatted);
    } catch (requestError) {
      setError(requestError instanceof WebAuthError ? requestError.message : 'Не удалось заказать звонок. Попробуйте ещё раз.');
    } finally {
      setLoading(false);
    }
  };
  return <form id="auth-phone-form" className="auth-phone-page" onSubmit={submit}><AuthStepScreen contextClassName="auth-phone-page" icon={<Phone size={23} />} title="Введите номер телефона" description="Мы позвоним на указанный номер. Отвечать не нужно — для входа понадобятся последние 4 цифры номера звонящего." onBack={onBack} footer={<Button type="submit" form="auth-phone-form" size="md" stretched loading={loading} before={<Phone size={17} />}>Получить звонок</Button>}>
    <Field label="Номер телефона" labelFor="auth-phone" error={error} messageId="auth-phone-error"><PhoneField id="auth-phone" autoFocus={desktopAutoFocus} value={phone.replace(/^\+7\s?/, '')} invalid={Boolean(error)} aria-describedby={error ? 'auth-phone-error' : undefined} onChange={(event) => { const localDigits = event.target.value.replace(/\D/g, '').replace(/^[78]/, ''); setPhone(formatDemoPhone(`+7 ${localDigits}`)); setError(''); }} /></Field>
    <AuthLegalAcceptance
      acceptedTerms={acceptedTerms}
      acceptedPersonalData={acceptedPersonalData}
      onTermsChange={(value) => { setAcceptedTerms(value); setLegalError(''); }}
      onPersonalDataChange={(value) => { setAcceptedPersonalData(value); setLegalError(''); }}
      error={legalError}
    />
  </AuthStepScreen></form>;
}

function formatDemoPhone(value: string): string {
  const digits = value.replace(/\D/g, '').replace(/^8/, '7').slice(0, 11);
  const local = digits.startsWith('7') ? digits.slice(1) : digits;
  let result = '+7';
  if (local.length) result += ` (${local.slice(0, 3)}`;
  if (local.length >= 3) result += ')';
  if (local.length > 3) result += ` ${local.slice(3, 6)}`;
  if (local.length > 6) result += `-${local.slice(6, 8)}`;
  if (local.length > 8) result += `-${local.slice(8, 10)}`;
  return result;
}
