'use client';

// REORDER — what is running low and needs buying again.
//
// ── A worklist, not a catalogue ──────────────────────────────────────────
//
// Every row here is a (product × location) already at or below the level you
// asked to be warned at. The job of the screen is to scan those rows, pick the
// ones to act on, and turn them into draft purchase orders — grouped for you by
// supplier, because that is the shape of a real order. So it IS a table: each row
// carries several numbers you compare down a column (what's left, the trigger
// level, how many to order, how many are already coming), exactly the case the
// house rule keeps tables for.
//
// ── The headline is WHEN it runs out ──────────────────────────────────────
//
// "How little is left" tells you it is low; it does not tell you how long you
// have. The row now leads with days of cover — the available stock divided by how
// fast it actually sells (straight from the ledger, not a guess) — said in plain
// words: "Out in about 6 days", "Out around 12 Aug", or "Not selling" when nothing
// is drawing it down. Soonest-to-run-out is a sort, because the shortest cover is
// the most urgent thing to buy.
//
// ── The ORDER is money, not emptiness (docs/146 Phase 7.7) ────────────────
//
// The default sort is now what running out would COST: the demand that would
// have nowhere to come from before a replacement could land, priced at the
// selling price. "Least in stock first" ranks by how empty a shelf looks, and a
// buyer with forty rows and an hour does not need the emptiest shelf — they need
// the one whose emptiness costs the most. A fast $40 line four days out beats a
// dormant $2 one down to its last unit, every time.
//
// Every row carries the sentence explaining its own figure, and the supplier's
// delivery time says whether it was MEASURED from real deliveries or is just
// what the supplier claims — which is most of the difference between a reorder
// level that works and one that is optimistic by however much the supplier is.
// Clicking through opens the full calculation.
//
// ── Every narrowing is a SERVER query ────────────────────────────────────
//
// Search, the location and supplier filters, the sort and the paging all go to
// the API. Sorting the loaded page in the browser would answer "what is most
// urgent" with "the scarcest of the fifty rows in hand" — so the endpoint sorts
// and narrows the WHOLE low set, and this only renders the window it returns.
//
// ── Three empty states, three different problems ──────────────────────────
//
// Nothing matches the search or a filter · nothing is running low, which is GOOD
// news and says so warmly · no reorder rules exist yet, so nothing can ever warn
// you. The last two both look like an empty list and mean opposite things, which
// is why the summary read exists to tell them apart.

import { useState } from 'react';
import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  Checkbox,
  EmptyState,
  NativeSelect,
  SearchInput,
  Table,
  Text,
  useToast,
} from '@wizeworks/silicaui-react';
import { useConfirm } from '../../lib/confirm';
import {
  PackageCheck,
  PackageX,
  Search,
  ShoppingCart,
  SlidersHorizontal,
  Truck,
} from 'lucide-react';
import { ListPagination, MAX_TAKE, type PageSize } from '../../components/list-pagination';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import type { OpenTarget, SurfaceContext } from '../../lib/surfaces/registry';
import { formatCents, locationLabel, plural, stockErrorMessage, useStockLocations } from './data';
import {
  coverSignal,
  leadTimeSignal,
  purchaseOrderCount,
  supplierLabel,
  useDraftReorder,
  unsuppliedFrom,
  useReorderSummary,
  useReorderSuppliers,
  useReorderWorklist,
  velocityLabel,
  type DraftLine,
  type ReorderRow,
  type ReorderSort,
} from './reorder-data';
import {
  alreadyComingLine,
  draftedOutcome,
  reorderHint,
  unsuppliedNote,
} from './reorder-supplier-words';

/** Same modifier contract as every other list in the app. */
function targetFor(event: { shiftKey: boolean; altKey: boolean }): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

/** The stable identity of a worklist row: one product in one place. */
function rowKey(row: Pick<ReorderRow, 'variantId' | 'warehouseId'>): string {
  return `${row.variantId}:${row.warehouseId}`;
}

/**
 * What to try when nothing matched — naming ONLY the narrowings actually in
 * force. Advice to clear a filter that was never set sends people hunting for a
 * control that is already off.
 */
function emptyAdvice(search: string, locationName: string | null, supplierName: string | null) {
  const parts: string[] = [];
  if (search) parts.push('Try part of a product name or code.');
  if (locationName) parts.push(`You are only seeing ${locationName}. Switch to every location.`);
  if (supplierName) parts.push(`You are only seeing ${supplierName}. Switch to every supplier.`);
  return parts.join(' ');
}

export function ReorderListSurface({ ctx }: { ctx: SurfaceContext }) {
  const [search, setSearch] = useState('');
  const [locationId, setLocationId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [sort, setSort] = useState<ReorderSort>('risk');

  const [pageSize, setPageSize] = useState<PageSize>(50);
  const [page, setPage] = useState(1);
  const [take, setTake] = useState<number>(50);

  // Chosen lines, keyed by row identity. The whole ROW is stored, not just its
  // key, so a selection can span pages and still be drafted — the off-page rows'
  // supplier and quantity come along rather than being re-fetched.
  const [selected, setSelected] = useState<Map<string, ReorderRow>>(new Map());

  const skip = (page - 1) * pageSize;
  const locations = useStockLocations();
  const activeLocations = (locations.data?.items ?? []).filter((location) => location.isActive);
  const locationName = activeLocations.find((location) => location.id === locationId)?.name ?? null;

  const suppliers = useReorderSuppliers();
  const activeSuppliers = (suppliers.data?.items ?? []).filter((supplier) => supplier.isActive);
  const supplierName = activeSuppliers.find((supplier) => supplier.id === supplierId)?.name ?? null;

  const summary = useReorderSummary();

  const { data, isLoading, isFetching, dataUpdatedAt, isError, refetch } = useReorderWorklist({
    q: search.trim(),
    ...(locationId ? { warehouseId: locationId } : {}),
    ...(supplierId ? { supplierId } : {}),
    sort,
    take,
    skip,
  });

  const rows = data?.items ?? [];
  const total = data?.total;
  // Counted over the WHOLE narrowed list by the server, never over the page in
  // hand: a page is a window, and "3 of these cannot be ordered" is untrue of a
  // window holding three of sixty-five.
  const stuck = unsuppliedNote(unsuppliedFrom(data?.meta), total);
  const narrowed = search.trim() !== '' || locationId !== '' || supplierId !== '';

  /** A change to WHICH rows match returns to the first window and drops the
   *  selection — chosen lines that no longer match would draft invisibly. */
  const onNarrow = () => {
    setPage(1);
    setTake(pageSize);
    setSelected(new Map());
  };

  /** Paging keeps the selection: it is the same result set, just a different
   *  window onto it. */
  const resetWindow = () => {
    setPage(1);
    setTake(pageSize);
  };

  const toast = useToast();
  const confirm = useConfirm();
  const draft = useDraftReorder();

  const selectableRows = rows.filter((row) => row.supplierId !== null);
  const allPageSelected =
    selectableRows.length > 0 && selectableRows.every((row) => selected.has(rowKey(row)));

  const toggleRow = (row: ReorderRow, on: boolean) => {
    setSelected((current) => {
      const next = new Map(current);
      if (on) next.set(rowKey(row), row);
      else next.delete(rowKey(row));
      return next;
    });
  };

  const toggleAllOnPage = () => {
    setSelected((current) => {
      const next = new Map(current);
      if (allPageSelected) {
        for (const row of selectableRows) next.delete(rowKey(row));
      } else {
        for (const row of selectableRows) next.set(rowKey(row), row);
      }
      return next;
    });
  };

  const selectedLines: DraftLine[] = [...selected.values()].map((row) => ({
    variantId: row.variantId,
    warehouseId: row.warehouseId,
    // Guarded at selection time — only rows with a supplier are ever selectable.
    supplierId: row.supplierId ?? '',
    quantity: row.suggestedQuantity,
  }));
  const orderCount = purchaseOrderCount(selectedLines);

  const onDraft = async () => {
    if (selectedLines.length === 0) return;
    const base = `This turns the ${plural(
      selectedLines.length,
      'chosen item',
      'chosen items'
    )} into ${plural(
      orderCount,
      'draft order',
      'draft orders'
    )}, grouped by supplier and location. Nothing is ordered yet: a draft is yours to check, change, or discard before you send it to the supplier.`;
    // A line whose stock is already on an open order can be drafted again, and
    // was, in silence: twelve ordered, the row saying "12 already on the way",
    // and twelve more one click later. Warning rather than refusing, because a
    // buyer may genuinely want more and this is where they decide.
    const coming = alreadyComingLine([...selected.values()]);
    const ok = await confirm({
      title: `Draft ${plural(orderCount, 'purchase order', 'purchase orders')}?`,
      // One paragraph, warning first: the dialog renders its description as
      // plain text, and the fact that changes her mind has to be read first.
      description: coming === null ? base : `${coming} ${base}`,
      confirmLabel: 'Create drafts',
      cancelLabel: 'Not yet',
      color: 'module',
    });
    if (!ok) return;
    draft.mutate(selectedLines, {
      onSuccess: (result) => {
        setSelected(new Map());
        toast.add({ ...draftedOutcome(result.purchaseOrders), type: 'success' });
      },
      onError: (error) => {
        toast.add({
          title: 'Could not draft those orders',
          description: stockErrorMessage(error, 'Nothing was ordered. Please try again.'),
          type: 'error',
        });
      },
    });
  };

  // Clicking a row opens the CALCULATION, not the stock item. On this screen the
  // question is always "should I buy this, and why does it say that" — and the
  // stock item is one click further on from there.
  const open = (row: ReorderRow, event: { shiftKey: boolean; altKey: boolean }) => {
    ctx.open(
      'inventory.planning.explain',
      { variantId: row.variantId, warehouseId: row.warehouseId },
      { target: targetFor(event) }
    );
  };

  const body = () => {
    // A failed load REPLACES the table — an empty grid under live filters invites
    // the reading that nothing needs reordering, which is the opposite of unknown.
    if (isError) {
      return (
        <EmptyState
          icon={<PackageX className="size-6" aria-hidden />}
          title="Could not work out what needs reordering"
          description="This is a problem reaching the server. Your stock and orders are unaffected: the list just could not be read right now."
        />
      );
    }

    if (isLoading) {
      return (
        <p className="p-4 text-base" role="status">
          Working out what needs reordering…
        </p>
      );
    }

    if (rows.length === 0) {
      if (narrowed) {
        return (
          <EmptyState
            icon={<Search className="size-6" aria-hidden />}
            title="Nothing matches that"
            description={emptyAdvice(search.trim(), locationName, supplierName)}
          />
        );
      }
      // No filters and still empty: two opposite meanings. No rule anywhere means
      // nothing can warn you; every rule comfortably above its trigger is the
      // whole point working.
      if (summary.data && summary.data.policyCount === 0) {
        return (
          <EmptyState
            icon={<SlidersHorizontal className="size-6" aria-hidden />}
            title="No reorder rules set up yet"
            description="Nothing can be flagged as running low until you say when to reorder it. Open a product, and on its Stock panel set a reorder level and how many to buy. This list then fills itself in as those items run down."
          />
        );
      }
      return (
        <EmptyState
          icon={<PackageCheck className="size-6" aria-hidden />}
          title="Nothing needs reordering"
          description="Every product with a reorder level is comfortably above it. As things run down they will appear here, most urgent first, ready to turn into orders."
        />
      );
    }

    return (
      <Table size="sm" hover>
        <thead>
          <tr>
            <th className="w-0">
              <Checkbox
                color="module"
                aria-label="Choose every line here that can be ordered"
                checked={allPageSelected}
                disabled={selectableRows.length === 0}
                ref={(el) => {
                  if (el) {
                    el.indeterminate =
                      !allPageSelected && selectableRows.some((row) => selected.has(rowKey(row)));
                  }
                }}
                onChange={toggleAllOnPage}
              />
            </th>
            <th>Item</th>
            <th className="hidden @2xl:table-cell">Supplier</th>
            <th className="hidden text-right whitespace-nowrap @lg:table-cell">Available</th>
            <th className="hidden whitespace-nowrap @6xl:table-cell">Takes</th>
            <th className="hidden text-right whitespace-nowrap @xl:table-cell">Sells</th>
            <th className="text-right whitespace-nowrap">To order</th>
            <th className="hidden text-right whitespace-nowrap @6xl:table-cell">On the way</th>
            <th className="hidden whitespace-nowrap @4xl:table-cell">Runs out</th>
            <th className="hidden text-right whitespace-nowrap @4xl:table-cell">At risk</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const cover = coverSignal(row);
            const sells = velocityLabel(row);
            const lead = leadTimeSignal(row);
            const key = rowKey(row);
            const suppliable = row.supplierId !== null;
            return (
              <tr
                key={key}
                className="cursor-pointer"
                tabIndex={0}
                role="button"
                onClick={(event) => {
                  open(row, event);
                }}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter' && event.key !== ' ') return;
                  event.preventDefault();
                  open(row, event);
                }}
              >
                {/* The checkbox is a control inside a clickable row, so its clicks
                    and its Space key must not also open the pane. */}
                <td
                  className="w-0"
                  onClick={(event) => {
                    event.stopPropagation();
                  }}
                  onKeyDown={(event) => {
                    event.stopPropagation();
                  }}
                >
                  <Checkbox
                    color="module"
                    aria-label={
                      suppliable
                        ? `Choose ${row.title ?? row.sku ?? 'this item'} to reorder`
                        : 'Cannot order this: it has no supplier yet'
                    }
                    checked={selected.has(key)}
                    disabled={!suppliable}
                    onChange={(event) => {
                      toggleRow(row, event.target.checked);
                    }}
                  />
                </td>

                {/* `max-w-0 w-full` makes this the cell that GIVES, so the truncation
                    below actually bites and the "To order" number and state badge
                    are never the columns pushed off the right edge. */}
                {/* `min-w-56` is the floor under the give. Without it "gives" means
                    "gives EVERYTHING": measured on Juniper Row this cell rendered at
                    140px the moment Runs out and At risk appeared, 97px when Available
                    joined them and 64px once Supplier did, so it got WORSE as the pane
                    got WIDER — 229px at 400px wide, 64px at 800px wide. 56 is 224px,
                    which holds the longest product code on that account (185px) plus
                    padding. */}
                <td className="w-full max-w-0 min-w-56">
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate">{row.title ?? 'Untitled product'}</span>
                    <span className="truncate font-mono text-sm">{row.sku ?? 'No code'}</span>
                    {/* Every column that is not showing at this width folds back in here, and
                        the place a line is short in NEVER hides: there is no Location column
                        for it to fold back OUT to, so it used to vanish at @lg and stay
                        vanished. A reorder line without its building is an instruction to
                        order twelve of something, somewhere. */}
                    <span className="truncate text-sm">{locationLabel(row)}</span>
                    <span className="truncate text-sm @2xl:hidden">{supplierLabel(row)}</span>
                    {sells ? (
                      <span className="truncate text-sm @xl:hidden">Sells {sells}</span>
                    ) : null}
                    {/* "Takes" and "On the way" arrive last as columns, so they fold back
                        the longest. A buyer without the supplier's real lead time, or
                        without what is already coming, is typing a quantity from half the
                        facts. */}
                    {lead ? (
                      <span className="truncate text-sm @6xl:hidden">Takes {lead.label}</span>
                    ) : null}
                    {row.onOrder > 0 ? (
                      <span className="truncate text-sm @6xl:hidden">
                        {row.onOrder} already on the way
                      </span>
                    ) : null}
                    {/* The whole calculation in one sentence — what turns "at risk $412"
                        from an assertion into something a buyer can agree with. */}
                    {row.reasoning ? (
                      <span className="truncate text-sm">{row.reasoning}</span>
                    ) : null}
                    {/* Runs out and At risk fold back as badges below @4xl. They are two
                        `whitespace-nowrap` cells worth 201px between them beside a give-cell,
                        and they used to arrive at @md, which left the NAME 140px the moment
                        they appeared and 64px once the rest joined them. A buyer cannot
                        reorder a thing whose name they cannot read. */}
                    <span className="mt-1 flex flex-wrap items-center gap-1 @4xl:hidden">
                      <Badge color={cover.tone} variant="soft" size="sm">
                        {cover.label}
                      </Badge>
                      {row.revenueAtRiskCents > 0 ? (
                        <Badge color="danger" variant="soft" size="sm">
                          {formatCents(row.revenueAtRiskCents)} at risk
                        </Badge>
                      ) : null}
                    </span>
                  </span>
                </td>

                <td className="hidden max-w-40 @2xl:table-cell">
                  {suppliable ? (
                    <span className="truncate">{supplierLabel(row)}</span>
                  ) : (
                    <Badge color="warning" variant="soft" size="sm">
                      No supplier yet
                    </Badge>
                  )}
                </td>

                <td className="hidden text-right tabular-nums @lg:table-cell">{row.available}</td>
                {/* Replaces "Reorder at". The trigger level is on the row's own
                    calculation page; how long the supplier ACTUALLY takes, and
                    whether that is measured or claimed, changes what to do now. */}
                <td className="hidden whitespace-nowrap @6xl:table-cell">
                  {lead ? (
                    <Badge color={lead.tone} variant="soft" size="sm" title={lead.detail}>
                      {lead.label}
                    </Badge>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="hidden text-right whitespace-nowrap tabular-nums @xl:table-cell">
                  {sells ?? '—'}
                </td>
                <td className="text-right font-medium whitespace-nowrap tabular-nums">
                  {row.suggestedQuantity}
                </td>
                <td className="hidden text-right tabular-nums @6xl:table-cell">
                  {row.onOrder > 0 ? row.onOrder : '—'}
                </td>
                <td className="hidden whitespace-nowrap @4xl:table-cell">
                  <Badge color={cover.tone} variant="soft" size="sm">
                    {cover.label}
                  </Badge>
                </td>
                {/* A number, not a badge: it is the one thing on the row a buyer
                    compares straight down the column. Zero reads as a dash —
                    "$0.00" would look like a measurement of nothing, when it
                    almost always means there is no deadline at all. */}
                <td className="hidden text-right font-medium whitespace-nowrap tabular-nums @4xl:table-cell">
                  {row.revenueAtRiskCents > 0 ? formatCents(row.revenueAtRiskCents) : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    );
  };

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar
        label="Reorder controls"
        search={
          <div className="max-w-xs min-w-0 flex-1">
            <SearchInput
              size="sm"
              aria-label="Search what needs reordering"
              placeholder="Product name or code…"
              value={search}
              onValueChange={(next) => {
                setSearch(next);
                onNarrow();
              }}
            />
          </div>
        }
        filters={[
          {
            label: 'Kept at',
            key: 'location',
            value: locationId,
            onValueChange: (next) => {
              setLocationId(next);
              onNarrow();
            },
            options: [
              { value: '', label: 'Every location' },
              ...activeLocations.map((location) => ({ value: location.id, label: location.name })),
            ],
            neutralValue: '',
            present: 'select',
          },
          {
            label: 'Bought from',
            key: 'supplier',
            value: supplierId,
            onValueChange: (next) => {
              setSupplierId(next);
              onNarrow();
            },
            options: [
              { value: '', label: 'Every supplier' },
              ...activeSuppliers.map((s) => ({ value: s.id, label: s.name })),
            ],
            neutralValue: '',
            present: 'select',
          },
        ]}
        controls={
          <NativeSelect
            size="sm"
            className="max-w-40 shrink"
            aria-label="Order the list by"
            value={sort}
            onChange={(event) => {
              setSort(event.target.value as ReorderSort);
              resetWindow();
            }}
          >
            <option value="risk">Costs the most to miss</option>
            <option value="cover">Runs out soonest</option>
            <option value="urgency">Least in stock first</option>
            <option value="shortfall">Furthest below target</option>
          </NativeSelect>
        }
        refresh={
          <RefreshButton
            className="ml-auto"
            isFetching={isFetching}
            updatedAt={data ? dataUpdatedAt : undefined}
            onRefresh={() => {
              void refetch();
            }}
          />
        }
      />

      {/* The action bar only exists while there is something chosen, so it costs
          no permanent height. It is a base-100 card lifted onto the pane, matching
          the toolbar and the table — the house floating pattern. */}
      {selected.size > 0 ? (
        <div className="bg-base-100 flex shrink-0 flex-wrap items-center gap-3 rounded-lg p-2">
          <Text className="text-base">
            {plural(selected.size, 'item', 'items')} chosen ·{' '}
            {plural(orderCount, 'order', 'orders')} to draft
          </Text>
          <Button
            className="ml-auto"
            size="sm"
            variant="ghost"
            color="neutral"
            onClick={() => {
              setSelected(new Map());
            }}
          >
            Clear
          </Button>
          <Button
            size="sm"
            color="module"
            loading={draft.isPending}
            onClick={() => {
              void onDraft();
            }}
          >
            <ShoppingCart className="size-4" aria-hidden />
            Draft {plural(orderCount, 'order', 'orders')}
          </Button>
        </div>
      ) : null}

      {/* The fifth kind of nothing, and the one that actually reaches people.
          This list only watches lines somebody has set a level for. With one
          level set out of seventy-two it showed a single row, neither empty
          state fired, and nothing said the other seventy-one were ineligible to
          appear — while the At risk screen beside it was naming two of them as
          $558 of orders about to have nothing to come from. */}
      {summary.data &&
      summary.data.policyCount > 0 &&
      summary.data.levelCount - summary.data.policyCount > 0 ? (
        <Alert color="warning">
          <AlertContent>
            <AlertTitle>
              {summary.data.levelCount - summary.data.policyCount} of your {summary.data.levelCount}{' '}
              stock lines have no reorder level
            </AlertTitle>
            <AlertDescription>
              This list only watches the lines you have set a level for, so those are not on it
              however low they get. Open a product and set a reorder level and how many to buy on
              its Stock panel, and they start warning you here. At risk looks at everything
              meanwhile, whether a level is set or not.
            </AlertDescription>
          </AlertContent>
        </Alert>
      ) : null}

      {/* And the second reason this list cannot do its job. A row with no
          supplier has nobody to send an order to, so its tick box is dead —
          and a dead tick box was the whole of what the screen said about it.
          MEASURED 2026-09-18: 71 of the platform's 76 triggered lines, and for
          four tenants of six that is every line on the list. */}
      {stuck ? (
        <Alert color="warning">
          <AlertContent>
            <AlertTitle>{stuck.title}</AlertTitle>
            <AlertDescription>{stuck.body}</AlertDescription>
          </AlertContent>
          <Button
            size="sm"
            color="module"
            onClick={() => {
              ctx.open('inventory.suppliers.list', {}, { target: 'beside' });
            }}
          >
            <Truck className="size-4" aria-hidden />
            Suppliers
          </Button>
        </Alert>
      ) : null}

      {/* Full width — matches the house list convention: the table fills the pane. */}
      <Card className="min-h-0 flex-1 overflow-y-auto">{body()}</Card>

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
        {/* The opening clause used to appear whenever the list had rows,
            including on a page where not one tick box could be ticked — which is
            most pages on most accounts. A sentence telling somebody to do what
            the screen will not let them do is the same defect as one sending
            them somewhere with nothing there. */}
        {rows.length > 0 ? (
          <Text className="hidden px-1 pb-1 text-sm @xl:block">
            <Truck className="mr-1 inline size-4 align-text-bottom" aria-hidden />
            {reorderHint(selectableRows.length)}
          </Text>
        ) : null}
      </div>
    </div>
  );
}
