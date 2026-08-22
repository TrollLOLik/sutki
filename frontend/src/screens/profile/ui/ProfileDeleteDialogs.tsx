import { CircleAlert, Trash2 } from 'lucide-react';
import { Button, ConfirmationDialog, DescriptionText, DialogActions, Field, Modal, TextField } from '@ui';
import type { ProfileDialog } from '../model/profileViewTypes';

interface ProfileDeleteDialogsProps {
  dialog: ProfileDialog | null;
  confirmationValue: string;
  onClose: () => void;
  onConfirmationValueChange: (value: string) => void;
  onDelete: () => void;
}

export function ProfileDeleteDialogs({ dialog, confirmationValue, onClose, onConfirmationValueChange, onDelete }: ProfileDeleteDialogsProps) {
  return (
    <>
      <Modal open={dialog === 'delete-blocked'} onClose={onClose} title="Удаление невозможно" description="Сначала завершите активные действия." icon={<CircleAlert />} tone="danger" size="sm" className="profile-delete-blocked-modal" footer={<DialogActions primary={<Button size="md" mode="solid" tone="primary" stretched onClick={onClose}>Понятно</Button>} />}>
        <div className="profile-delete-blocked-content">
          <DescriptionText as="p">У вас есть активные бронирования, заявки или опубликованные объявления.</DescriptionText>
          <DescriptionText as="p">Завершите бронирования и снимите объявления с публикации перед удалением профиля.</DescriptionText>
        </div>
      </Modal>
      <ConfirmationDialog open={dialog === 'delete'} onClose={onClose} standardTypography title="Удалить профиль?" description="Профиль, настройки и список устройств будут удалены." icon={<Trash2 size={20} />} tone="danger" actions={<><Button size="sm" mode="outline" tone="neutral" onClick={onClose}>Отмена</Button><Button size="sm" mode="outline" tone="danger" disabled={confirmationValue !== 'УДАЛИТЬ'} onClick={onDelete}>Удалить</Button></>}>
        <Field className="profile-confirm-delete-field" label="Введите «УДАЛИТЬ» для подтверждения">
          <TextField size="sm" value={confirmationValue} onChange={(event) => onConfirmationValueChange(event.target.value)} placeholder="УДАЛИТЬ" />
        </Field>
      </ConfirmationDialog>
    </>
  );
}
