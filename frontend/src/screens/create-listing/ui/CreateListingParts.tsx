import { Clock3, ImagePlus, Lightbulb, MapPin, Sparkles, type LucideIcon } from 'lucide-react';
import type { CreateListingDraft, ListingPhoto, RuleValue } from '../model/createListingDraft';
import { formatListingPrice, getListingDraftTitle } from '../model/createListingView';
import { BadgeText, BodyText, Button, Chip, CompactAlert, DescriptionText, PageTitle, SectionTitle } from '@ui';

export function StepHeading({ title, text, compact = false }: { title: string; text: string; compact?: boolean }) {
  return <div className={`create-step-heading ${compact ? 'compact' : ''}`}><PageTitle>{title}</PageTitle>{text ? <DescriptionText as="p">{text}</DescriptionText> : null}</div>;
}

export function HintCard({ text, title = 'Подсказка' }: { text: string; title?: string }) {
  return <CompactAlert className="create-hint-card" tone="info" icon={<Lightbulb size={21} />} title={title}>{text}</CompactAlert>;
}

export function RuleSelector({ icon: Icon, title, value, options, onSelect }: { icon: LucideIcon; title: string; value: RuleValue; options: readonly { value: string; label: string }[]; onSelect: (value: RuleValue) => void }) {
  return (
    <section className="create-rule-row">
      <div className="create-rule-title"><span><Icon size={19} /></span><BodyText as="strong" weight={500}>{title}</BodyText></div>
      <div className="create-chip-row compact">
        {options.map((option) => <Chip key={option.value} selected={value === option.value} onClick={() => onSelect(option.value as RuleValue)}>{option.label}</Chip>)}
      </div>
    </section>
  );
}

export function PhotoTip({ Icon, title, text }: { Icon: LucideIcon; title: string; text: string }) {
  return <article><span><Icon size={20} /></span><div><BodyText as="strong" weight={500}>{title}</BodyText><DescriptionText as="small">{text}</DescriptionText></div></article>;
}

export function ReviewRow({ title, value, onEdit }: { title: string; value: string; onEdit: () => void }) {
  return <div className="create-review-row"><div><BodyText as="strong" weight={500}>{title}</BodyText><DescriptionText truncate>{value || 'Не заполнено'}</DescriptionText></div><Button size="sm" mode="ghost" tone="primary" onClick={onEdit}>Изменить</Button></div>;
}

export function ListingPreview({ draft, photos, categoryName, amenityNames }: { draft: CreateListingDraft; photos: ListingPhoto[]; categoryName?: string; amenityNames: string[] }) {
  return (
    <article className="create-listing-preview">
      <BadgeText className="create-preview-photo-count" color="muted">Фотографии ({photos.length} / 10)</BadgeText>
      <div className="create-preview-image">
        {photos[0] ? <img src={photos[0].url} alt="Обложка объявления" /> : <div><ImagePlus size={40} /><DescriptionText>Фотографии пока не добавлены</DescriptionText></div>}
        <BadgeText className="create-preview-category" color="inverse">{categoryName || 'Жильё'}</BadgeText>
        <SectionTitle as="strong" color="inverse">{formatListingPrice(draft.price)} / ночь</SectionTitle>
      </div>
      <div className="create-preview-body">
        <SectionTitle>{getListingDraftTitle(draft.rooms)}</SectionTitle>
        <DescriptionText as="p" className="create-preview-address"><MapPin size={17} />{[draft.city, draft.street, draft.houseNumber].filter(Boolean).join(', ') || 'Адрес не указан'}</DescriptionText>
        <div className="create-preview-facts"><BadgeText color="secondary">{draft.rooms === 'studio' ? 'студия' : `${draft.rooms || '—'} комн.`}</BadgeText><BadgeText color="secondary">{draft.area || '—'} м²</BadgeText>{draft.maxGuests ? <BadgeText color="secondary">до {draft.maxGuests} гостей</BadgeText> : null}</div>
        <DescriptionText as="p" className="create-preview-description">{draft.description || 'Добавьте описание, чтобы гости быстрее поняли преимущества жилья.'}</DescriptionText>
        {amenityNames.length ? <DescriptionText as="p" className="create-preview-amenities"><Sparkles size={17} />{amenityNames.slice(0, 4).join(' · ')}</DescriptionText> : null}
        <DescriptionText as="p" className="create-preview-time"><Clock3 size={17} />Заезд после {draft.checkInAfter} · выезд до {draft.checkOutBefore}</DescriptionText>
      </div>
    </article>
  );
}
