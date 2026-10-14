'use client';

// The translations list's toolbar: product search, the status filter, saved views, refresh.

import { SearchInput } from '@wizeworks/silicaui-react';
import { PaneToolbar } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import type { ProductStatus } from './translations-data';

/** The status chips ARE questions someone opens this list to answer. Each maps
 *  to a server-side filter, never a browser sieve over the loaded page. */
export const STATUS_FILTERS = [
  { value: 'all', label: 'All', status: undefined, includeArchived: false },
  { value: 'active', label: 'On sale', status: 'active', includeArchived: false },
  { value: 'draft', label: 'Drafts', status: 'draft', includeArchived: false },
  { value: 'archived', label: 'Retired', status: 'archived', includeArchived: true },
] as const satisfies readonly {
  value: string;
  label: string;
  status: ProductStatus | undefined;
  includeArchived: boolean;
}[];

export type StatusFilterValue = (typeof STATUS_FILTERS)[number]['value'];

interface TranslationsToolbarProps {
  search: string;
  /** Every change to what is asked for starts again from the first page. */
  onSearch: (next: string) => void;
  statusFilter: StatusFilterValue;
  onStatusFilter: (next: StatusFilterValue) => void;
  isFetching: boolean;
  updatedAt: number | undefined;
  onRefresh: () => void;
}

export function TranslationsToolbar(props: TranslationsToolbarProps) {
  const { search, onSearch } = props;
  return (
    <PaneToolbar
      label="Translations controls"
      search={
        <div className="max-w-xs min-w-0 flex-1">
          <SearchInput
            size="sm"
            aria-label="Search products"
            placeholder="Product name or web address…"
            value={search}
            onValueChange={onSearch}
          />
        </div>
      }
      filters={[
        {
          label: 'Status',
          key: 'status',
          value: props.statusFilter,
          onValueChange: (next) => {
            props.onStatusFilter((next as StatusFilterValue | null) ?? 'all');
          },
          options: STATUS_FILTERS,
        },
      ]}
      views={{
        target: '/cms/translations',
        params: { q: search },
        onApply: (next) => {
          onSearch(next.q ?? '');
        },
      }}
      refresh={
        <RefreshButton
          isFetching={props.isFetching}
          updatedAt={props.updatedAt}
          onRefresh={props.onRefresh}
        />
      }
    />
  );
}
