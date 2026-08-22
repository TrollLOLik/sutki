import type { CreateListingDraft, ValidationError } from '../model/createListingDraft';

export type CreateListingDraftUpdater = <K extends keyof CreateListingDraft>(key: K, value: CreateListingDraft[K]) => void;

export interface SharedStepProps {
  draft: CreateListingDraft;
  error: ValidationError | null;
  onUpdate: CreateListingDraftUpdater;
}
