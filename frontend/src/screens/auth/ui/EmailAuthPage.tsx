import { ArrowRight, Mail } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { normalizeAuthEmail } from '@features/auth';
import { useMediaQuery } from '@shared/lib/adaptivity';
import { Button, Field, TextField } from '@ui';
import { AuthStepScreen } from './AuthStepScreen';

interface EmailAuthPageProps {
  onBack: () => void;
  onContinue: (identifier: string) => void;
}

export function EmailAuthPage({ onBack, onContinue }: EmailAuthPageProps) {
  const desktopAutoFocus = useMediaQuery('(min-width: 900px)');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const normalized = normalizeAuthEmail(email);
    if (!normalized) return setError('Введите корректный email');
    onContinue(normalized);
  };
  return <form id="auth-email-form" onSubmit={submit}><AuthStepScreen icon={<Mail size={27} />} title="Введите email" description="Отправим одноразовый код для безопасного входа. Пароль создавать не понадобится." onBack={onBack} footer={<Button type="submit" form="auth-email-form" size="lg" stretched after={<ArrowRight size={19} />}>Получить код</Button>}>
    <Field label="Электронная почта" labelFor="auth-email" error={error} messageId="auth-email-error"><TextField id="auth-email" type="email" autoFocus={desktopAutoFocus} autoComplete="email" placeholder="name@example.com" value={email} invalid={Boolean(error)} aria-describedby={error ? 'auth-email-error' : undefined} before={<Mail size={18} />} onChange={(event) => { setEmail(event.target.value); setError(''); }} /></Field>
  </AuthStepScreen></form>;
}
