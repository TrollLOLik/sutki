import { Check, Ruler, UsersRound, WalletCards } from 'lucide-react';
import { BodyText, Field, Pressable, TextField } from '@ui';
import { onlyDigits } from '../model/createListingView';
import { AMENITIES } from './createListingOptions';
import { HintCard, StepHeading } from './CreateListingParts';
import type { SharedStepProps } from './createListingStepTypes';

export function ListingDetailsStep({ draft, error, onUpdate, onToggleAmenity }: SharedStepProps & { onToggleAmenity: (id: string) => void }) {
  return (
    <div className="create-step-panel">
      <HintCard text="Укажите параметры жилья и удобства. Это поможет гостям точно понять, что их ждёт." />
      <div className="create-numeric-grid">
        <Field id="create-area" className="create-form-field" label="Площадь, м²" labelFor="create-area-input" error={error?.anchor === 'create-area' ? error.message : undefined} messageId="create-area-error" data-validation-error={error?.anchor === 'create-area' ? 'true' : undefined}><TextField id="create-area-input" className="create-input-wrap" size="md" before={<Ruler size={18} />} invalid={error?.anchor === 'create-area'} inputMode="numeric" value={draft.area} placeholder="45" onChange={(event) => onUpdate('area', onlyDigits(event.target.value))} /></Field>
        <Field id="create-price" className="create-form-field" label="Цена за ночь, ₽" labelFor="create-price-input" error={error?.anchor === 'create-price' ? error.message : undefined} messageId="create-price-error" data-validation-error={error?.anchor === 'create-price' ? 'true' : undefined}><TextField id="create-price-input" className="create-input-wrap" size="md" before={<WalletCards size={18} />} invalid={error?.anchor === 'create-price'} inputMode="numeric" value={draft.price} placeholder="2500" onChange={(event) => onUpdate('price', onlyDigits(event.target.value))} /></Field>
        <Field id="create-guests" className="create-form-field" label="Гостей (макс.)" labelFor="create-guests-input" error={error?.anchor === 'create-guests' ? error.message : undefined} messageId="create-guests-error" data-validation-error={error?.anchor === 'create-guests' ? 'true' : undefined}><TextField id="create-guests-input" className="create-input-wrap" size="md" before={<UsersRound size={18} />} invalid={error?.anchor === 'create-guests'} inputMode="numeric" value={draft.maxGuests} placeholder="4" onChange={(event) => onUpdate('maxGuests', onlyDigits(event.target.value))} /></Field>
      </div>
      <div className="create-field-section">
        <StepHeading title="Удобства" text="" compact />
        <div className="create-amenity-grid">
          {AMENITIES.map(({ id, label, Icon }) => <Pressable key={id} className={draft.amenities.includes(id) ? 'selected' : ''} aria-pressed={draft.amenities.includes(id)} onClick={() => onToggleAmenity(id)}><Icon size={20} /><BodyText weight={500} color="inherit">{label}</BodyText>{draft.amenities.includes(id) ? <Check size={15} /> : null}</Pressable>)}
        </div>
      </div>
    </div>
  );
}
