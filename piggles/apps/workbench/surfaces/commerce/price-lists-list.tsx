'use client';

// The price-lists list. A SPECIAL PRICE is a set of prices for particular customers
// (a wholesale sheet, a trade rate). The platform calls it a price list; the screen
// does not, because the audience owns a shop, not a pricing engine.

import { useState } from 'react';
import { PaneWaiting } from '../../components/pane-waiting';
import { Button, Card, SearchInput, Select } from '@wizeworks/silicaui-react';
import { faPlus, faTag } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { useQuery } from '@wizeworks/query';
import { api } from '../../lib/api/client';
import type { OpenTarget, SurfaceContext } from '../../lib/surfaces/registry';
import { PaneLoadError } from '../../components/pane-load-error';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { ListEmptyState } from '../../components/list-empty-state';
import { RefreshButton } from '../../components/refresh-button';
import type { PriceListRow } from './price-lists-data';
import { PriceListsTable } from './price-lists-list-table';
import { RowOpenHint } from '../../components/row-open-hint';

/** Registry module, so the brand's empty-state artwork is this app's own picture. */
const MODULE = 'commerce';

const FILTERS = [
  { value: 'all', label: 'All', status: undefined },
  { value: 'active', label: 'Live', status: 'active' },
  { value: 'draft', label: 'Not live', status: 'draft' },
  { value: 'archived', label: 'Retired', status: 'archived' },
] as const;

type FilterValue = (typeof FILTERS)[number]['value'];
interface OpenEvent {
  shiftKey: boolean;
  altKey: boolean;
}
interface CreateAction {
  label: string;
  onClick: (event: OpenEvent) => void;
}

function targetFor(event: OpenEvent): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

function usePriceLists(search: string, filter: FilterValue) {
  const active = FILTERS.find((entry) => entry.value === filter) ?? FILTERS[0];
  return useQuery({
    queryKey: ['commerce', 'price-lists', 'list', { q: search, status: active.status }],
    queryFn: () =>
      api.list<PriceListRow>('/v1/commerce/price-lists', {
        ...(search.trim() ? { q: search.trim() } : {}),
        ...(active.status ? { status: active.status } : {}),
        take: 100,
      }),
    placeholderData: (previous) => previous,
  });
}

function PriceListsSearch({
  search,
  onSearch,
}: {
  search: string;
  onSearch: (next: string) => void;
}) {
  return (
    <div className="max-w-xs min-w-0 flex-1">
      <SearchInput
        size="sm"
        aria-label="Search special prices"
        placeholder="Search special prices…"
        value={search}
        onValueChange={onSearch}
      />
    </div>
  );
}

function AddSpecialPrice({ createFirst }: { createFirst: CreateAction }) {
  return (
    <Button
      color="module"
      size="sm"
      className="ml-auto"
      title="Add a special price: hold Shift to open alongside, Alt for a new window"
      onClick={createFirst.onClick}
    >
      <Icon glyph={faPlus} className="size-4" aria-hidden />
      {createFirst.label}
    </Button>
  );
}

function StatusPicker({
  filter,
  onFilter,
}: {
  filter: FilterValue;
  onFilter: (next: FilterValue) => void;
}) {
  return (
    <div className="w-40 shrink-0">
      <Select
        size="sm"
        aria-label="Show which special prices"
        value={filter}
        items={FILTERS.map((entry) => ({ value: entry.value, label: entry.label }))}
        onValueChange={(next) => {
          onFilter((next as FilterValue | null) ?? 'all');
        }}
      />
    </div>
  );
}

function PriceListsToolbar({
  query,
  search,
  filter,
  createFirst,
  onSearch,
  onFilter,
}: {
  query: ReturnType<typeof usePriceLists>;
  search: string;
  filter: FilterValue;
  createFirst: CreateAction;
  onSearch: (next: string) => void;
  onFilter: (next: FilterValue) => void;
}) {
  return (
    <PaneToolbar
      label="Special prices controls"
      search={<PriceListsSearch search={search} onSearch={onSearch} />}
      primary={<AddSpecialPrice createFirst={createFirst} />}
      controls={<StatusPicker filter={filter} onFilter={onFilter} />}
      views={{
        target: '/commerce/pricing',
        // The status picker lives in `controls`, not `filters`, so it rides here.
        params: { q: search.trim(), status: filter },
        onApply: (next) => {
          onSearch(next.q ?? '');
          onFilter((next.status as FilterValue | undefined) ?? 'all');
        },
      }}
      refresh={
        <RefreshButton
          isFetching={query.isFetching}
          updatedAt={query.data ? query.dataUpdatedAt : undefined}
          onRefresh={() => {
            void query.refetch();
          }}
        />
      }
    />
  );
}

function PriceListsBody({
  query,
  narrowed,
  createFirst,
  onOpen,
}: {
  query: ReturnType<typeof usePriceLists>;
  narrowed: boolean;
  createFirst: CreateAction;
  onOpen: (id: string, event: OpenEvent) => void;
}) {
  const rows = query.data?.items ?? [];
  if (query.isError) {
    return (
      <PaneLoadError
        icon={<Icon glyph={faTag} className="size-6" aria-hidden />}
        module={MODULE}
        title="Could not load your special prices"
        description="This is a problem reaching the server. Your special prices are unaffected. Nothing has been lost."
        error={query.error}
      />
    );
  }
  if (query.isPending) return <PaneWaiting />;
  if (rows.length > 0) return <PriceListsTable rows={rows} onOpen={onOpen} />;
  return (
    <ListEmptyState
      module={MODULE}
      filtered={narrowed}
      noResults={{
        icon: <Icon glyph={faTag} className="size-6" aria-hidden />,
        title: 'Nothing matches those filters',
        description: 'Try a different word, or clear the filters to see everything.',
      }}
      firstRun={{
        title: 'No special prices yet',
        description:
          'A special price is a set of prices for particular customers: a wholesale sheet for the businesses you supply, or a members’ rate. Add your first one to start giving certain customers their own prices.',
        action: createFirst,
      }}
    />
  );
}

export function PriceListsListSurface({ ctx }: { ctx: SurfaceContext }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterValue>('all');
  const query = usePriceLists(search, filter);
  const rows = query.data?.items ?? [];
  // ONE object for the toolbar's button and the empty state's invitation, so the
  // label cannot drift and the first-run state always has a button.
  const createFirst: CreateAction = {
    label: 'Add a special price',
    onClick: (event) => {
      ctx.open('commerce.pricelist.detail', { id: 'new' }, { target: targetFor(event) });
    },
  };

  return (
    <div className={PANE_SHELL}>
      <PriceListsToolbar
        query={query}
        search={search}
        filter={filter}
        createFirst={createFirst}
        onSearch={setSearch}
        onFilter={setFilter}
      />
      <Card className="min-h-0 flex-1 overflow-y-auto">
        <PriceListsBody
          query={query}
          narrowed={search.trim() !== '' || filter !== 'all'}
          createFirst={createFirst}
          onOpen={(id, event) => {
            ctx.open('commerce.pricelist.detail', { id }, { target: targetFor(event) });
          }}
        />
      </Card>
      {rows.length > 0 ? <RowOpenHint /> : null}
    </div>
  );
}
