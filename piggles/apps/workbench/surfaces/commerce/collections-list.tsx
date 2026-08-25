'use client';

// The groups-of-products list.
//
// A group is a set of products shown together — a sale, a gift
// guide, new arrivals. Two facts distinguish one from another, and this table is
// built around them: whether it fills itself from rules (AUTOMATIC) or is a list
// you HAND-PICK, and how many products are in it. A featured group carries a
// state badge; recency rides its own column so the list can be sorted by it.
//
// It is a real <Table> like the invoicing list, not a <ul> of buttons: the same
// sortable headers backed by SERVER-SIDE sort, the same server-paged window via
// <ListPagination>, and the same progressive column disclosure by @container — a
// group pane is 320px beside an editor or the whole window, and only pane
// width can decide how many columns fit.

import { useState } from 'react';
import { PaneWaiting } from '../../components/pane-waiting';
import { Card, EmptyState, SearchInput } from '@wizeworks/silicaui-react';
import { faLayerGroup, faPlus } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { ListPagination, MAX_TAKE, type PageSize } from '../../components/list-pagination';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { ListEmptyState } from '../../components/list-empty-state';
import { RefreshButton } from '../../components/refresh-button';
import type { OpenTarget, SurfaceContext } from '../../lib/surfaces/registry';
import {
  useCollectionsPage,
  type CollectionSort,
  type CollectionSummary,
  type CollectionType,
  type SortDir,
} from './collections-data';
import { RowOpenHint } from '../../components/row-open-hint';
import { CollectionsTable } from './collections-list-table';

/** Registry module for this surface, so the brand's empty-state artwork is this
 *  app's own picture rather than the generic one. */
const MODULE = 'commerce';

const TYPE_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'rules', label: 'Automatic' },
  { value: 'manual', label: 'Hand-picked' },
] as const;

function targetFor(event: { shiftKey: boolean; altKey: boolean }): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

export function CollectionsListSurface({ ctx }: { ctx: SurfaceContext }) {
  const [search, setSearch] = useState('');
  const [type, setType] = useState<string>('all');
  // Most recently changed first — the default a curation list wants, and the
  // reason the endpoint needed a real `sort_by`/`order` rather than a hardcoded
  // orderBy.
  const [sort, setSort] = useState<{ key: CollectionSort; dir: SortDir }>({
    key: 'updatedAt',
    dir: 'desc',
  });

  const [pageSize, setPageSize] = useState<PageSize>(50);
  const [page, setPage] = useState(1);
  const [take, setTake] = useState<number>(50);
  const skip = (page - 1) * pageSize;

  const { data, isPending, isError, isFetching, dataUpdatedAt, refetch } = useCollectionsPage({
    q: search,
    type: type === 'all' ? undefined : (type as CollectionType),
    sortBy: sort.key,
    order: sort.dir,
    take,
    skip,
  });

  const rows = data?.items ?? [];
  const total = data?.total;
  const anyFilter = search.trim() !== '' || type !== 'all';

  /** Anything that changes WHICH rows match returns to the first window — staying
   *  on page 5 of a result set that now has two pages shows nothing. */
  const resetWindow = () => {
    setPage(1);
    setTake(pageSize);
  };

  const toggleSort = (key: CollectionSort) => {
    setSort((current) =>
      current.key === key
        ? { key, dir: current.dir === 'asc' ? 'desc' : 'asc' }
        : // Count and recency read best largest/newest first; text ascends.
          { key, dir: key === 'productCount' || key === 'updatedAt' ? 'desc' : 'asc' }
    );
    resetWindow();
  };

  const open = (row: CollectionSummary, event: { shiftKey: boolean; altKey: boolean }) => {
    ctx.open('commerce.collection.detail', { id: row.id }, { target: targetFor(event) });
  };

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar
        label="Group list controls"
        search={
          <div className="max-w-xs min-w-0 flex-1">
            <SearchInput
              size="sm"
              aria-label="Search your groups of products"
              placeholder="Search your groups…"
              value={search}
              onValueChange={(next) => {
                setSearch(next);
                resetWindow();
              }}
            />
          </div>
        }
        primaryAction={{
          label: 'Add a group',
          icon: faPlus,
          onClick: (event) => {
            ctx.open('commerce.collection.detail', { id: 'new' }, { target: targetFor(event) });
          },
          title: 'Add a group — hold Shift to open alongside, Alt for a new window',
        }}
        filters={[
          {
            label: 'How it fills',
            key: 'type',
            value: type,
            onValueChange: (next) => {
              setType(next ?? 'all');
              resetWindow();
            },
            options: TYPE_FILTERS,
          },
        ]}
        views={{
          target: '/commerce/collections',
          params: { q: search.trim(), sort: `${sort.key}:${sort.dir}` },
          onApply: (next) => {
            setSearch(next.q ?? '');
            const [key, dir] = (next.sort ?? '').split(':');
            if (key && (dir === 'asc' || dir === 'desc')) {
              setSort({ key: key as CollectionSort, dir });
            }
            resetWindow();
          },
        }}
        refresh={
          <RefreshButton
            isFetching={isFetching}
            updatedAt={data ? dataUpdatedAt : undefined}
            onRefresh={() => {
              void refetch();
            }}
          />
        }
      />

      <Card className="min-h-0 flex-1 overflow-y-auto">
        {isError ? (
          <EmptyState
            title="Could not load your groups"
            description="Something went wrong reaching the server. It may be temporary — try again in a moment."
          />
        ) : isPending ? (
          <PaneWaiting />
        ) : rows.length === 0 ? (
          <ListEmptyState
            module={MODULE}
            filtered={anyFilter}
            noResults={{
              icon: <Icon glyph={faLayerGroup} className="size-6" aria-hidden />,
              title: 'Nothing matches those filters',
              description: 'Try a different word, or switch the filter back to All.',
            }}
            firstRun={{
              title: 'No groups yet',
              description:
                'A group is a set of products you show together — a sale, a gift guide, what is new this month. Add your first one to get started.',
            }}
          />
        ) : (
          <CollectionsTable rows={rows} sort={sort} onToggleSort={toggleSort} onOpen={open} />
        )}
      </Card>

      <div className="shrink-0">
        <ListPagination
          shown={rows.length}
          firstRow={rows.length === 0 ? 0 : skip + 1}
          total={total}
          page={page}
          pageSize={pageSize}
          canLoadMore={take < MAX_TAKE}
          busy={isFetching}
          onLoadMore={() => {
            setTake((current) => Math.min(current + pageSize, MAX_TAKE));
          }}
          onPageChange={(next) => {
            setPage(next);
            setTake(pageSize);
          }}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
            setTake(size);
          }}
        />
        <RowOpenHint />
      </div>
    </div>
  );
}
