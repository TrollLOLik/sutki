import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { BodyText, DescriptionText, HeroTitle, IconButton, RouteActionBarPortal } from '@ui';

export function AuthStepScreen({ icon, title, description, onBack, children, footer, contextClassName }: {
  icon: ReactNode;
  title: string;
  description: string;
  onBack: () => void;
  children: ReactNode;
  footer: ReactNode;
  contextClassName?: string;
}) {
  return (
    <main className="auth-step-screen">
      <header className="auth-step-header">
        <IconButton label="Назад" variant="surface" icon={<ArrowLeft size={22} />} onClick={onBack} />
        <BodyText className="auth-wordmark" weight={500}>ВИГАЖ</BodyText>
        <span className="auth-header-spacer" />
      </header>
      <section className="auth-step-content">
        <span className="auth-step-icon">{icon}</span>
        <HeroTitle>{title}</HeroTitle>
        <DescriptionText as="p">{description}</DescriptionText>
        <div className="auth-step-form">{children}</div>
      </section>
      <RouteActionBarPortal contextClassName={contextClassName}>
        <footer className="auth-step-footer">{footer}</footer>
      </RouteActionBarPortal>
    </main>
  );
}
