import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import 'lenis/dist/lenis.css';
import 'overlayscrollbars/overlayscrollbars.css';
import '@ui/tokens.css';
import '@ui/ui-kit.css';
import '@shared/styles/global.css';

const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://arenda.wigaj.ru';

const themeBootstrap = `
(() => {
  try {
    const valid = (value) => value === 'light' || value === 'dark' || value === 'system';
    const saved = localStorage.getItem('sutki.themePreference');
    let preference = valid(saved) ? saved : null;
    if (!preference) {
      const profile = JSON.parse(localStorage.getItem('sutki-profile-demo-v2') || '{}');
      preference = valid(profile.theme) ? profile.theme : 'system';
    }
    const resolved = preference === 'system'
      ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : preference;
    const motion = localStorage.getItem('sutki.motionPreference')
      || (matchMedia('(prefers-reduced-motion: reduce)').matches ? 'reduced' : 'full');
    document.documentElement.dataset.theme = resolved;
    document.documentElement.dataset.themePreference = preference;
    document.documentElement.dataset.motion = motion;
    document.documentElement.dataset.componentMarkers = localStorage.getItem('sutki.componentMarkers') === 'shown'
      ? 'shown'
      : 'hidden';
    document.documentElement.style.colorScheme = resolved;
  } catch {
    const resolved = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    document.documentElement.dataset.theme = resolved;
    document.documentElement.dataset.themePreference = 'system';
    document.documentElement.dataset.motion = matchMedia('(prefers-reduced-motion: reduce)').matches ? 'reduced' : 'full';
    document.documentElement.dataset.componentMarkers = 'hidden';
    document.documentElement.style.colorScheme = resolved;
  }
})();
`;

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  applicationName: 'ВИГАЖ Аренда',
  title: {
    default: 'ВИГАЖ Аренда — жильё на нужные даты',
    template: '%s — ВИГАЖ Аренда',
  },
  description: 'Поиск и аренда квартир и домов на нужные даты.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#17181c' },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body>
        {children}
        <div id="route-action-bar-host" />
      </body>
    </html>
  );
}
