import { IconButton } from '@/components/ui/IconButton';
import type { ListingLayoutMode } from '@/store/listing-layout';

interface ListingLayoutToggleProps {
  mode: ListingLayoutMode;
  onToggle: () => void;
  marginRight?: number;
}

export function ListingLayoutToggle({
  mode,
  onToggle,
  marginRight = 0,
}: ListingLayoutToggleProps) {
  const nextModeLabel = mode === 'list' ? 'Показать сеткой' : 'Показать списком';

  return (
    <IconButton
      accessibilityLabel={nextModeLabel}
      accessibilityHint="Меняет вид карточек объявлений"
      icon={mode === 'list' ? 'grid-outline' : 'list-outline'}
      iconSize={22}
      onPress={onToggle}
      size={48}
      surface="floating"
      tone="primary"
      style={{ marginRight }}
    />
  );
}
