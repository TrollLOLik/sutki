import { Baby, Cigarette, Clock3, PartyPopper, PawPrint } from 'lucide-react';
import { Button, Field, PageTitle, TextArea, TextField } from '@ui';
import type { RuleValue } from '../model/createListingDraft';
import { formatTimeInput } from '../model/createListingView';
import { RULE_OPTIONS } from './createListingOptions';
import { RuleSelector, StepHeading } from './CreateListingParts';
import type { SharedStepProps } from './createListingStepTypes';

interface ListingDescriptionStepProps extends SharedStepProps {
  onImproveDescription: () => void;
  onTransformDescription: (mode: 'short' | 'detail' | 'friendly') => void;
  onSelectRule: (key: 'smoking' | 'pets' | 'children' | 'events', value: RuleValue) => void;
}

export function ListingDescriptionStep({ draft, error, onUpdate, onImproveDescription, onTransformDescription, onSelectRule }: ListingDescriptionStepProps) {
  return (
    <div className="create-step-panel">
      <div className="create-description-head"><PageTitle>Расскажите о жилье</PageTitle><Button className="create-description-improve" size="sm" mode="ghost" tone="primary" onClick={onImproveDescription}>Улучшить текст</Button></div>
      <Field id="create-description" className="create-description-field" error={error?.anchor === 'create-description' ? error.message : undefined} messageId="create-description-error" data-validation-error={error?.anchor === 'create-description' ? 'true' : undefined}>
        <TextArea invalid={error?.anchor === 'create-description'} aria-describedby={error?.anchor === 'create-description' ? 'create-description-error' : undefined} showCount maxLength={1500} rows={Math.min(14, Math.max(7, draft.description.split('\n').length + Math.ceil(draft.description.length / 54)))} value={draft.description} placeholder="Расскажите о жилье, районе и важных деталях заселения…" onChange={(event) => onUpdate('description', event.target.value)} />
      </Field>
      <div className="create-description-prompts" aria-label="Помощь с описанием">
        <Button size="sm" mode="soft" tone="neutral" onClick={() => onTransformDescription('short')}>📝 Короче</Button>
        <Button size="sm" mode="soft" tone="neutral" onClick={() => onTransformDescription('detail')}>✍️ Подробнее</Button>
        <Button size="sm" mode="soft" tone="neutral" onClick={() => onTransformDescription('friendly')}>🙂 Дружелюбнее</Button>
      </div>
      <div className="create-section-divider" />
      <StepHeading title="Правила заселения" text="" compact />
      <div className="create-time-grid">
        <Field id="create-checkin" className="create-form-field" label="Заезд после (ЧЧ:ММ)" labelFor="create-checkin-input" error={error?.anchor === 'create-checkin' ? error.message : undefined} messageId="create-checkin-error" data-validation-error={error?.anchor === 'create-checkin' ? 'true' : undefined}><TextField id="create-checkin-input" className="create-input-wrap" size="md" before={<Clock3 size={18} />} invalid={error?.anchor === 'create-checkin'} inputMode="numeric" maxLength={5} placeholder="14:00" value={draft.checkInAfter} onChange={(event) => onUpdate('checkInAfter', formatTimeInput(event.target.value))} /></Field>
        <Field id="create-checkout" className="create-form-field" label="Выезд до (ЧЧ:ММ)" labelFor="create-checkout-input" error={error?.anchor === 'create-checkout' ? error.message : undefined} messageId="create-checkout-error" data-validation-error={error?.anchor === 'create-checkout' ? 'true' : undefined}><TextField id="create-checkout-input" className="create-input-wrap" size="md" before={<Clock3 size={18} />} invalid={error?.anchor === 'create-checkout'} inputMode="numeric" maxLength={5} placeholder="12:00" value={draft.checkOutBefore} onChange={(event) => onUpdate('checkOutBefore', formatTimeInput(event.target.value))} /></Field>
      </div>
      <div className="create-rules-stack">
        <RuleSelector icon={Cigarette} title="Курение" value={draft.smoking} options={RULE_OPTIONS.smoking} onSelect={(value) => onSelectRule('smoking', value)} />
        <RuleSelector icon={PawPrint} title="Домашние животные" value={draft.pets} options={RULE_OPTIONS.pets} onSelect={(value) => onSelectRule('pets', value)} />
        <RuleSelector icon={Baby} title="Можно с детьми" value={draft.children} options={RULE_OPTIONS.children} onSelect={(value) => onSelectRule('children', value)} />
        <RuleSelector icon={PartyPopper} title="Вечеринки и мероприятия" value={draft.events} options={RULE_OPTIONS.events} onSelect={(value) => onSelectRule('events', value)} />
      </div>
    </div>
  );
}
