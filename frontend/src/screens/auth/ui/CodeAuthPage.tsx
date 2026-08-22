import { Check, ShieldCheck, Volume2 } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { demoSession, maskAuthIdentifier, type AuthChannel } from '@features/auth';
import { useMediaQuery } from '@shared/lib/adaptivity';
import { BadgeText, Button, OneTimeCodeField } from '@ui';
import { AuthStepScreen } from './AuthStepScreen';

interface CodeAuthPageProps {
  channel: AuthChannel;
  identifier: string;
  onBack: () => void;
  onSuccess: () => void;
}

export function CodeAuthPage({ channel, identifier, onBack, onSuccess }: CodeAuthPageProps) {
  const desktopAutoFocus = useMediaQuery('(min-width: 900px)');
  const length = channel === 'phone' ? 4 : 6;
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [seconds, setSeconds] = useState(60);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (seconds <= 0) return;
    const timer = window.setInterval(() => setSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [seconds]);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!new RegExp(`^\\d{${length}}$`).test(code)) return setError(`Введите ${length} цифр`);
    demoSession.beginOnboarding(channel, identifier);
    onSuccess();
  };
  return <form id="auth-code-form" className="auth-code-page" onSubmit={submit}><AuthStepScreen contextClassName="auth-code-page" icon={<ShieldCheck size={23} />} title={channel === 'phone' ? 'Введите код' : 'Введите код из письма'} description={channel === 'phone' ? `Сейчас поступит короткий звонок на ${identifier}. Введите последние 4 цифры номера звонящего.` : `Введите 6-значный код, который мы отправили для ${maskAuthIdentifier(channel, identifier)}.`} onBack={onBack} footer={<Button type="submit" form="auth-code-form" size="md" stretched disabled={code.length !== length} before={<Check size={17} />}>Подтвердить</Button>}>
    <OneTimeCodeField id="auth-code-input" ref={inputRef} wrapClassName={channel === 'phone' ? 'auth-phone-code-wrap' : undefined} cellsClassName="auth-code-cells" inputClassName="auth-code-input" value={code} length={length} aria-label={channel === 'phone' ? 'Последние 4 цифры номера звонящего' : 'Код из письма'} aria-describedby={error ? 'auth-code-error' : undefined} aria-invalid={Boolean(error)} autoFocus={desktopAutoFocus} onValueChange={(value) => { setCode(value); setError(''); }} />
    {error ? <BadgeText as="p" id="auth-code-error" className="auth-code-error" color="danger" role="alert">{error}</BadgeText> : null}
    <Button size="sm" mode="ghost" tone="primary" className="auth-resend" disabled={seconds > 0} onClick={() => { setSeconds(60); setCode(''); setError(''); inputRef.current?.focus(); }}>{seconds > 0 ? `Повторить через 00:${String(seconds).padStart(2, '0')}` : channel === 'phone' ? 'Повторить звонок' : 'Отправить код снова'}</Button>
    {channel === 'phone' ? <Button size="sm" mode="ghost" tone="primary" className="auth-code-voice" startIcon={<Volume2 size={20} />} onClick={() => { setSeconds(60); inputRef.current?.focus(); }}>Продиктовать код голосом</Button> : null}
  </AuthStepScreen></form>;
}
