'use client';

// Search, the status chips, Add a product, saved views, refresh.
//
// Slots, not children: the bar decides what gives way, and on a narrow pane the
// chips relocate into its popover rather than spilling onto a second row.
// `activeControls` is what keeps that honest — a list showing eight of forty
// products has to say so even when the chip saying it is folded away. "All" is
// the null state and counts as nothing.

import { SearchInput } from '@wizeworks/silicaui-react';
import { faPlus } from '@fortawesome/pro-solid-svg-icons';
import { PaneToolbar } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import type { ProductSortKey, SortDirection } from './products-data';
import { FILTERS, type FilterValue, type Modifiers } from './products-list-shared';

export function ProductsListToolbar({
  search,
  onSearch,
  filter,
  onFilter,
  sort,
  onSort,
  onCreate,
  isFetching,
  updatedAt,
  onRefresh,
}: {
  search: string;
  onSearch: (next: string) => void;
  filter: FilterValue;
  onFilter: (next: FilterValue) => void;
  sort: { key: ProductSortKey; dir: SortDirection };
  onSort: (next: { key: ProductSortKey; dir: SortDirection }) => void;
  onCreate: (event: Modifiers) => void;
  isFetching: boolean;
  updatedAt: number | undefined;
  onRefresh: () => void;
}) {
  return (
    <PaneToolbar
      label="Product list controls"
      activeControls={filter === 'all' ? 0 : 1}
      search={
        <SearchInput
          size="sm"
          aria-label="Search products"
          placeholder="Product name or brand…"
          value={search}
          onValueChange={(next) => {
            onSearch(next);
          }}
        />
      }
      filters={[
        {
          label: 'Show',
          // The chips ARE the statuses, so that is the name they persist under —
          // and what the platform's seeded "Drafts" view speaks.
          key: 'status',
          value: filter,
          onValueChange: (next) => {
            onFilter((next as FilterValue | null) ?? 'all');
          },
          options: FILTERS,
        },
      ]}
      primaryAction={{
        label: 'Add a product',
        icon: faPlus,
        onClick: onCreate,
        title: 'Add a product — hold Shift to open alongside, Alt for a new window',
      }}
      views={{
        target: '/commerce/products',
        params: { q: search.trim(), sort: `${sort.key}:${sort.dir}` },
        onApply: (next) => {
          onSearch(next.q ?? '');
          const [key, dir] = (next.sort ?? '').split(':');
          if (key && (dir === 'asc' || dir === 'desc')) {
            onSort({ key: key as ProductSortKey, dir });
          }
        },
      }}
      refresh={
        <RefreshButton isFetching={isFetching} updatedAt={updatedAt} onRefresh={onRefresh} />
      }
    />
  );
}
