import { Grid2X2, List } from 'lucide-react';
import { IconButton } from '@ui';

export type ListingLayoutMode = 'list' | 'grid';

export function ListingLayoutToggle({ mode, onToggle }: { mode: ListingLayoutMode; onToggle: () => void }) {
  const Icon = mode === 'list' ? Grid2X2 : List;
  return <IconButton className="circle-control" size="md" variant="surface" label={mode === 'list' ? 'Показать сеткой' : 'Показать списком'} icon={<Icon size={21} strokeWidth={2} />} onClick={onToggle} />;
}
