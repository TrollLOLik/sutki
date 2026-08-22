import { CircleCheck, Clock3 } from 'lucide-react';
import { BadgeText, Button, DescriptionText, PageTitle } from '@ui';

interface CreateListingSuccessProps {
  editing: boolean;
  listingId: number | null;
  onPromote: (listingId: number) => void;
  onOpenMyListings: () => void;
  onClose: () => void;
}

export function CreateListingSuccess({ editing, listingId, onPromote, onOpenMyListings, onClose }: CreateListingSuccessProps) {
  return (
    <main className="create-success-page">
      <section className="create-success-card">
        <span className="create-success-icon"><CircleCheck size={48} /></span>
        <BadgeText as="p" className="create-success-status"><Clock3 size={16} />{editing ? 'Изменения сохранены' : 'Отправлено на проверку'}</BadgeText>
        <PageTitle>{editing ? 'Изменения сохранены' : 'Объявление отправлено'}</PageTitle>
        <DescriptionText as="p">{editing ? 'Карточка объявления обновлена. Все изменения уже видны в разделе «Мои объявления».' : 'После проверки объявление появится в поиске. Актуальный статус всегда доступен в разделе «Мои объявления».'}</DescriptionText>
        <div className="create-success-actions">
          {!editing && listingId ? <Button className="primary-button" size="md" mode="solid" tone="primary" onClick={() => onPromote(listingId)}>Продвинуть объявление</Button> : null}
          <Button className="create-secondary-button" size="md" mode="outline" tone="neutral" onClick={onOpenMyListings}>Мои объявления</Button>
          <Button className="create-success-home" size="md" mode="soft" tone="neutral" onClick={onClose}>На главную</Button>
        </div>
      </section>
    </main>
  );
}
