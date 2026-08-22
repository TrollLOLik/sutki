import { ArrowRight, Mail } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { createPendingChallenge, normalizeAuthEmail, requestEmailCode, WebAuthError } from '@features/auth';
import { useMediaQuery } from '@shared/lib/adaptivity';
import { Button, Field, TextField } from '@ui';
import { AuthLegalAcceptance } from './AuthLegalAcceptance';
import { AuthStepScreen } from './AuthStepScreen';

interface EmailAuthPageProps {
  onBack: () => void;
  onContinue: (identifier: string) => void;
  onRegisterByPhone: () => void;
}

export function EmailAuthPage({ onBack, onContinue, onRegisterByPhone }: EmailAuthPageProps) {
  const desktopAutoFocus = useMediaQuery('(min-width: 900px)');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [accountMissing, setAccountMissing] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPersonalData, setAcceptedPersonalData] = useState(false);
  const [legalError, setLegalError] = useState('');
  const [loading, setLoading] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const normalized = normalizeAuthEmail(email);
    if (!normalized) return setError('Введите корректный email');
    if (!acceptedTerms || !acceptedPersonalData) {
      setLegalError('Необходимо принять оба документа, чтобы продолжить.');
      return;
    }
    setLoading(true);
    setError('');
    setAccountMissing(false);
    try {
      const response = await requestEmailCode(normalized);
      createPendingChallenge('email', normalized, response);
      onContinue(normalized);
    } catch (requestError) {
      if (requestError instanceof WebAuthError && requestError.status === 404) {
        setAccountMissing(true);
        setError('Аккаунт с этой почтой не найден. Зарегистрируйтесь по номеру телефона.');
      } else {
        setError(requestError instanceof WebAuthError ? requestError.message : 'Не удалось отправить код. Попробуйте ещё раз.');
      }
    } finally {
      setLoading(false);
    }
  };
  return <form id="auth-email-form" onSubmit={submit}><AuthStepScreen icon={<Mail size={27} />} title="Введите email" description="По почте можно войти, если она уже привязана к аккаунту. Для регистрации используйте номер телефона." onBack={onBack} footer={<Button type="submit" form="auth-email-form" size="lg" stretched loading={loading} after={<ArrowRight size={19} />}>Получить код</Button>}>
    <Field label="Электронная почта" labelFor="auth-email" error={error} messageId="auth-email-error"><TextField id="auth-email" type="email" autoFocus={desktopAutoFocus} autoComplete="email" placeholder="name@example.com" value={email} invalid={Boolean(error)} aria-describedby={error ? 'auth-email-error' : undefined} before={<Mail size={18} />} onChange={(event) => { setEmail(event.target.value); setError(''); setAccountMissing(false); }} /></Field>
    {accountMissing ? <Button type="button" mode="outline" tone="primary" stretched before={<ArrowRight size={18} />} onClick={onRegisterByPhone}>Зарегистрироваться по телефону</Button> : null}
    <AuthLegalAcceptance
      acceptedTerms={acceptedTerms}
      acceptedPersonalData={acceptedPersonalData}
      onTermsChange={(value) => { setAcceptedTerms(value); setLegalError(''); }}
      onPersonalDataChange={(value) => { setAcceptedPersonalData(value); setLegalError(''); }}
      error={legalError}
    />
  </AuthStepScreen></form>;
}
