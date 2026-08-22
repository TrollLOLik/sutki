import { Home, LocateFixed, MapPin } from 'lucide-react';
import { BadgeText, BodyText, Button, DescriptionText, Field, IconButton, Pressable, TextField } from '@ui';
import { CITY_SUGGESTIONS } from './createListingOptions';
import { HintCard } from './CreateListingParts';
import type { SharedStepProps } from './createListingStepTypes';

const STREET_SUGGESTIONS = ['Корабельная', 'Коралловая', 'Коркинская', 'Красная', 'Кирова'];

interface ListingAddressStepProps extends SharedStepProps {
  cityFocused: boolean;
  streetFocused: boolean;
  houseFocused: boolean;
  mapFound: boolean;
  mapPoint: { x: number; y: number };
  onCityFocusedChange: (focused: boolean) => void;
  onStreetFocusedChange: (focused: boolean) => void;
  onHouseFocusedChange: (focused: boolean) => void;
  onMapFoundChange: (found: boolean) => void;
  onMapPointChange: (point: { x: number; y: number }) => void;
}

export function ListingAddressStep({ draft, error, onUpdate, cityFocused, streetFocused, houseFocused, mapFound, mapPoint, onCityFocusedChange, onStreetFocusedChange, onHouseFocusedChange, onMapFoundChange, onMapPointChange }: ListingAddressStepProps) {
  const address = [draft.city, draft.street, draft.houseNumber].filter(Boolean).join(', ');
  return (
    <div className="create-step-panel">
      <div className="create-address-grid">
        <Field id="create-city" className="create-form-field create-city-field" label="Город" labelFor="create-city-input" error={error?.anchor === 'create-city' ? error.message : undefined} messageId="create-city-error" data-validation-error={error?.anchor === 'create-city' ? 'true' : undefined}>
          <TextField id="create-city-input" className="create-input-wrap" size="md" before={<MapPin size={18} />} invalid={error?.anchor === 'create-city'} aria-describedby={error?.anchor === 'create-city' ? 'create-city-error' : undefined} value={draft.city} placeholder="Например, Магнитогорск" onFocus={() => onCityFocusedChange(true)} onBlur={() => window.setTimeout(() => onCityFocusedChange(false), 140)} onChange={(event) => { onUpdate('city', event.target.value); onMapFoundChange(false); }} />
          {cityFocused ? <div className="create-suggestion-list">{CITY_SUGGESTIONS.filter((city) => city.toLowerCase().includes(draft.city.toLowerCase())).slice(0, 5).map((city) => <Pressable key={city} onMouseDown={(event) => event.preventDefault()} onClick={() => { onUpdate('city', city); onCityFocusedChange(false); }}><BodyText>{city}</BodyText></Pressable>)}</div> : null}
        </Field>
        <Field id="create-street" className="create-form-field" label="Улица" labelFor="create-street-input" error={error?.anchor === 'create-street' ? error.message : undefined} messageId="create-street-error" data-validation-error={error?.anchor === 'create-street' ? 'true' : undefined}>
          <TextField id="create-street-input" className="create-input-wrap" size="md" before={<MapPin size={18} />} invalid={error?.anchor === 'create-street'} aria-describedby={error?.anchor === 'create-street' ? 'create-street-error' : undefined} value={draft.street} placeholder="Улица" onFocus={() => onStreetFocusedChange(true)} onBlur={() => window.setTimeout(() => onStreetFocusedChange(false), 120)} onChange={(event) => { onUpdate('street', event.target.value); onMapFoundChange(false); }} />
          {streetFocused && draft.street.trim() ? <div className="create-suggestion-list">{STREET_SUGGESTIONS.filter((street) => street.toLowerCase().includes(draft.street.toLowerCase())).slice(0, 5).map((street) => <Pressable key={street} onMouseDown={(event) => event.preventDefault()} onClick={() => { onUpdate('street', street); onStreetFocusedChange(false); }}><BodyText>{draft.city}, ул. {street}</BodyText></Pressable>)}</div> : null}
        </Field>
        <Field id="create-house" className="create-form-field create-house-field" label="Дом" labelFor="create-house-input" error={error?.anchor === 'create-house' ? error.message : undefined} messageId="create-house-error" data-validation-error={error?.anchor === 'create-house' ? 'true' : undefined}>
          <TextField id="create-house-input" className="create-input-wrap" size="md" before={<Home size={18} />} invalid={error?.anchor === 'create-house'} aria-describedby={error?.anchor === 'create-house' ? 'create-house-error' : undefined} value={draft.houseNumber} placeholder="Номер дома" onFocus={() => onHouseFocusedChange(true)} onBlur={() => window.setTimeout(() => onHouseFocusedChange(false), 120)} onChange={(event) => { onUpdate('houseNumber', event.target.value); onMapFoundChange(false); }} />
          {houseFocused && draft.houseNumber.trim() ? <div className="create-suggestion-list"><Pressable onMouseDown={(event) => event.preventDefault()} onClick={() => { onHouseFocusedChange(false); onMapFoundChange(true); }}><BodyText>{draft.city}, ул. {draft.street || 'Корабельная'}, д. {draft.houseNumber}</BodyText></Pressable></div> : null}
        </Field>
      </div>

      <HintCard title="Точка на карте" text="Укажите адрес и проверьте метку на карте. Гости увидят примерный район до подтверждения брони." />

      <div className="create-map-card">
        <div className="create-map-card-head">
          <div><BodyText as="strong" weight={500}>Положение дома</BodyText><DescriptionText>Переместите карту так, чтобы метка стояла на нужном доме.</DescriptionText></div>
          <IconButton variant="plain" label="Показать центр карты" icon={<LocateFixed size={18} />} onClick={() => onMapPointChange({ x: 50, y: 50 })} />
        </div>
        <Pressable className="create-map-placeholder" aria-label="Указать положение дома на карте" onClick={(event) => { const rect = event.currentTarget.getBoundingClientRect(); onMapPointChange({ x: ((event.clientX - rect.left) / rect.width) * 100, y: ((event.clientY - rect.top) / rect.height) * 100 }); onMapFoundChange(true); }}>
          <span className="create-map-road road-a" /><span className="create-map-road road-b" /><span className="create-map-road road-c" />
          <span className="create-map-block block-a" /><span className="create-map-block block-b" /><span className="create-map-block block-c" />
          <i style={{ left: `${mapPoint.x}%`, top: `${mapPoint.y}%` }}><MapPin size={25} fill="currentColor" /></i>
        </Pressable>
        {mapFound ? <div className="create-map-found"><div><BadgeText as="small" weight={400} color="muted">Найдено на карте</BadgeText><BodyText as="strong" weight={500} truncate>{address}</BodyText></div><Button size="sm" mode="ghost" tone="primary" onClick={() => onMapFoundChange(false)}>Применить</Button></div> : null}
        {!mapFound ? <div className="create-map-address"><MapPin size={17} /><DescriptionText truncate>{address || 'Адрес появится здесь'}</DescriptionText></div> : null}
      </div>
    </div>
  );
}
