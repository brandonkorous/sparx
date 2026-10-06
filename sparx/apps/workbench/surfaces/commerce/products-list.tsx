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
import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  EmptyState,
  SearchInput,
  Table,
} from '@wizeworks/silicaui-react';
import { ArrowDown, ArrowUp, Package, Plus } from 'lucide-react';
import { ListPagination, MAX_TAKE, type PageSize } from '../../components/list-pagination';
import { ChooseCell, SelectAllCell } from '../../components/selection-cells';
import { useListSelection } from '../../lib/workbench/selection';
import { ProductsBulkActions } from './products-bulk-actions';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import { ListEmptyState } from '../../components/list-empty-state';
import type { OpenTarget, SurfaceContext } from '../../lib/surfaces/registry';
import {
  formatDate,
  priceLabel,
  productState,
  unfindableProductCount,
  useProducts,
  useProductTypesInUse,
  useReindexSearch,
  useSearchStatus,
  type ProductRow,
  type ProductSortKey,
  type ProductStatus,
  type SortDirection,
} from './products-data';
import { RowOpenHint } from '../../components/row-open-hint';

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

/** The kind-of-product select's "not narrowing" value. Not '' (a select cannot
 *  hold it) and not a word a business would name a kind of product. */
const EVERY_KIND = 'every-kind';

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
function emptyAdvice(search: string, filterLabel: string | null, kind: string | null): string {
  const parts: string[] = [];
  // Search reads name, web address, brand, kind, any version's code and what
  // it fits (sparx persona issue 070), so the hint names the ones people type.
  if (search) parts.push('Try part of the name, a product code, the brand, or what it fits.');
  if (filterLabel) {
    parts.push(`You are only seeing products marked “${filterLabel}”. Switch to All for the rest.`);
  }
  if (kind) {
    parts.push(`You are only seeing “${kind}” products. Switch to every kind for the rest.`);
  }
  return parts.join(' ');
}

export function ProductsListSurface({ ctx }: { ctx: SurfaceContext }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterValue>('all');
  const [kind, setKind] = useState<string>(EVERY_KIND);
  // "Every product that matches", chosen from the bulk bar: the bar then acts on
  // the narrowing below rather than on the rows ticked (issue 065).
  const [everyMatch, setEveryMatch] = useState(false);
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
  const productType = kind === EVERY_KIND ? undefined : kind;
  const narrowed = filter !== 'all' || search.trim() !== '' || productType !== undefined;
  const match = {
    ...(search.trim() ? { q: search.trim() } : {}),
    ...(active.status ? { status: active.status } : {}),
    ...(active.includeArchived ? { includeArchived: true } : {}),
    ...(productType ? { productType } : {}),
  };
  const kinds = useProductTypesInUse();

  const { data, isLoading, isFetching, dataUpdatedAt, error, refetch } = useProducts({
    q: search.trim(),
    ...(active.status ? { status: active.status } : {}),
    ...(active.includeArchived ? { includeArchived: true } : {}),
    ...(productType ? { productType } : {}),
    sortBy: sort.key,
    order: sort.dir,
    take,
    skip,
  });

  const rows = data?.items ?? [];
  const total = data?.total;
  // Every row is actable — a product can always be retired and always deleted —
  // so no `canChoose`. The count in the bar is the count that will act.
  const selection = useListSelection(rows, { keyOf: (product) => product.id });
  /** A refetch failed but the previous window is still on screen. */
  const staleAfterFailure = Boolean(error) && rows.length > 0;

  /** Anything that changes which rows match returns to the first window —
   *  staying on page 5 of a result set that now has two pages shows nothing.
   *
   *  It DISCARDS the selection too. Paging keeps what you chose, because the
   *  rows travel with it; searching does not, because the set you were acting on
   *  is no longer the set you can see, and a Delete against rows nobody is
   *  looking at is the one gesture that must never be a surprise. */
  const resetWindow = () => {
    setPage(1);
    setTake(pageSize);
    selection.clear();
    setEveryMatch(false);
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
            <ArrowUp className="size-3" aria-hidden />
          ) : (
            <ArrowDown className="size-3" aria-hidden />
          )
        ) : null}
      </button>
    </th>
  );

  // Whether searching can actually find this catalog. A COUNT of documents is
  // not the answer: twelve documents look exactly like sixteen until something
  // knows there should be sixteen. `productsMissing` is that something, and
  // null from it means nothing measured — which must render as silence, never
  // as "none missing".
  const searchStatus = useSearchStatus();
  const unfindable = unfindableProductCount(searchStatus.data);
  const reindex = useReindexSearch();

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
      {/* `wrap` after reducing everything that can reduce. Four chips are a fixed
          ~15rem that cannot shrink, and below @2xl the primary action has already
          shed its label to the icon and the separator has gone. At a normal pane
          width this is one line; at 320px, beside a product, it takes two rather
          than clipping the filters off the right edge. */}
      <ProductsBulkActions
        ctx={ctx}
        selection={selection}
        match={match}
        total={total}
        narrowed={narrowed}
        everyMatch={everyMatch}
        onEveryMatch={setEveryMatch}
        toolbar={
          <PaneToolbar
            label="Products controls"
            search={
              <div className="max-w-xs min-w-0 flex-1">
                <SearchInput
                  size="sm"
                  aria-label="Search products"
                  placeholder="Name, code or brand…"
                  value={search}
                  onValueChange={(next) => {
                    setSearch(next);
                    resetWindow();
                  }}
                />
              </div>
            }
            filters={[
              {
                label: 'Show',
                key: 'status',
                value: filter,
                onValueChange: (next) => {
                  setFilter((next as FilterValue | null) ?? 'all');
                  resetWindow();
                },
                options: FILTERS.map((entry) => ({ value: entry.value, label: entry.label })),
                neutralValue: 'all',
              },
              // Only once there is more than one kind to choose between. An
              // open-ended set, so a select rather than chips: a parts catalog
              // has eighteen kinds and eighteen chips are taller than the table.
              ...((kinds.data?.length ?? 0) > 1
                ? [
                    {
                      label: 'Kind of product',
                      key: 'productType',
                      value: kind,
                      onValueChange: (next: string) => {
                        setKind(next || EVERY_KIND);
                        resetWindow();
                      },
                      options: [
                        { value: EVERY_KIND, label: 'Every kind' },
                        ...(kinds.data ?? []).map((entry) => ({
                          value: entry.name,
                          label: entry.name,
                        })),
                      ],
                      neutralValue: EVERY_KIND,
                      present: 'select' as const,
                    },
                  ]
                : []),
            ]}
            primary={
              <Button
                data-tour="commerce-add-product"
                color="module"
                size="sm"
                className="ml-auto shrink-0 whitespace-nowrap"
                title="Add a product: hold Shift to open alongside, Alt for a new window"
                onClick={create}
              >
                <Plus className="size-4" aria-hidden />
                <span className="hidden @2xl:inline">Add a product</span>
              </Button>
            }
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
          <Alert color="warning" className="m-2">
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

        {unfindable !== null && unfindable > 0 ? (
          // INFO, not warning. The storefront falls back to the catalog when
          // this list is empty, so what is broken is the search box and the
          // facets beside it rather than the whole shop.
          <Alert color="info" className="m-2">
            <AlertContent>
              {/* The NUMBER goes in the heading. "Some of your products" is a
                  sentence nobody can act on; four is checkable against a
                  catalog the operator knows. */}
              <AlertTitle>
                {unfindable === 1
                  ? 'Search cannot find one of your products'
                  : `Search cannot find ${String(unfindable)} of your products`}
              </AlertTitle>
              <AlertDescription>
                The storefront still shows it and customers can still buy it. What is not working is
                the search box and the facets beside it, which look products up in a separate index
                this is missing from. A customer searching by name is told it does not exist.
              </AlertDescription>
            </AlertContent>
            <Button
              size="sm"
              color="info"
              variant="soft"
              loading={reindex.isPending}
              onClick={() => {
                reindex.mutate();
              }}
            >
              Rebuild the index
            </Button>
          </Alert>
        ) : null}

        {error && !staleAfterFailure ? (
          // A failed load REPLACES the table rather than rendering an empty one:
          // "No products yet" over a connection failure is a lie about the
          // catalog, and the worst possible one to tell someone.
          <EmptyState
            icon={<Package className="size-6" aria-hidden />}
            title="Could not load your products"
            description="This is a problem reaching the server. Your catalog is unaffected. Nothing has been lost."
            actions={
              <Button
                size="sm"
                color="module"
                onClick={() => {
                  void refetch();
                }}
              >
                Try again
              </Button>
            }
          />
        ) : isLoading ? (
          <p className="p-4 text-sm" role="status">
            Loading products…
          </p>
        ) : rows.length === 0 ? (
          <ListEmptyState
            filtered={narrowed}
            noResults={{
              icon: <Package className="size-6" aria-hidden />,
              title: 'No products match that',
              description: emptyAdvice(
                search.trim(),
                filter === 'all' ? null : active.label,
                productType ?? null
              ),
            }}
            firstRun={{
              title: 'Nothing in your catalog yet',
              description:
                'A product is one thing you sell. Add your first one and it can be on your website within a minute.',
              actions: (
                <Button size="sm" color="module" onClick={create}>
                  <Plus className="size-4" aria-hidden />
                  Add a product
                </Button>
              ),
            }}
          />
        ) : (
          <Table size="sm" hover>
            <thead>
              <tr>
                <SelectAllCell
                  allChosen={everyMatch || selection.allOnPageChosen}
                  someChosen={selection.someOnPageChosen}
                  disabled={rows.length === 0}
                  label="Choose every product here"
                  onToggle={() => {
                    // Unticking the header while every match is chosen means
                    // "none of them", not "every match except this page".
                    if (everyMatch) {
                      setEveryMatch(false);
                      selection.clear();
                      return;
                    }
                    selection.toggleAllOnPage();
                  }}
                />
                {header('title', 'Product')}
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
                    <ChooseCell
                      checked={everyMatch || selection.has(product.id)}
                      label={`Choose ${product.title}`}
                      onToggle={(on, modifiers) => {
                        // Leaving one out of "every match" falls back to the
                        // rows actually ticked, so the count stays a count of
                        // things somebody can see.
                        if (everyMatch) setEveryMatch(false);
                        selection.toggle(product, on, modifiers);
                      }}
                    />
                    <td className="w-full max-w-0 min-w-56">
                      {/* The name IS the row. The web address underneath is a
                          note about it, so it is smaller — but at full ink, not
                          faded: it is there to be read. The name takes the free
                          width and wraps to two lines: capped at 16rem, "Banks
                          Boost Tube Upgrade Kit for 12-…" hid the years and the
                          engine, which is what tells a part from its neighbor
                          (sparx persona issue 070). */}
                      <span className="line-clamp-2 font-medium break-words">{product.title}</span>
                      <span className="block truncate font-mono text-sm">/{product.handle}</span>
                    </td>
                    <td className="hidden max-w-40 truncate @xl:table-cell">
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
                    <td>
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
        {rows.length > 0 ? <RowOpenHint /> : null}
      </div>
    </div>
  );
}
