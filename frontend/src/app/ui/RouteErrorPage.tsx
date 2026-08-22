import { AppHeader, EmptyState } from '@ui';

export interface RouteErrorPageProps {
  title: string;
  description: string;
  onBack: () => void;
  onHome: () => void;
}

export function RouteErrorPage({ title, description, onBack, onHome }: RouteErrorPageProps) {
  return <div className="route-error-page">
    <AppHeader title={title} onBack={onBack} />
    <main>
      <EmptyState title={title} description={description} actionLabel="Вернуться в каталог" onAction={onHome} />
    </main>
  </div>;
}
