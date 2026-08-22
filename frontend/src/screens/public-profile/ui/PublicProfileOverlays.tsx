import { X } from 'lucide-react';
import type { ChatUser } from '@features/chat';
import type { ListingOwner } from '@shared/data/listings';
import type { SearchFilters } from '@shared/types/filters';
import { FilterSheet, SearchOverlay } from '@features/search-filters';
import { IconButton, OverlaySurface, SectionTitle } from '@ui';

interface PublicProfileOverlaysProps {
  user?: ListingOwner | ChatUser;
  avatarOpen: boolean;
  catalogLayer: null | 'search' | 'filters';
  searchLabel: string;
  filters: SearchFilters;
  countListings: (filters: SearchFilters) => number;
  onCloseAvatar: () => void;
  onCloseCatalogLayer: () => void;
  onSearchSelect: (value: string) => void;
  onSearchSubmit: (value: string) => void;
  onApplyFilters: (filters: SearchFilters) => void;
}

export function PublicProfileOverlays(props: PublicProfileOverlaysProps) {
  return (
    <>
      {props.user ? (
        <OverlaySurface open={props.avatarOpen} onClose={props.onCloseAvatar} ariaLabel="Фото профиля" layerClassName="public-profile-avatar-layer" backdropClassName="public-profile-avatar-backdrop" className="public-profile-avatar-viewer">
          <IconButton className="public-profile-avatar-close" label="Закрыть фото" size="md" mode="soft" tone="inverse" icon={<X />} onClick={props.onCloseAvatar} />
          {props.user.avatarUrl ? <img src={props.user.avatarUrl} alt={`Фото ${props.user.surname} ${props.user.name}`} /> : <SectionTitle as="strong" color="inverse">{props.user.surname.slice(0, 1)}{props.user.name.slice(0, 1)}</SectionTitle>}
        </OverlaySurface>
      ) : null}
      <SearchOverlay open={props.catalogLayer === 'search'} initialValue={props.searchLabel} onClose={props.onCloseCatalogLayer} onSelect={props.onSearchSelect} onSubmit={props.onSearchSubmit} />
      <FilterSheet open={props.catalogLayer === 'filters'} value={props.filters} resultCount={props.countListings} hideOwnListingsToggle onClose={props.onCloseCatalogLayer} onApply={props.onApplyFilters} />
    </>
  );
}
