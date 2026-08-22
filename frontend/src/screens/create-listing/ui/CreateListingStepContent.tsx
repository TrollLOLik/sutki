import { AlertCircle } from 'lucide-react';
import { BadgeText, CompactAlert, DescriptionText, PageTitle } from '@ui';
import { CREATE_LISTING_STEP_TITLES, TOTAL_CREATE_LISTING_STEPS } from '../model/createListingView';
import type { CreateListingController } from '../model/useCreateListingController';
import { ListingAddressStep } from './ListingAddressStep';
import { ListingBasicsStep } from './ListingBasicsStep';
import { ListingDescriptionStep } from './ListingDescriptionStep';
import { ListingDetailsStep } from './ListingDetailsStep';
import { ListingPhotosStep } from './ListingPhotosStep';
import { ListingReviewStep } from './ListingReviewStep';

export function CreateListingStepContent({ controller }: { controller: CreateListingController }) {
  const { step, draft, error } = controller;
  return (
    <section className="create-form-column">
      <div className="create-desktop-step-header">
        <div><PageTitle>Новое объявление</PageTitle><DescriptionText as="p">{CREATE_LISTING_STEP_TITLES[step]}</DescriptionText></div>
        <span>{step + 1}/{TOTAL_CREATE_LISTING_STEPS}</span>
        <div className="create-desktop-progress" aria-label={`Шаг ${step + 1} из ${TOTAL_CREATE_LISTING_STEPS}`}>
          {CREATE_LISTING_STEP_TITLES.map((title, index) => <i key={title} className={index <= step ? 'complete' : undefined} />)}
        </div>
      </div>
      <BadgeText className="create-mobile-step-label" color="muted">Шаг {step + 1} из {TOTAL_CREATE_LISTING_STEPS}</BadgeText>
      {error ? <CompactAlert className="create-error-banner" tone="warning" icon={<AlertCircle />}>{error.message}</CompactAlert> : null}
      {step === 0 ? <ListingBasicsStep draft={draft} error={error} onUpdate={controller.update} onToggleCategory={controller.toggleCategory} /> : null}
      {step === 1 ? <ListingAddressStep draft={draft} error={error} cityFocused={controller.cityFocused} streetFocused={controller.streetFocused} houseFocused={controller.houseFocused} mapFound={controller.mapFound} mapPoint={controller.mapPoint} onUpdate={controller.update} onCityFocusedChange={controller.setCityFocused} onStreetFocusedChange={controller.setStreetFocused} onHouseFocusedChange={controller.setHouseFocused} onMapFoundChange={controller.setMapFound} onMapPointChange={controller.setMapPoint} /> : null}
      {step === 2 ? <ListingDetailsStep draft={draft} error={error} onUpdate={controller.update} onToggleAmenity={controller.toggleAmenity} /> : null}
      {step === 3 ? <ListingDescriptionStep draft={draft} error={error} onUpdate={controller.update} onImproveDescription={controller.improveDescription} onTransformDescription={controller.transformDescription} onSelectRule={controller.selectRule} /> : null}
      {step === 4 ? <ListingPhotosStep photos={controller.photos} error={error} fileInputRef={controller.fileInputRef} onPhotosChange={controller.handlePhotos} onMakeCover={controller.makeCover} onRemovePhoto={controller.removePhoto} onMovePhoto={controller.movePhoto} /> : null}
      {step === 5 ? <ListingReviewStep draft={draft} photos={controller.photos} categoryName={controller.category?.label} amenityNames={controller.selectedAmenityNames} onEditStep={controller.jumpToStep} /> : null}
    </section>
  );
}
