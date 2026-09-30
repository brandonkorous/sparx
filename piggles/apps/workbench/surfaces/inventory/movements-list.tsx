'use client';

// MOVEMENTS — the append-only ledger of every change to a stock number.
//
// ── Why this IS a table ──────────────────────────────────────────────────
//
// Same test the Stock list passes: rows that each carry several facts you scan
// DOWN a column — a signed change, the balance it left behind, when, why. The
// job of the screen is to read a running account, and a card per row would turn
// a scan into a stack of paragraphs. The columns disclose with @container so a
// pane docked narrow still shows the three that matter — what moved, by how
// much, and why — rather than six columns two characters wide.
//
// ── Read-only, and every narrowing goes to the SERVER ─────────────────────
//
// There is nothing to create here: the ledger writes itself, one row per real
// change. So there is no primary action, and the refresh button carries the
// ml-auto a primary normally would. Search, location, reason and the date range
// are all server filters — a ledger is the list where sieving the loaded page is
// most plainly wrong, because "every loss last month" asked of the fifty newest
// rows of any kind is a different question with a different answer.
//
// ── Two empty states, two different problems ──────────────────────────────
//
// Nothing matches the filters · nothing has ever moved. Telling a shop with a
// year of history to "make their first change" because they mistyped a product
// name is the worse of the two mistakes.

import { useMemo, useState } from 'react';
import { PaneWaiting } from '../../components/pane-waiting';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  SearchInput,
  Timestamp,
  Tooltip,
} from '@wizeworks/silicaui-react';
import { Table } from '../../components/table';
import {
  faClockRotateLeft,
  faMagnifyingGlass,
  faShieldCheck,
} from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { ListPagination, MAX_TAKE, type PageSize } from '../../components/list-pagination';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import type { ToolbarFilter } from '../../components/pane-toolbar-filters';
import { RefreshButton } from '../../components/refresh-button';
import type { OpenTarget, SurfaceContext } from '../../lib/surfaces/registry';
import { movementReason, useStockLocations } from './data';
import {
  MOVEMENT_REASONS,
  deltaTone,
  signedDelta,
  useMovements,
  type Movement,
} from './movements-data';
import { RowOpenHint } from '../../components/row-open-hint';
import { DayInput } from '../../components/day-input';

/** Same modifier contract as every other list in the app. */
function targetFor(event: { shiftKey: boolean; altKey: boolean }): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

/** A calendar day, as typed, turned into the ISO instant the endpoint wants. The
 *  "to" bound reaches the END of its day so a single day picked in both boxes
 *  includes everything that happened on it, not nothing. */
function dayStart(day: string): string | undefined {
  if (!day) return undefined;
  const date = new Date(`${day}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}
function dayEnd(day: string): string | undefined {
  if (!day) return undefined;
  const date = new Date(`${day}T23:59:59.999Z`);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

/**
 * The row's one action: what this item's number is now, and how it got there.
 *
 * Rendered TWICE per row, at two widths, because where it belongs changes with
 * the room available — its own column when there is one, tucked under the
 * change badge when there is not. One definition so the two cannot drift, and
 * so the label a screen reader announces is written once.
 */
function StandsNow({
  movement,
  onExplain,
}: {
  movement: Movement;
  onExplain: (movement: Movement) => void;
}) {
  return (
    // `stopPropagation` because the row is itself a button — without it this
    // opens the item AND the explanation, and whichever lands second wins.
    <Tooltip content="Where this item&rsquo;s number stands now">
      <Button
        size="sm"
        variant="ghost"
        color="neutral"
        aria-label={`Where the number for ${movement.variantSku ?? 'this item'} stands now`}
        onClick={(event) => {
          event.stopPropagation();
          onExplain(movement);
        }}
      >
        <Icon glyph={faShieldCheck} className="size-4" aria-hidden />
      </Button>
    </Tooltip>
  );
}

export function MovementsListSurface({ ctx }: { ctx: SurfaceContext }) {
  const [search, setSearch] = useState('');
  const [locationId, setLocationId] = useState('');
  const [reason, setReason] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  // The half the toolbar does not hold — place and reason ride the `filters`
  // slot. "Everything written off last month", saved once, is the whole point of
  // the feature on this particular list.
  const viewParams = useMemo(() => ({ q: search.trim(), from, to }), [search, from, to]);

  const [pageSize, setPageSize] = useState<PageSize>(50);
  const [page, setPage] = useState(1);
  const [take, setTake] = useState<number>(50);

  const skip = (page - 1) * pageSize;
  const locations = useStockLocations();
  const activeLocations = (locations.data?.items ?? []).filter((location) => location.isActive);
  const locationName = activeLocations.find((location) => location.id === locationId)?.name ?? null;

  const { data, isLoading, isFetching, dataUpdatedAt, isError, refetch } = useMovements({
    q: search.trim(),
    ...(locationId ? { warehouseId: locationId } : {}),
    ...(reason ? { reason } : {}),
    ...(dayStart(from) ? { from: dayStart(from) } : {}),
    ...(dayEnd(to) ? { to: dayEnd(to) } : {}),
    take,
    skip,
  });

  const rows = data?.items ?? [];
  const total = data?.total;
  const narrowed =
    search.trim() !== '' || locationId !== '' || reason !== '' || from !== '' || to !== '';

  /** Anything that changes which rows match returns to the first window. */
  const resetWindow = () => {
    setPage(1);
    setTake(pageSize);
  };

  // Both are open-ended sets — a business can have twenty locations — so both
  // present as pickers rather than chip rows.
  const filters: ToolbarFilter[] = [
    {
      label: 'Show changes at',
      key: 'warehouse',
      present: 'select',
      value: locationId,
      neutralValue: '',
      options: [
        { value: '', label: 'Every location' },
        ...activeLocations.map((location) => ({ value: location.id, label: location.name })),
      ],
      onValueChange: (next) => {
        setLocationId(next);
        resetWindow();
      },
    },
    {
      label: 'Show only this kind of change',
      key: 'reason',
      present: 'select',
      value: reason,
      neutralValue: '',
      options: [
        { value: '', label: 'Any reason' },
        ...MOVEMENT_REASONS.map((value) => ({ value, label: movementReason(value) })),
      ],
      onValueChange: (next) => {
        setReason(next);
        resetWindow();
      },
    },
  ];

  const open = (movement: Movement, event: { shiftKey: boolean; altKey: boolean }) => {
    ctx.open(
      'inventory.stock.item',
      { variantId: movement.variantId },
      { target: targetFor(event) }
    );
  };

  /**
   * "…and what is that number now?"
   *
   * A ledger row identifies exactly one (item, location) pair, so the current
   * standing of that pair is one click away rather than a hunt through the stock
   * list. Always beside — the row being asked about has to stay on screen.
   */
  const explain = (movement: Movement) => {
    ctx.open(
      'inventory.stock.provenance',
      { variantId: movement.variantId, warehouseId: movement.warehouseId },
      { target: 'beside' }
    );
  };

  const body = () => {
    // A failed load REPLACES the table — an empty grid under live filters reads
    // as "nothing has ever moved", which is a far bigger claim than the truth.
    if (isError) {
      return (
        <EmptyState
          icon={<Icon glyph={faClockRotateLeft} className="size-6" aria-hidden />}
          title="Could not load the history"
          description="This is a problem reaching the server. Your records are unaffected. They just could not be read just now."
        />
      );
    }

    if (isLoading) {
      return <PaneWaiting label="Loading history…" />;
    }

    if (rows.length === 0) {
      return (
        <EmptyState
          icon={
            narrowed ? (
              <Icon glyph={faMagnifyingGlass} className="size-6" aria-hidden />
            ) : (
              <Icon glyph={faClockRotateLeft} className="size-6" aria-hidden />
            )
          }
          title={narrowed ? 'Nothing matches that' : 'Nothing has moved yet'}
          description={
            narrowed
              ? locationName
                ? `No stock changes match those filters at ${locationName}. Widen the dates, clear the reason, or switch back to every location.`
                : 'No stock changes match those filters. Try a different reason, a wider date range, or part of a product name.'
              : 'Every change to a stock number shows up here: a sale, a delivery, a count being applied, a transfer. The first one appears the moment anything moves.'
          }
        />
      );
    }

    return (
      <Table size="sm" hover>
        <thead>
          <tr>
            <th className="hidden @xl:table-cell">When</th>
            <th>Item</th>
            <th className="text-right whitespace-nowrap">Change</th>
            <th className="hidden text-right @3xl:table-cell">Left on shelf</th>
            <th className="hidden @sm:table-cell">Why</th>
            <th className="hidden @2xl:table-cell">Location</th>
            <th className="w-8">
              <span className="sr-only">Where this item&rsquo;s number stands now</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((movement) => (
            <tr
              key={movement.id}
              className="cursor-pointer"
              tabIndex={0}
              role="button"
              onClick={(event) => {
                open(movement, event);
              }}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                open(movement, event);
              }}
            >
              <td className="hidden whitespace-nowrap @xl:table-cell">
                <Timestamp value={movement.createdAt} format="relative" />
              </td>

              {/* `max-w-0 w-full` makes this the cell that gives, so the product
                  name truncates instead of shoving the Change column off the
                  right edge.

                  THE FLOOR IS RAISED BY WIDTH, not set once. A flat `min-w-56`
                  is 224px, and at a 360px pane the body is 318px against 88px
                  of Change and 78px of the explain button — so the give cell
                  stopped giving at 224 and the table ran 390px wide inside 318.
                  That put the row's ONLY action off the right edge, behind a
                  sideways drag with no header word and nothing saying the list
                  scrolls, and dragging to it cut the product name from the
                  LEFT. A floor that forces a sideways scroll is not protecting
                  the column it is on. */}
              <td className="w-full max-w-0 min-w-28 @sm:min-w-56">
                <span className="flex min-w-0 flex-col">
                  <span className="truncate">{movement.productTitle ?? 'Untitled product'}</span>
                  <span className="truncate font-mono text-sm">
                    {movement.variantSku ?? 'No code'}
                  </span>
                  {/* Facts that fold back in when their column is gone — a change
                      with no when or where is only half an entry. */}
                  <span className="truncate text-sm @xl:hidden">
                    <Timestamp value={movement.createdAt} format="relative" />
                    {movement.warehouseName === null ? '' : ` · ${movement.warehouseName}`}
                  </span>
                  {/* And the reason, at the one width where its own column
                      cannot fit. A change with no WHY is not an entry. */}
                  <span className="truncate text-sm @sm:hidden">
                    {movementReason(movement.reason)}
                  </span>
                  {movement.warehouseName !== null ? (
                    <span className="hidden truncate text-sm @xl:inline @2xl:hidden">
                      {movement.warehouseName}
                    </span>
                  ) : null}
                </span>
              </td>

              <td className="text-right whitespace-nowrap">
                <span className="flex flex-col items-end gap-1">
                  <Badge color={deltaTone(movement.delta)} variant="soft" size="sm">
                    <span className="tabular-nums">{signedDelta(movement.delta)}</span>
                  </Badge>
                  {/* At the narrowest width the explain button rides under the
                      badge rather than taking a column of its own. A column of
                      its own cost 78px of a 318px row to hold one 32px icon,
                      and the row is already four lines tall down there — that
                      is where vertical room is the cheap kind. */}
                  <span className="@sm:hidden">
                    <StandsNow movement={movement} onExplain={explain} />
                  </span>
                </span>
              </td>

              <td className="hidden text-right tabular-nums @3xl:table-cell">
                {movement.balanceAfter ?? '—'}
              </td>

              {/* CAPPED, and that cap is load-bearing. The Item cell above is the
                  one that GIVES (`w-full max-w-0`), which in an auto-layout
                  table means it receives whatever is left after every other
                  column has taken what it wants. So an uncapped text column
                  here does not share the room, it takes it: measured at 521px
                  against 84px for the product name, and a note long enough held
                  the whole table at 752px inside a 400px pane, which is the
                  sideways scroll the @container column-hiding exists to
                  prevent. Any column added beside a give-cell needs a width. */}
              <td className="hidden max-w-28 @sm:table-cell @lg:max-w-40 @4xl:max-w-56">
                <span className="flex min-w-0 flex-col">
                  <span>{movementReason(movement.reason)}</span>
                  {/* The cap above is load-bearing, so the note HAS to clip —
                      but it is a sentence that appears on no other screen, and
                      clipped with nothing to hover it simply is not readable.
                      "Replacement sent for the return on order O-000016" loses
                      the order number, which is the whole of what issue 558
                      put there. Matches the three planning tables, which are
                      the only other truncated sentences in the console. */}
                  {movement.note === null ? null : (
                    <span className="truncate text-sm" title={movement.note}>
                      {movement.note}
                    </span>
                  )}
                </span>
              </td>

              <td className="hidden max-w-40 truncate @2xl:table-cell">
                {movement.warehouseName ?? '—'}
              </td>

              {/* Its own column from @sm up, where a row has the width for one.
                  Below that it rides in the Change cell above. */}
              <td className="hidden @sm:table-cell">
                <StandsNow movement={movement} onExplain={explain} />
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    );
  };

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar
        label="Filters for every change"
        search={
          <SearchInput
            size="sm"
            aria-label="Search changes by item"
            placeholder="Product name or code…"
            value={search}
            onValueChange={(next) => {
              setSearch(next);
              resetWindow();
            }}
          />
        }
        filters={filters}
        // A two-ended range is one question asked with two controls, which is
        // the case the values slot cannot express.
        controls={
          <>
            {/* `htmlFor`, not a label wrapped round the control: DayInput draws
                its half-typed warning as a sibling of the box, so the box is no
                longer the label's only child and the implicit association is
                gone. */}
            <label className="flex items-center gap-1.5" htmlFor="movements-from">
              <span className="text-sm whitespace-nowrap">From</span>
              <DayInput
                id="movements-from"
                size="sm"
                aria-label="Changes on or after"
                className="max-w-40"
                value={from}
                max={to || undefined}
                onValueChange={(value) => {
                  setFrom(value);
                  resetWindow();
                }}
              />
            </label>
            <label className="flex items-center gap-1.5" htmlFor="movements-to">
              <span className="text-sm whitespace-nowrap">To</span>
              <DayInput
                id="movements-to"
                size="sm"
                aria-label="Changes on or before"
                className="max-w-40"
                value={to}
                min={from || undefined}
                onValueChange={(value) => {
                  setTo(value);
                  resetWindow();
                }}
              />
            </label>
          </>
        }
        activeControls={(from ? 1 : 0) + (to ? 1 : 0)}
        views={{
          target: '/inventory/movements',
          params: viewParams,
          onApply: (next) => {
            setSearch(next.q ?? '');
            setFrom(next.from ?? '');
            setTo(next.to ?? '');
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
        {rows.length > 0 ? <RowOpenHint what="a row to open the item it changed" /> : null}
      </div>
    </div>
  );
}
