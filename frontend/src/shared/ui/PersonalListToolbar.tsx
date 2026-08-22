import type { ReactNode } from 'react';
import { cx } from '../lib/cx';
import { SearchField } from './SearchField';
import { SortSurface, type SortOption } from './SortSurface';

export interface PersonalListToolbarProps<T extends string> {
  query: string;
  onQueryChange: (value: string) => void;
  placeholder: string;
  sort?: T;
  sortOptions?: readonly SortOption<T>[];
  sortOpen?: boolean;
  onSortOpenChange?: (open: boolean) => void;
  onSortChange?: (value: T) => void;
  actions?: ReactNode;
  className?: string;
}

export function PersonalListToolbar<T extends string>({ query, onQueryChange, placeholder, sort, sortOptions, sortOpen, onSortOpenChange, onSortChange, actions, className }: PersonalListToolbarProps<T>) {
  return <div className={cx('ui-personal-toolbar', className)}>
    <SearchField value={query} onChange={(event) => onQueryChange(event.target.value)} onClear={() => onQueryChange('')} placeholder={placeholder} />
    <div className="ui-personal-toolbar__actions">
      {sort !== undefined && sortOptions && sortOpen !== undefined && onSortOpenChange && onSortChange ? <SortSurface open={sortOpen} value={sort} options={sortOptions} onOpenChange={onSortOpenChange} onChange={onSortChange} /> : null}
      {actions}
    </div>
  </div>;
}
