import { Home, Mail, MapPin, Phone, Search } from 'lucide-react';
import { BadgeText, BodyText, Button, DescriptionText, HeroTitle } from '@ui';

interface WelcomePageProps {
  onPhone: () => void;
  onEmail: () => void;
  onGuest: () => void;
}

export function WelcomePage({ onPhone, onEmail, onGuest }: WelcomePageProps) {
  return (
    <main className="auth-welcome">
      <section className="auth-welcome-inner">
        <div className="auth-welcome-content">
          <div className="auth-welcome-brand"><span><Home size={21} /></span><BodyText as="strong" className="ui-text--inherit-metrics" color="inherit">ВИГАЖ</BodyText></div>
          <div className="auth-welcome-copy">
            <HeroTitle>Найдите квартиру<br />или сдайте свою</HeroTitle>
            <DescriptionText as="p">Жильё рядом — для посуточной аренды и удобного бронирования</DescriptionText>
          </div>
          <div className="auth-welcome-actions">
            <Button stretched before={<Phone size={17} />} onClick={onPhone}>Войти по телефону</Button>
            <Button stretched mode="outline" tone="neutral" before={<Mail size={17} />} onClick={onEmail}>Войти по почте</Button>
            <Button size="md" mode="ghost" tone="primary" className="auth-welcome-guest" startIcon={<Search size={18} />} onClick={onGuest}>Найти жильё</Button>
          </div>
        </div>
        <div className="auth-welcome-visual">
          <img src="/auth/welcome-screen.png" alt="Белый диван, лампа и растение" />
          <BadgeText className="auth-welcome-location" color="inverse"><MapPin size={15} /> ВИГАЖ</BadgeText>
        </div>
      </section>
    </main>
  );
}
