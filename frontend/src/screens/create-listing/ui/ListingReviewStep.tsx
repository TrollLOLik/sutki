import { ShieldCheck } from 'lucide-react';
import { CompactAlert } from '@ui';
import type { CreateListingDraft, ListingPhoto } from '../model/createListingDraft';
import { formatListingPrice } from '../model/createListingView';
import { ListingPreview, ReviewRow, StepHeading } from './CreateListingParts';

interface ListingReviewStepProps {
  draft: CreateListingDraft;
  photos: ListingPhoto[];
  categoryName?: string;
  amenityNames: string[];
  onEditStep: (step: number) => void;
}

export function ListingReviewStep({ draft, photos, categoryName, amenityNames, onEditStep }: ListingReviewStepProps) {
  return (
    <div className="create-step-panel">
      <StepHeading title="Почти готово к публикации" text="Так гости увидят ключевые детали вашего жилья в поиске и карточке объявления." />
      <ListingPreview draft={draft} photos={photos} categoryName={categoryName} amenityNames={amenityNames} />
      <div className="create-review-list">
        <ReviewRow title="Тип жилья" value={`${categoryName ?? 'Не выбран'} · ${draft.rooms === 'studio' ? 'студия' : `${draft.rooms || '—'} комн.`}`} onEdit={() => onEditStep(0)} />
        <ReviewRow title="Адрес" value={[draft.city, draft.street, draft.houseNumber].filter(Boolean).join(', ')} onEdit={() => onEditStep(1)} />
        <ReviewRow title="Параметры" value={`${draft.area} м² · до ${draft.maxGuests} гостей · ${formatListingPrice(draft.price)} / ночь`} onEdit={() => onEditStep(2)} />
        <ReviewRow title="Заселение" value={`заезд после ${draft.checkInAfter} · выезд до ${draft.checkOutBefore}`} onEdit={() => onEditStep(3)} />
        <ReviewRow title="Фотографии" value={photos.length ? `${photos.length} фото` : 'Без фотографий'} onEdit={() => onEditStep(4)} />
      </div>
      <CompactAlert className="create-publish-note" tone="success" icon={<ShieldCheck />}>Размещение бесплатное. Перед публикацией проверьте адрес, цену и фотографии.</CompactAlert>
    </div>
  );
}
