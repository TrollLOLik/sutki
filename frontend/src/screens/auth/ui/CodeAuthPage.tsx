import { Check, ShieldCheck, Volume2 } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  clearPendingChallenge,
  createPendingChallenge,
  demoSession,
  getPendingChallenge,
  maskAuthIdentifier,
  requestEmailCode,
  requestPhoneCode,
  requestPhoneVoiceFallback,
  verifyEmailCode,
  verifyPhoneCode,
  WebAuthError,
  type AuthChannel,
  type PendingAuthChallenge,
} from '@features/auth';
import { useMediaQuery } from '@shared/lib/adaptivity';
import { BadgeText, Button, OneTimeCodeField } from '@ui';
import { AuthStepScreen } from './AuthStepScreen';

interface CodeAuthPageProps {
  channel: AuthChannel;
  identifier: string;
  onBack: () => void;
  onSuccess: (needsOnboarding: boolean) => void;
}

export function CodeAuthPage({ channel, identifier, onBack, onSuccess }: CodeAuthPageProps) {
  const desktopAutoFocus = useMediaQuery('(min-width: 900px)');
  const [challenge, setChallenge] = useState<PendingAuthChallenge | null>(() => getPendingChallenge(channel, identifier));
  const length = challenge?.codeLength ?? (channel === 'phone' ? 4 : 6);
  const [code, setCode] = useState(() => challenge?.devCode ?? '');
  const [error, setError] = useState('');
  const [seconds, setSeconds] = useState(() => challenge?.retryAfter ?? 60);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (seconds <= 0) return;
    const timer = window.setInterval(() => setSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [seconds]);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!new RegExp(`^\\d{${length}}$`).test(code)) return setError(`Введите ${length} цифр`);
    if (!challenge && channel === 'phone') return setError('Запросите звонок повторно, чтобы получить новый код.');
    setLoading(true);
    setError('');
    try {
      const response = channel === 'phone'
        ? await verifyPhoneCode(identifier, code, challenge?.challengeId ?? '')
        : await verifyEmailCode(identifier, code);
      clearPendingChallenge();
      demoSession.beginSession(response.user);
      onSuccess(response.status === 'onboarding');
    } catch (verifyError) {
      setError(verifyError instanceof WebAuthError ? verifyError.message : 'Не удалось проверить код. Попробуйте ещё раз.');
    } finally {
      setLoading(false);
    }
  };
  const resend = async () => {
    setResending(true);
    setError('');
    try {
      const response = channel === 'phone'
        ? await requestPhoneCode(identifier)
        : await requestEmailCode(identifier);
      const next = createPendingChallenge(channel, identifier, response);
      setChallenge(next);
      setSeconds(next.retryAfter);
      setCode(next.devCode ?? '');
      inputRef.current?.focus();
    } catch (requestError) {
      setError(requestError instanceof WebAuthError ? requestError.message : 'Не удалось отправить код повторно.');
    } finally {
      setResending(false);
    }
  };
  const requestVoice = async () => {
    if (!challenge?.challengeId) return setError('Сначала запросите новый звонок.');
    setResending(true);
    setError('');
    try {
      const response = await requestPhoneVoiceFallback(identifier, challenge.challengeId);
      const next = createPendingChallenge('phone', identifier, response);
      setChallenge(next);
      setSeconds(next.retryAfter);
      setCode(next.devCode ?? '');
      inputRef.current?.focus();
    } catch (requestError) {
      setError(requestError instanceof WebAuthError ? requestError.message : 'Не удалось заказать голосовой звонок.');
    } finally {
      setResending(false);
    }
  };
  return <form id="auth-code-form" className="auth-code-page" onSubmit={submit}><AuthStepScreen contextClassName="auth-code-page" icon={<ShieldCheck size={23} />} title={channel === 'phone' ? 'Введите код' : 'Введите код из письма'} description={channel === 'phone' ? `Сейчас поступит короткий звонок на ${identifier}. Введите последние ${length} цифры номера звонящего.` : `Введите ${length}-значный код, который мы отправили для ${maskAuthIdentifier(channel, identifier)}.`} onBack={onBack} footer={<Button type="submit" form="auth-code-form" size="md" stretched loading={loading} disabled={code.length !== length} before={<Check size={17} />}>Подтвердить</Button>}>
    <OneTimeCodeField id="auth-code-input" ref={inputRef} wrapClassName={channel === 'phone' ? 'auth-phone-code-wrap' : undefined} cellsClassName="auth-code-cells" inputClassName="auth-code-input" value={code} length={length} aria-label={channel === 'phone' ? 'Последние 4 цифры номера звонящего' : 'Код из письма'} aria-describedby={error ? 'auth-code-error' : undefined} aria-invalid={Boolean(error)} autoFocus={desktopAutoFocus} onValueChange={(value) => { setCode(value); setError(''); }} />
    {error ? <BadgeText as="p" id="auth-code-error" className="auth-code-error" color="danger" role="alert">{error}</BadgeText> : null}
    <Button type="button" size="sm" mode="ghost" tone="primary" className="auth-resend" loading={resending} disabled={seconds > 0} onClick={() => void resend()}>{seconds > 0 ? `Повторить через 00:${String(seconds).padStart(2, '0')}` : channel === 'phone' ? 'Повторить звонок' : 'Отправить код снова'}</Button>
    {channel === 'phone' && challenge?.fallbackAvailable ? <Button type="button" size="sm" mode="ghost" tone="primary" className="auth-code-voice" startIcon={<Volume2 size={20} />} disabled={resending} onClick={() => void requestVoice()}>Продиктовать код голосом</Button> : null}
  </AuthStepScreen></form>;
}
