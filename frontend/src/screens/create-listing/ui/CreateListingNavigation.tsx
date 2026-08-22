import { Check, Info, ShieldCheck } from 'lucide-react';
import type { CSSProperties } from 'react';
import { AppHeader, BadgeText, BodyText, Button, CompactAlert, DescriptionText, Pressable, RouteActionBarPortal } from '@ui';
import { CREATE_LISTING_STEP_TITLES, TOTAL_CREATE_LISTING_STEPS, getCreateListingStepDescription } from '../model/createListingView';
import type { CreateListingController } from '../model/useCreateListingController';

export function CreateListingHeader({ controller }: { controller: CreateListingController }) {
  return (
    <div className="create-page-header">
      <AppHeader
        className="create-page-app-header"
        sticky={false}
        title="Новое объявление"
        subtitle={CREATE_LISTING_STEP_TITLES[controller.step]}
        onBack={controller.step > 0 ? controller.goBack : undefined}
        onClose={controller.step === 0 ? controller.goBack : undefined}
        actions={<div className="create-save-state" aria-live="polite" title={controller.saved ? 'Черновик сохранён' : 'Сохраняем черновик'}><BadgeText>{controller.step + 1}/{TOTAL_CREATE_LISTING_STEPS}</BadgeText></div>}
      />
      <div className="create-progress-bars" aria-label={`Шаг ${controller.step + 1} из ${TOTAL_CREATE_LISTING_STEPS}`}>
        {CREATE_LISTING_STEP_TITLES.map((title, index) => <Pressable key={title} className={index <= controller.step ? 'complete' : ''} disabled={index > controller.maxVisitedStep} onClick={() => controller.jumpToStep(index)} aria-label={`Шаг ${index + 1}: ${title}`} />)}
      </div>
    </div>
  );
}

export function CreateListingSidebar({ controller }: { controller: CreateListingController }) {
  return (
    <aside className="create-desktop-sidebar">
      <div className="create-sidebar-card">
        <span className="create-sidebar-step">{controller.step + 1}</span>
        <div><BodyText as="strong" weight={500}>{CREATE_LISTING_STEP_TITLES[controller.step]}</BodyText><DescriptionText as="p">{getCreateListingStepDescription(controller.step)}</DescriptionText></div>
      </div>
      <ol className="create-step-list">
        {CREATE_LISTING_STEP_TITLES.map((title, index) => (
          <li key={title} className={`${index === controller.step ? 'active' : ''} ${index < controller.step ? 'done' : ''}`}>
            <Pressable disabled={index > controller.maxVisitedStep} onClick={() => controller.jumpToStep(index)}>
              <span>{index < controller.step ? <Check size={15} /> : index + 1}</span>
              <div><BodyText as="strong" weight={500}>{title}</BodyText><BadgeText as="small" weight={400} color="muted">{index === controller.step ? 'Текущий шаг' : index < controller.step ? 'Заполнено' : 'Впереди'}</BadgeText></div>
            </Pressable>
          </li>
        ))}
      </ol>
      <CompactAlert className="create-sidebar-hint" tone="info" icon={<Info />}>Черновик сохраняется автоматически в этом браузере.</CompactAlert>
      <div className="create-desktop-action"><CreateListingPrimaryAction controller={controller} iconSize={16} /></div>
    </aside>
  );
}

function CreateListingPrimaryAction({ controller, iconSize }: { controller: CreateListingController; iconSize: number }) {
  return controller.step < TOTAL_CREATE_LISTING_STEPS - 1
    ? <Button className="primary-button" size="md" mode="solid" tone="primary" onClick={controller.goNext}>Далее</Button>
    : <Button className="create-publish-button" size="md" mode="solid" tone="primary" startIcon={<ShieldCheck size={iconSize} />} onClick={controller.publish}>Опубликовать</Button>;
}

export function CreateListingActionBar({ controller }: { controller: CreateListingController }) {
  const style = { '--create-keyboard-offset': `${controller.keyboardOffset}px` } as CSSProperties;
  return (
    <RouteActionBarPortal contextClassName="create-page-shell" contextStyle={style}>
      <footer className="create-page-footer">
        <div className="create-footer-inner">
          <Button className="create-secondary-button" size="md" mode="outline" tone="neutral" onClick={controller.goBack}>{controller.step === 0 ? 'Закрыть' : 'Назад'}</Button>
          <CreateListingPrimaryAction controller={controller} iconSize={19} />
        </div>
      </footer>
    </RouteActionBarPortal>
  );
}
