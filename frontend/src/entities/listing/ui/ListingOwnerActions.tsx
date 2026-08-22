import { Edit3, EyeOff, Rocket, UploadCloud } from 'lucide-react';
import { Button } from '@ui';

type ListingOwnerActionsProps = {
  onEdit?: () => void;
  onPromote?: () => void;
  onUnpublish?: () => void;
  onPublish?: () => void;
  className?: string;
};

export function ListingOwnerActions({ onEdit, onPromote, onUnpublish, onPublish, className = '' }: ListingOwnerActionsProps) {
  if (!onEdit && !onPromote && !onUnpublish && !onPublish) return null;

  return (
    <div className={`listing-owner-actions ${className}`.trim()}>
      {onEdit ? <Button className="primary" size="md" mode="solid" tone="primary" startIcon={<Edit3 size={17} />} onClick={onEdit}>Изменить</Button> : null}
      {onPromote ? <Button className="tinted" size="md" mode="soft" tone="primary" startIcon={<Rocket size={17} />} onClick={onPromote}>Продвигать</Button> : null}
      {onUnpublish ? <Button size="md" mode="outline" tone="neutral" startIcon={<EyeOff size={17} />} onClick={onUnpublish}>Снять</Button> : null}
      {onPublish ? <Button className="tinted" size="md" mode="soft" tone="primary" startIcon={<UploadCloud size={17} />} onClick={onPublish}>Опубликовать</Button> : null}
    </div>
  );
}
