import { CircleAlert, CircleCheck, RotateCcw } from 'lucide-react';
import { useRef } from 'react';
import { Button, ConfirmationDialog, Field, TextArea } from '@ui';
import type { RequestDialogState } from './types';

interface RequestDialogProps {
  dialog: RequestDialogState;
  reason: string;
  busy: boolean;
  onReasonChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}

export function RequestDialog({ dialog, reason, busy, onReasonChange, onClose, onSubmit }: RequestDialogProps) {
  const lastDialogRef = useRef<Exclude<RequestDialogState, null> | null>(null);
  if (dialog) lastDialogRef.current = dialog;
  const activeDialog = dialog ?? lastDialogRef.current;
  if (!activeDialog) return null;
  const isReject = activeDialog.type === 'reject';
  const asksReason = isReject || activeDialog.type === 'cancel';
  const title = activeDialog.type === 'confirm' ? 'Подтвердить заявку?' : activeDialog.type === 'cancel' ? 'Отменить заявку?' : 'Отклонить заявку';
  const subtitle = activeDialog.type === 'confirm'
    ? 'Гость получит подтверждение брони.'
    : activeDialog.type === 'cancel'
      ? 'Укажите причину отмены — владелец увидит её в бронировании.'
      : 'Причина поможет гостю понять ваше решение.';
  const action = activeDialog.type === 'confirm' ? 'Подтвердить' : activeDialog.type === 'cancel' ? 'Отменить заявку' : 'Отклонить';
  const DialogIcon = activeDialog.type === 'confirm' ? CircleCheck : activeDialog.type === 'cancel' ? RotateCcw : CircleAlert;

  return (
    <ConfirmationDialog
      open={Boolean(dialog)}
      title={title}
      description={subtitle}
      icon={<DialogIcon size={20} />}
      tone={activeDialog.type === 'confirm' ? 'primary' : 'danger'}
      onClose={onClose}
      actions={(
        <>
          <Button size="sm" mode="soft" tone="neutral" stretched disabled={busy} onClick={onClose}>Назад</Button>
          <Button size="sm" mode={activeDialog.type === 'confirm' ? 'solid' : 'outline'} tone={activeDialog.type === 'confirm' ? 'primary' : 'danger'} stretched loading={busy} onClick={onSubmit}>{action}</Button>
        </>
      )}
    >
      {asksReason ? <Field label={isReject ? 'Причина отклонения (необязательно)' : 'Причина отмены (необязательно)'} labelFor="request-action-reason"><TextArea id="request-action-reason" value={reason} onChange={(event) => onReasonChange(event.target.value)} placeholder={isReject ? 'Причина отклонения' : 'Причина отмены'} autoFocus /></Field> : null}
    </ConfirmationDialog>
  );
}
