import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';

interface LoadErrorStateProps {
  title?: string;
  subtitle?: string;
  retryLabel?: string;
  loading?: boolean;
  onRetry: () => void;
}

export function LoadErrorState({
  title = 'Не удалось загрузить',
  subtitle = 'Проверьте подключение и попробуйте снова.',
  retryLabel = 'Повторить',
  loading = false,
  onRetry,
}: LoadErrorStateProps) {
  return (
    <EmptyState
      debugName="LoadErrorState"
      icon="cloud-offline-outline"
      title={title}
      subtitle={subtitle}
      action={
        <Button
          label={retryLabel}
          variant="secondary"
          loading={loading}
          onPress={onRetry}
        />
      }
    />
  );
}
