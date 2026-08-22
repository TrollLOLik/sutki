import { ListingCard, type ListingLayoutMode } from '@entities/listing';
import { getOwnerListingCapabilities, type OwnerListing } from '@features/my-listings';

interface OwnerListingCardProps {
  item: OwnerListing;
  layout: ListingLayoutMode;
  onOpen: () => void;
  onEdit: () => void;
  onPromote: () => void;
  onUnpublish: () => void;
  onPublish: () => void;
}

export function OwnerListingCard({ item, layout, onOpen, onEdit, onPromote, onUnpublish, onPublish }: OwnerListingCardProps) {
  const actions = getOwnerListingCapabilities(item.status);
  const ownerStatus = item.status === 'active' ? undefined : {
    label: item.status === 'pending_moderation' ? 'На проверке' : item.status === 'rejected' ? 'Отклонено' : 'Снято',
    tone: item.status === 'pending_moderation' ? 'warning' as const : item.status === 'rejected' ? 'danger' as const : 'neutral' as const,
    reason: layout === 'list' ? item.rejectionReason : undefined,
  };

  return (
    <ListingCard
      className="ui-personal-collection-card"
      listing={item.listing}
      layout={layout}
      mode="owner"
      favorite={false}
      onToggleFavorite={() => undefined}
      showFavorite={false}
      onOpen={onOpen}
      onEdit={actions.canEdit ? onEdit : undefined}
      onPromote={actions.canPromote ? onPromote : undefined}
      onUnpublish={actions.canUnpublish ? onUnpublish : undefined}
      onPublish={actions.canPublish ? onPublish : undefined}
      ownerStatus={ownerStatus}
    />
  );
}
