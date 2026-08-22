import { demoSession } from '@features/auth';
import { CodeAuthPage, EmailAuthPage, PhoneAuthPage, ProfileSetupPage, WelcomePage } from '@pages/auth';
import type { AppRouteViewProps } from './AppRouteView';

export function AuthRouteView({ route, bookingDraft, navigate, back, onAuthComplete, onAuthCancelled }: AppRouteViewProps) {
  switch (route.name) {
    case 'welcome':
      return <WelcomePage onPhone={() => navigate({ name: 'auth-phone' })} onEmail={() => navigate({ name: 'auth-email' })} onGuest={() => { onAuthCancelled(); demoSession.continueAsGuest(); navigate({ name: 'home' }, true); }} />;

    case 'auth-phone':
      return <PhoneAuthPage initialPhone={bookingDraft?.submitAfterAuth ? bookingDraft.phone : undefined} onBack={() => { onAuthCancelled(); back({ name: 'welcome' }); }} onContinue={(identifier) => navigate({ name: 'auth-code', channel: 'phone', identifier })} />;

    case 'auth-email':
      return <EmailAuthPage onBack={() => { onAuthCancelled(); back({ name: 'welcome' }); }} onContinue={(identifier) => navigate({ name: 'auth-code', channel: 'email', identifier })} />;

    case 'auth-code':
      return <CodeAuthPage channel={route.channel} identifier={route.identifier} onBack={() => back({ name: route.channel === 'email' ? 'auth-email' : 'auth-phone' })} onSuccess={() => navigate({ name: 'profile-setup' })} />;

    case 'profile-setup': {
      const session = demoSession.getSnapshot();
      return <ProfileSetupPage channel={session.channel} identifier={session.identifier} onBack={() => { onAuthCancelled(); demoSession.signOut(); navigate({ name: 'welcome' }, true); }} onDone={onAuthComplete} />;
    }

    default:
      return null;
  }
}
