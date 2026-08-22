import { CircleAlert } from 'lucide-react';
import { Button, ConfirmationDialog } from '@ui';

interface DeleteReviewDialogProps {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteReviewDialog({ open, busy, onClose, onConfirm }: DeleteReviewDialogProps) {
  return (
    <ConfirmationDialog
      open={open}
      title="Удалить отзыв?"
      description="Отзыв исчезнет из списка и со страницы объявления."
      icon={<CircleAlert size={20} />}
      tone="danger"
      onClose={onClose}
      actions={(
        <>
          <Button size="sm" mode="soft" tone="neutral" stretched disabled={busy} onClick={onClose}>Назад</Button>
          <Button size="sm" mode="outline" tone="danger" stretched loading={busy} onClick={onConfirm}>Удалить</Button>
        </>
      )}
    />
  );
}
