'use client';

// The cells of one reorder row. They are separate because a row carries four
// unrelated jobs — choosing it, naming it, sourcing it, and the numbers you
// compare down a column — and each wants reading on its own.

import { Badge, Checkbox } from '@wizeworks/silicaui-react';
import { formatCents, locationLabel } from './data';
import { coverSignal, leadTimeSignal, supplierLabel, type ReorderRow } from './reorder-data';

/** `max-w-0 w-full` makes this the cell that GIVES, so the truncation below
 *  actually bites and "To order" is never pushed off the right edge. */
export function ItemCell({ row, sells }: { row: ReorderRow; sells: string | null }) {
  return (
    <td className="w-full max-w-0">
      <span className="flex min-w-0 flex-col">
        <span className="truncate">{row.title ?? 'Untitled product'}</span>
        <span className="truncate font-mono text-sm">{row.sku ?? 'No code'}</span>
        {/* Columns that vanish on a narrow pane fold back in here — a reorder
            line without its place, its supplier or how fast it sells is half an
            answer. */}
        <span className="truncate text-sm @lg:hidden">{locationLabel(row)}</span>
        <span className="truncate text-sm @2xl:hidden">{supplierLabel(row)}</span>
        {sells ? <span className="truncate text-sm @xl:hidden">Sells {sells}</span> : null}
        {/* The whole calculation in one sentence — what turns "at risk £412"
            from an assertion into something a buyer can agree with. */}
        {row.reasoning ? <span className="truncate text-sm">{row.reasoning}</span> : null}
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
            : 'Cannot order this — it has no supplier yet'
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
        <span className="flex min-w-0 flex-col">
          <span className="truncate">{supplierLabel(row)}</span>
          <span className="truncate text-sm @3xl:hidden">{locationLabel(row)}</span>
        </span>
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
      <td className="hidden whitespace-nowrap @3xl:table-cell">
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
      <td className="hidden text-right tabular-nums @3xl:table-cell">
        {row.onOrder > 0 ? row.onOrder : '—'}
      </td>
      <td className="whitespace-nowrap">
        <Badge color={cover.tone} variant="soft" size="sm">
          {cover.label}
        </Badge>
      </td>
      {/* A number, not a badge. Zero reads as a dash — "£0.00" would look like a
          measurement of nothing, when it almost always means there is no
          deadline at all. */}
      <td className="text-right font-medium whitespace-nowrap tabular-nums">
        {row.revenueAtRiskCents > 0 ? formatCents(row.revenueAtRiskCents) : '—'}
      </td>
    </>
  );
}
