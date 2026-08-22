import { AlertTriangle, Check, CheckCircle2, LogOut, Trash2, X } from 'lucide-react';
import { Button, ConfirmationDialog } from '@ui';

interface ProfileSessionDialogsProps {
  sessionDialog: 'confirm' | 'success' | null;
  renderedSessionDialog: 'confirm' | 'success';
  sessionTargetLabel: string;
  signOutOpen: boolean;
  onCloseSessionDialog: () => void;
  onConfirmSessionRevoke: () => void;
  onCloseSignOut: () => void;
  onSignOut: () => void;
}

export function ProfileSessionDialogs({ sessionDialog, renderedSessionDialog, sessionTargetLabel, signOutOpen, onCloseSessionDialog, onConfirmSessionRevoke, onCloseSignOut, onSignOut }: ProfileSessionDialogsProps) {
  return (
    <>
      <ConfirmationDialog
        open={Boolean(sessionDialog)}
        onClose={onCloseSessionDialog}
        standardTypography
        title={renderedSessionDialog === 'confirm' ? 'Завершить сеанс?' : 'Сеанс завершён'}
        description={renderedSessionDialog === 'confirm' ? `Завершить сеанс на ${sessionTargetLabel}?` : 'Сеанс успешно завершён.'}
        icon={renderedSessionDialog === 'confirm' ? <AlertTriangle size={20} /> : <CheckCircle2 size={20} />}
        tone={renderedSessionDialog === 'confirm' ? 'danger' : 'success'}
        singleAction={renderedSessionDialog !== 'confirm'}
        actions={renderedSessionDialog === 'confirm'
          ? <><Button size="sm" mode="outline" tone="neutral" startIcon={<X />} onClick={onCloseSessionDialog}>Отмена</Button><Button size="sm" mode="outline" tone="danger" startIcon={<Trash2 />} onClick={onConfirmSessionRevoke}>Завершить</Button></>
          : <Button size="sm" mode="solid" tone="primary" startIcon={<Check />} onClick={onCloseSessionDialog}>Понятно</Button>}
      />
      <ConfirmationDialog standardTypography open={signOutOpen} onClose={onCloseSignOut} title="Выйти из аккаунта?" description="На этом устройстве потребуется снова войти по номеру телефона." icon={<AlertTriangle size={20} />} tone="danger" actions={<><Button size="sm" mode="outline" tone="neutral" startIcon={<X />} onClick={onCloseSignOut}>Отмена</Button><Button size="sm" mode="outline" tone="danger" startIcon={<LogOut />} onClick={onSignOut}>Выйти</Button></>} />
    </>
  );
}
