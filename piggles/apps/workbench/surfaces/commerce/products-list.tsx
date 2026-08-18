'use client';

// Products — everything this business sells.
//
// Three things shape this beyond a plain table.
//
// FIRST: the question a catalog list is opened to answer is almost never "show me
// everything". It is "what is not on sale yet" or "what did I retire". So the
// chips are those questions, each mapping to exactly ONE server filter — no chip
// means "these two statuses, sort of".
//
// SECOND: a product's price is a RANGE, not a number, because the price lives on
// its versions and they can differ. Collapsing it to the lowest one tells a
// half-truth on the one column where the number matters, so the cell says
// "$18.00 – $24.00" when that is the truth.
//
// THIRD: it lives in a pane of unknown width — 320px beside a product, or the
// whole window. Columns disclose with @container, never a viewport query: pane
// width and screen width are unrelated, and a viewport breakpoint leaves a narrow
// pane on a wide monitor rendering six columns into 300px.

import { useState } from 'react';
import { PaneWaiting } from '../../components/pane-waiting';
import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  SearchInput,
} from '@wizeworks/silicaui-react';
import { Table } from '../../components/table';
import { faArrowDown, faArrowUp, faBox, faPlus } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { ListPagination, MAX_TAKE, type PageSize } from '../../components/list-pagination';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import { ListEmptyState } from '../../components/list-empty-state';
import { PaneLoadError } from '../../components/pane-load-error';
import type { OpenTarget, SurfaceContext } from '../../lib/surfaces/registry';
import {
  formatDate,
  priceLabel,
  productState,
  useProducts,
  type ProductRow,
  type ProductSortKey,
  type ProductStatus,
  type SortDirection,
} from './products-data';

/** Registry module for this surface, so the brand's empty-state artwork is this
 *  app's own picture rather than the generic one. */
const MODULE = 'commerce';

/**
 * The chips are the questions, not the stored words.
 *
 * "Retired" carries `includeArchived` as well as the status, because the server
 * hides archived rows by default — asking for them by status alone comes back
 * empty, which reads as "you have none" when you have forty.
 */
const FILTERS = [
  { value: 'all', label: 'All', status: undefined, includeArchived: false },
  { value: 'active', label: 'On sale', status: 'active', includeArchived: false },
  { value: 'draft', label: 'Not on sale', status: 'draft', includeArchived: false },
  { value: 'archived', label: 'Retired', status: 'archived', includeArchived: true },
] as const satisfies readonly {
  value: string;
  label: string;
  status: ProductStatus | undefined;
  includeArchived: boolean;
}[];

type FilterValue = (typeof FILTERS)[number]['value'];

/** Same modifier contract as every other list in the app. */
function targetFor(event: { shiftKey: boolean; altKey: boolean }): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

/**
 * What to try when nothing matched — naming ONLY what is actually narrowing the
 * list. Telling someone to clear a filter they never set sends them hunting for a
 * control that is already off.
 */
function emptyAdvice(search: string, filterLabel: string | null): string {
  const parts: string[] = [];
  if (search) parts.push('Try part of the product name, its web address, or the brand.');
  if (filterLabel) {
    parts.push(
      `You are only seeing products marked “${filterLabel}” — switch to All for the rest.`
    );
  }
  return parts.join(' ');
}

export function ProductsListSurface({ ctx }: { ctx: SurfaceContext }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterValue>('all');
  // Newest-changed first: a catalog is opened at whatever you were last working
  // on far more often than at the letter A.
  const [sort, setSort] = useState<{ key: ProductSortKey; dir: SortDirection }>({
    key: 'updatedAt',
    dir: 'desc',
  });

  const [pageSize, setPageSize] = useState<PageSize>(50);
  const [page, setPage] = useState(1);
  // How many rows the current window has grown to. "Load more" raises this;
  // anything that changes WHICH rows match resets it.
  const [take, setTake] = useState<number>(50);

  const active = FILTERS.find((entry) => entry.value === filter) ?? FILTERS[0];
  const skip = (page - 1) * pageSize;
  const narrowed = filter !== 'all' || search.trim() !== '';

  const { data, isLoading, isFetching, dataUpdatedAt, error, refetch } = useProducts({
    q: search.trim(),
    ...(active.status ? { status: active.status } : {}),
    ...(active.includeArchived ? { includeArchived: true } : {}),
    sortBy: sort.key,
    order: sort.dir,
    take,
    skip,
  });

  const rows = data?.items ?? [];
  const total = data?.total;
  /** A refetch failed but the previous window is still on screen. */
  const staleAfterFailure = Boolean(error) && rows.length > 0;

  /** Anything that changes which rows match returns to the first window —
   *  staying on page 5 of a result set that now has two pages shows nothing. */
  const resetWindow = () => {
    setPage(1);
    setTake(pageSize);
  };

  const toggleSort = (key: ProductSortKey) => {
    setSort((current) =>
      current.key === key
        ? { key, dir: current.dir === 'asc' ? 'desc' : 'asc' }
        : // Names read A→Z; dates and prices are asked about as "the most".
          { key, dir: key === 'title' ? 'asc' : 'desc' }
    );
    resetWindow();
  };

  const header = (key: ProductSortKey, label: string, extra = '') => (
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

  const open = (product: ProductRow, event: { shiftKey: boolean; altKey: boolean }) => {
    ctx.open('commerce.product.detail', { id: product.id }, { target: targetFor(event) });
  };

  const create = (event: { shiftKey: boolean; altKey: boolean }) => {
    ctx.open('commerce.product.detail', { id: 'new' }, { target: targetFor(event) });
  };

  return (
    // Surfaces, not one slab: the pane is base-200, the toolbar and table are
    // base-100 cards lifted onto it.
    <div className={PANE_SHELL}>
      {/* Slots, not children: the bar decides what gives way, and on a narrow
          pane the chips relocate into its popover rather than spilling onto a
          second row. `activeControls` is what keeps that honest — a list showing
          eight of forty products has to say so even when the chip saying it is
          folded away. "All" is the null state and counts as nothing. */}
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
              setSearch(next);
              resetWindow();
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
              setFilter((next as FilterValue | null) ?? 'all');
              resetWindow();
            },
            options: FILTERS,
          },
        ]}
        primaryAction={{
          label: 'Add a product',
          icon: faPlus,
          onClick: create,
          title: 'Add a product — hold Shift to open alongside, Alt for a new window',
        }}
        views={{
          target: '/commerce/products',
          params: { q: search.trim(), sort: `${sort.key}:${sort.dir}` },
          onApply: (next) => {
            setSearch(next.q ?? '');
            const [key, dir] = (next.sort ?? '').split(':');
            if (key && (dir === 'asc' || dir === 'desc')) {
              setSort({ key: key as ProductSortKey, dir });
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
        {/* A refetch that failed while a good window is already on screen is NOT
            a failed load. `placeholderData` keeps the previous rows, so blanking
            a working table for "could not load your products" throws away data
            the operator can still use — and the footer underneath went on
            cheerfully reading "Showing 1–6 of 6" beneath it, which is how the
            case was caught. Say the refresh failed, keep the rows. */}
        {staleAfterFailure ? (
          <Alert color="warning" variant="soft" className="m-2">
            <AlertContent>
              <AlertTitle>Could not check for changes just now</AlertTitle>
              <AlertDescription>
                This is a problem reaching the server. The products below are what loaded last, and
                may be out of date.
              </AlertDescription>
            </AlertContent>
            <Button
              size="sm"
              color="warning"
              variant="soft"
              onClick={() => {
                void refetch();
              }}
            >
              Try again
            </Button>
          </Alert>
        ) : null}

        {error && !staleAfterFailure ? (
          // A failed load REPLACES the table rather than rendering an empty one:
          // "No products yet" over a connection failure is a lie about the
          // catalog, and the worst possible one to tell someone.
          <PaneLoadError
            icon={<Icon glyph={faBox} className="size-6" aria-hidden />}
            title="Could not load your products"
            description="This is a problem reaching the server. Your catalog is unaffected — nothing has been lost."
            onRetry={() => {
              void refetch();
            }}
          />
        ) : isLoading ? (
          <PaneWaiting label="Loading products…" />
        ) : rows.length === 0 ? (
          <ListEmptyState
            module={MODULE}
            filtered={narrowed}
            noResults={{
              icon: <Icon glyph={faBox} className="size-6" aria-hidden />,
              title: 'No products match that',
              description: emptyAdvice(search.trim(), filter === 'all' ? null : active.label),
            }}
            firstRun={{
              // "Catalog" is a third word for a thing this console already calls
              // two things — the app is Sell and the screen is Products — and it
              // is the one word of the three a person would not have used
              // themselves. The sentence under it already explains what a product
              // is, so the heading only has to name the emptiness.
              title: 'Nothing to sell yet',
              description:
                'A product is one thing you sell. Add your first one and it can be on your website within a minute.',
              actions: (
                <Button size="sm" color="module" onClick={create}>
                  <Icon glyph={faPlus} className="size-4" aria-hidden />
                  Add a product
                </Button>
              ),
            }}
          />
        ) : (
          <Table size="sm" hover>
            <thead>
              <tr>
                {header('title', 'Product', 'w-full')}
                <th className="hidden @xl:table-cell">Brand</th>
                <th className="hidden text-right @2xl:table-cell">Versions</th>
                {header('updatedAt', 'Changed', 'hidden @4xl:table-cell')}
                {header('priceMinCents', 'Price', 'text-right')}
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((product) => {
                const state = productState(product);
                return (
                  <tr
                    key={product.id}
                    className="cursor-pointer"
                    tabIndex={0}
                    role="button"
                    onClick={(event) => {
                      open(product, event);
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter' && event.key !== ' ') return;
                      event.preventDefault();
                      open(product, event);
                    }}
                  >
                    <td>
                      {/* The name IS the row. The web address underneath is a
                          note about it, so it is smaller — but at full ink, not
                          faded: it is there to be read. */}
                      <span className="block truncate font-medium">{product.title}</span>
                      <span className="block truncate font-mono text-sm">/{product.handle}</span>
                    </td>
                    <td className="hidden max-w-40 truncate whitespace-nowrap @xl:table-cell">
                      {product.vendor ?? product.productType ?? '—'}
                    </td>
                    <td className="hidden text-right tabular-nums @2xl:table-cell">
                      {product.variantCount}
                    </td>
                    <td className="hidden text-sm whitespace-nowrap @4xl:table-cell">
                      {formatDate(product.updatedAt)}
                    </td>
                    <td className="text-right font-medium whitespace-nowrap tabular-nums">
                      {priceLabel(product)}
                    </td>
                    <td className="whitespace-nowrap">
                      <Badge color={state.tone} variant="soft" size="sm">
                        {state.label}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>

      {/* Sits on the pane, not in the card — it describes the table rather than
          being part of it, which is what the recessed surface says. */}
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
            // A jump REPLACES the window, so growth from "load more" belongs to
            // the window you just left, not the one you land on.
            setTake(pageSize);
          }}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
            setTake(size);
          }}
        />
        {/* Only where there is a pointer to do them with — on the stack these
            three modifiers do not exist. */}
        <p className="hidden px-1 pb-1 text-sm @xl:block">
          Click to open · Shift-click alongside · Alt-click new window
        </p>
      </div>
    </div>
  );
}
