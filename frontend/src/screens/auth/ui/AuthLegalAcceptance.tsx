import { ButtonLink, Checkbox, DescriptionText } from '@ui';

interface AuthLegalAcceptanceProps {
  acceptedTerms: boolean;
  acceptedPersonalData: boolean;
  onTermsChange: (checked: boolean) => void;
  onPersonalDataChange: (checked: boolean) => void;
  error?: string;
}

const legalBaseUrl = String(process.env.NEXT_PUBLIC_LEGAL_URL ?? 'https://arenda.wigaj.ru/legal').replace(/\/$/, '');

function LegalLink({ href, children }: { href: string; children: string }) {
  return <ButtonLink className="auth-legal-link" href={href} target="_blank" rel="noreferrer" size="sm" mode="ghost" tone="primary" onClick={(event) => event.stopPropagation()}>{children}</ButtonLink>;
}

export function AuthLegalAcceptance({
  acceptedTerms,
  acceptedPersonalData,
  onTermsChange,
  onPersonalDataChange,
  error,
}: AuthLegalAcceptanceProps) {
  return (
    <div className="auth-legal-acceptance">
      <Checkbox
        checked={acceptedTerms}
        onChange={(event) => onTermsChange(event.target.checked)}
        label={<>Я принимаю <LegalLink href={`${legalBaseUrl}/terms`}>Пользовательское соглашение</LegalLink></>}
      />
      <Checkbox
        checked={acceptedPersonalData}
        onChange={(event) => onPersonalDataChange(event.target.checked)}
        label={<>Я даю <LegalLink href={`${legalBaseUrl}/personal-data-consent`}>согласие на обработку персональных данных</LegalLink></>}
      />
      {error ? <DescriptionText as="p" className="auth-legal-error" color="danger" role="alert">{error}</DescriptionText> : null}
    </div>
  );
}
