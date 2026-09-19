'use client';

// The cells of one reorder row. They are separate because a row carries four
// unrelated jobs — choosing it, naming it, sourcing it, and the numbers you
// compare down a column — and each wants reading on its own.

import { Badge, Checkbox } from '@wizeworks/silicaui-react';
import { formatCents, locationLabel } from './data';
import { coverSignal, leadTimeSignal, supplierLabel, type ReorderRow } from './reorder-data';

/**
 * `max-w-0 w-full` makes this the cell that GIVES, so the truncation below
 * actually bites and "To order" is never pushed off the right edge.
 *
 * `min-w-56` is the floor under that give, and without it "gives" meant "gives
 * EVERYTHING". Measured on Juniper Row: this cell rendered at 140px the moment
 * Runs out and At risk appeared, 97px when Available joined them and 64px once
 * Supplier did — so it got WORSE as the pane got WIDER. 229px at 400px wide,
 * 64px at 800px wide. 56 is 224px, which holds the longest product code on that
 * account (185px) plus the cell's padding.
 */
export function ItemCell({ row, sells }: { row: ReorderRow; sells: string | null }) {
  const cover = coverSignal(row);
  const lead = leadTimeSignal(row);
  return (
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
        {sells ? <span className="truncate text-sm @xl:hidden">Sells {sells}</span> : null}
        {/* "Takes" and "On the way" arrive last as columns, so they fold back
            the longest. A buyer without the supplier's real lead time, or
            without what is already coming, is typing a quantity from half the
            facts. */}
        {lead ? <span className="truncate text-sm @6xl:hidden">Takes {lead.label}</span> : null}
        {row.onOrder > 0 ? (
          <span className="truncate text-sm @6xl:hidden">{row.onOrder} already on the way</span>
        ) : null}
        {/* The whole calculation in one sentence — what turns "at risk $412"
            from an assertion into something a buyer can agree with. */}
        {row.reasoning ? <span className="truncate text-sm">{row.reasoning}</span> : null}
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
  );
}

/** A control inside a clickable row: its clicks and its Space key must not also
 *  open the pane. */
export function ChooseCell({
  row,
  checked,
  onToggle,
}: {
  row: ReorderRow;
  checked: boolean;
  onToggle: (row: ReorderRow, on: boolean, modifiers: { shiftKey: boolean }) => void;
}) {
  const suppliable = row.supplierId !== null;
  return (
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
        checked={checked}
        disabled={!suppliable}
        onChange={(event) => {
          // The native event carries the modifier, so a shift-click arrives as
          // one gesture rather than as a click plus a guess.
          const shiftKey = (event.nativeEvent as MouseEvent | undefined)?.shiftKey === true;
          onToggle(row, event.target.checked, { shiftKey });
        }}
      />
    </td>
  );
}

export function SupplierCell({ row }: { row: ReorderRow }) {
  return (
    <td className="hidden max-w-40 @2xl:table-cell">
      {row.supplierId !== null ? (
        <span className="truncate">{supplierLabel(row)}</span>
      ) : (
        <Badge color="warning" variant="soft" size="sm">
          No supplier yet
        </Badge>
      )}
    </td>
  );
}

/** The numbers a buyer compares straight down a column. */
export function NumberCells({ row, sells }: { row: ReorderRow; sells: string | null }) {
  const cover = coverSignal(row);
  const lead = leadTimeSignal(row);
  return (
    <>
      <td className="hidden text-right tabular-nums @lg:table-cell">{row.available}</td>
      {/* Replaces "Reorder at". The trigger level is on the row's own calculation
          page; how long the supplier ACTUALLY takes, and whether that is measured
          or claimed, changes what to do now. */}
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
      {/* A number, not a badge. Zero reads as a dash — "$0.00" would look like a
          measurement of nothing, when it almost always means there is no
          deadline at all. */}
      <td className="hidden text-right font-medium whitespace-nowrap tabular-nums @4xl:table-cell">
        {row.revenueAtRiskCents > 0 ? formatCents(row.revenueAtRiskCents) : '—'}
      </td>
    </>
  );
}
