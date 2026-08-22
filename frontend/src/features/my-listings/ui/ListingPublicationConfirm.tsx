import { EyeOff, Send, X } from 'lucide-react';
import { useLayoutEffect, useState } from 'react';
import { Button, ConfirmationDialog } from '@ui';

type ListingPublicationConfirmProps = {
  mode: 'publish' | 'unpublish' | null;
  onClose: () => void;
  onConfirm: () => void;
};

export function ListingPublicationConfirm({ mode, onClose, onConfirm }: ListingPublicationConfirmProps) {
  const [renderedMode, setRenderedMode] = useState<'publish' | 'unpublish'>(mode ?? 'unpublish');
  useLayoutEffect(() => {
    if (mode) setRenderedMode(mode);
  }, [mode]);
  const publishing = renderedMode === 'publish';

  return (
    <ConfirmationDialog
      open={mode != null}
      onClose={onClose}
      title={publishing ? 'Опубликовать объявление снова?' : 'Снять объявление с публикации?'}
      description={publishing ? 'Объявление снова появится в поиске.' : 'Объявление исчезнет из поиска. Активное продвижение будет приостановлено.'}
      icon={publishing ? <Send size={20} /> : <EyeOff size={20} />}
      tone={publishing ? 'primary' : 'danger'}
      actions={<>
        <Button size="sm" mode="soft" tone="neutral" startIcon={<X size={17} />} onClick={onClose}>Отмена</Button>
        <Button size="sm" mode={publishing ? 'solid' : 'outline'} tone={publishing ? 'primary' : 'danger'} startIcon={publishing ? <Send size={17} /> : <EyeOff size={17} />} onClick={onConfirm}>{publishing ? 'Опубликовать' : 'Снять'}</Button>
      </>}
    />
  );
}
