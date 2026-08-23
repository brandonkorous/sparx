'use client';

// The suppliers table — the businesses that hold your stock and ship it for you.
//
// A standard list surface, built like invoicing: a real <Table> with sortable
// column headers backed by SERVER-SIDE sort, and server-side paging via
// <ListPagination>. Sorting lives on the server because the list pages — sorting
// one loaded page and calling it "the newest supplier" would be a wrong answer
// the moment there is a page 2.
//
// It lives in a pane of unknown width, so columns disclose progressively with
// @container, never a viewport query: a narrow pane on a wide monitor must not
// show six columns in 300px.

import { useState } from 'react';
import { PaneWaiting } from '../../components/pane-waiting';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  SearchInput,
  Select,
  Timestamp,
} from '@wizeworks/silicaui-react';
import { Table } from '../../components/table';
import {
  faArrowDown,
  faArrowUp,
  faBoxMagnifyingGlass,
  faLink,
  faPlus,
} from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { ListPagination, MAX_TAKE, type PageSize } from '../../components/list-pagination';
import type { OpenTarget, SurfaceContext } from '../../lib/surfaces/registry';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { ListEmptyState } from '../../components/list-empty-state';
import { RefreshButton } from '../../components/refresh-button';
import { supplierState, useSuppliersPage, type SortDir, type SupplierSort } from './dropship-data';
import { RowOpenHint } from '../../components/row-open-hint';

/** Registry module for this surface, so the brand's empty-state artwork is this
 *  app's own picture rather than the generic one. */
const MODULE = 'dropship';

function targetFor(event: { shiftKey: boolean; altKey: boolean }): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

export function SuppliersListSurface({ ctx }: { ctx: SurfaceContext }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [sort, setSort] = useState<{ key: SupplierSort; dir: SortDir }>({
    key: 'name',
    dir: 'asc',
  });

  const [pageSize, setPageSize] = useState<PageSize>(50);
  const [page, setPage] = useState(1);
  const [take, setTake] = useState<number>(50);
  const skip = (page - 1) * pageSize;

  const { data, isLoading, isFetching, dataUpdatedAt, error, refetch } = useSuppliersPage({
    q: search,
    status,
    sortBy: sort.key,
    order: sort.dir,
    take,
    skip,
  });

  const rows = data?.items ?? [];
  const total = data?.total;

  const resetWindow = () => {
    setPage(1);
    setTake(pageSize);
  };

  const toggleSort = (key: SupplierSort) => {
    setSort((current) =>
      current.key === key
        ? { key, dir: current.dir === 'asc' ? 'desc' : 'asc' }
        : // Text ascends; a recency column (last sync) descends, newest first.
          { key, dir: key === 'lastSyncAt' ? 'desc' : 'asc' }
    );
    resetWindow();
  };

  const header = (key: SupplierSort, label: string, extra = '') => (
    <th
      className={extra}
      aria-sort={sort.key === key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        className="link link-hover inline-flex items-center gap-1"
        onClick={() => {
          toggleSort(key);
        }}
      >
        {label}
        {sort.key === key ? (
          sort.dir === 'asc' ? (
            <Icon glyph={faArrowUp} className="size-3" aria-hidden />
          ) : (
            <Icon glyph={faArrowDown} className="size-3" aria-hidden />
          )
        ) : null}
      </button>
    </th>
  );

  const openSupplier = (id: string, event: { shiftKey: boolean; altKey: boolean }) => {
    ctx.open('dropship.supplier.detail', { id }, { target: targetFor(event) });
  };

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar
        label="Supplier list controls"
        search={
          <div className="max-w-xs min-w-0 flex-1">
            <SearchInput
              size="sm"
              aria-label="Search suppliers"
              placeholder="Search by name…"
              value={search}
              onValueChange={(next) => {
                setSearch(next);
                resetWindow();
              }}
            />
          </div>
        }
        primaryAction={{
          label: 'Connect a supplier',
          icon: faPlus,
          onClick: (event) => {
            ctx.open('dropship.supplier.detail', { id: 'new' }, { target: targetFor(event) });
          },
          title: 'Connect a supplier — hold Shift to open alongside, Alt for a new window',
        }}
        controls={
          <div className="w-44 shrink-0">
            <Select
              size="sm"
              aria-label="Show which suppliers"
              value={status}
              items={{
                all: 'All suppliers',
                active: 'Connected',
                error: 'Needs attention',
                connecting: 'Connecting',
              }}
              onValueChange={(next) => {
                setStatus(next as string);
                resetWindow();
              }}
            />
          </div>
        }
        views={{
          target: '/dropship/suppliers',
          params: { q: search.trim(), status, sort: `${sort.key}:${sort.dir}` },
          onApply: (next) => {
            setSearch(next.q ?? '');
            setStatus(next.status ?? 'all');
            const [key, dir] = (next.sort ?? '').split(':');
            if (key && (dir === 'asc' || dir === 'desc')) {
              setSort({ key: key as SupplierSort, dir });
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
        {error ? (
          <EmptyState
            icon={<Icon glyph={faLink} className="size-6" aria-hidden />}
            title="Could not load your suppliers"
            description="Something went wrong reaching the server. Your suppliers are unaffected — try again in a moment."
          />
        ) : isLoading ? (
          <PaneWaiting label="Loading suppliers…" />
        ) : rows.length === 0 ? (
          <ListEmptyState
            module={MODULE}
            filtered={Boolean(search) || status !== 'all'}
            noResults={{
              icon: <Icon glyph={faLink} className="size-6" aria-hidden />,
              title: 'No suppliers match those filters',
              description: 'Try a different word, or switch the status filter back to All.',
            }}
            firstRun={{
              title: 'No suppliers yet',
              description:
                'A supplier is a business that holds the stock and posts it to your customers for you. Connect your first one to import its products and route orders to it automatically.',
              actions: (
                <Button
                  size="sm"
                  color="module"
                  onClick={(event) => {
                    ctx.open(
                      'dropship.supplier.detail',
                      { id: 'new' },
                      { target: targetFor(event) }
                    );
                  }}
                >
                  <Icon glyph={faPlus} className="size-4" aria-hidden />
                  Connect a supplier
                </Button>
              ),
            }}
          />
        ) : (
          <Table size="sm" hover>
            <thead>
              <tr>
                {header('name', 'Name')}
                <th className="hidden @lg:table-cell">Type</th>
                {header('lastSyncAt', 'Last sync', 'hidden @xl:table-cell')}
                <th className="hidden text-right @2xl:table-cell">Products</th>
                {header('status', 'Status')}
                <th className="w-0">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((supplier) => {
                const state = supplierState(supplier.status);
                return (
                  <tr
                    key={supplier.id}
                    className="cursor-pointer"
                    tabIndex={0}
                    role="button"
                    onClick={(event) => {
                      openSupplier(supplier.id, event);
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter' && event.key !== ' ') return;
                      event.preventDefault();
                      openSupplier(supplier.id, event);
                    }}
                  >
                    <td className="max-w-48 truncate font-medium">{supplier.name}</td>
                    <td className="hidden @lg:table-cell">{supplier.vendorLabel}</td>
                    <td className="hidden text-sm @xl:table-cell">
                      {supplier.lastSyncAt ? (
                        <Timestamp value={supplier.lastSyncAt} format="relative" />
                      ) : (
                        'Not synced yet'
                      )}
                    </td>
                    <td className="hidden text-right tabular-nums @2xl:table-cell">
                      {supplier.productCount ?? '—'}
                    </td>
                    <td>
                      <Badge color={state.tone} variant="soft" size="sm">
                        {state.label}
                      </Badge>
                    </td>
                    <td className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        color="neutral"
                        shape="square"
                        aria-label={`Browse ${supplier.name}'s products`}
                        title={`Browse ${supplier.name}'s products`}
                        onClick={(event) => {
                          // Don't also trigger the row's open-supplier click.
                          event.stopPropagation();
                          ctx.open(
                            'dropship.products.list',
                            { supplierId: supplier.id },
                            { target: targetFor(event) }
                          );
                        }}
                      >
                        <Icon glyph={faBoxMagnifyingGlass} className="size-4" aria-hidden />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
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
        <RowOpenHint what="a supplier to manage it" className="pb-1" />
      </div>
    </div>
  );
}
