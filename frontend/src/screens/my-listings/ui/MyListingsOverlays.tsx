import { Check, CircleAlert } from 'lucide-react';
import { ListingPublicationConfirm, type OwnerListing } from '@features/my-listings';
import { FilterSheet } from '@features/search-filters';
import type { SearchFilters } from '@shared/types/filters';
import { Button, Chip, ConfirmationDialog, SectionTitle } from '@ui';
import { statusOptions, type MyListingsFilterStatus } from '../model/myListingsView';

interface MyListingsOverlaysProps {
  filtersOpen: boolean;
  filters: SearchFilters;
  draftStatuses: MyListingsFilterStatus[];
  unpublishItem: OwnerListing | null;
  publishItem: OwnerListing | null;
  publicationError: boolean;
  onCloseFilters: () => void;
  onResetStatuses: () => void;
  onToggleDraftStatus: (status: MyListingsFilterStatus) => void;
  onApplyFilters: (filters: SearchFilters) => void;
  getResultCount: (filters: SearchFilters) => number;
  onClosePublication: () => void;
  onConfirmPublication: () => void;
  onClosePublicationError: () => void;
}

export function MyListingsOverlays(props: MyListingsOverlaysProps) {
  return (
    <>
      <FilterSheet
        open={props.filtersOpen}
        value={props.filters}
        hideOwnListingsToggle
        onClose={props.onCloseFilters}
        onResetExtra={props.onResetStatuses}
        onApply={props.onApplyFilters}
        resultCount={props.getResultCount}
        extraSection={(
          <section className="filter-card filter-spaced-card my-listings-status-filter">
            <div className="filter-section">
              <SectionTitle as="h3">Статус</SectionTitle>
              <div className="chip-grid">
                {statusOptions.map((option) => <Chip key={option.value} selected={props.draftStatuses.includes(option.value)} onClick={() => props.onToggleDraftStatus(option.value)}>{option.label}</Chip>)}
              </div>
            </div>
          </section>
        )}
      />

      <ListingPublicationConfirm
        mode={props.unpublishItem ? 'unpublish' : props.publishItem ? 'publish' : null}
        onClose={props.onClosePublication}
        onConfirm={props.onConfirmPublication}
      />
      <ConfirmationDialog open={props.publicationError} onClose={props.onClosePublicationError} title="Не удалось изменить статус" description="Проверьте введённые данные и попробуйте ещё раз." icon={<CircleAlert size={20} />} tone="primary" singleAction actions={<Button size="sm" mode="solid" tone="primary" startIcon={<Check size={17} />} onClick={props.onClosePublicationError}>Понятно</Button>} />
    </>
  );
}
