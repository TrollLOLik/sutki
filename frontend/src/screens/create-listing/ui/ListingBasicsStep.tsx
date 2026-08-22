import { Chip, ChoiceCard, DescriptionText, PageTitle, SectionTitle } from '@ui';
import { CATEGORY_OPTIONS, ROOM_OPTIONS } from './createListingOptions';
import { HintCard } from './CreateListingParts';
import type { SharedStepProps } from './createListingStepTypes';

export function ListingBasicsStep({ draft, error, onUpdate, onToggleCategory }: SharedStepProps & { onToggleCategory: (value: string) => void }) {
  return (
    <div className="create-step-panel">
      <PageTitle className="create-field-label">Какое жильё вы сдаёте?</PageTitle>
      <div id="create-category" className="create-category-grid" data-validation-error={error?.anchor === 'create-category' ? 'true' : undefined}>
        {CATEGORY_OPTIONS.map(({ value, label, description, Icon }) => (
          <ChoiceCard key={value} className={`create-category-option ${draft.categoryIds.includes(value) ? 'selected' : ''}`} selected={draft.categoryIds.includes(value)} icon={<Icon size={20} />} title={label} description={description} onClick={() => onToggleCategory(value)} />
        ))}
      </div>
      <DescriptionText as="p" className="create-field-help">Выберите категорию, которая лучше всего описывает ваше жильё.</DescriptionText>

      <div className="create-section-divider" />

      <div id="create-rooms" className="create-field-section" data-validation-error={error?.anchor === 'create-rooms' ? 'true' : undefined}>
        <SectionTitle className="create-field-label">Количество комнат</SectionTitle>
        <div className="create-chip-row">
          {ROOM_OPTIONS.map((item) => <Chip key={item.value} shape={item.value === 'studio' ? 'pill' : 'circle'} selected={draft.rooms === item.value} onClick={() => onUpdate('rooms', item.value)}>{item.label}</Chip>)}
        </div>
        <DescriptionText as="p" className="create-field-help">Укажите количество комнат в вашем жилье.</DescriptionText>
      </div>

      <HintCard text="Выберите точный тип жилья — это поможет гостям быстрее найти ваше объявление и повысит количество бронирований." />
    </div>
  );
}
