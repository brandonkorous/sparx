// The Items on an order: the lines, the button to add one, and the totals.

import { Button, Text } from '@wizeworks/silicaui-react';
import { faPlus } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { Table } from '../../components/table';
import { FormSection } from '../../components/form-section';
import { formatCents } from './data';
import type { PurchaseOrderPane } from './use-purchase-order-detail';
import { DraftLineRow, PlacedLineRow } from './purchase-order-item-rows';

function ItemsTable({ pane }: { pane: PurchaseOrderPane }) {
  const { editable, draft, detail, currency } = pane;
  return (
    <Table size="sm">
      <thead>
        <tr>
          <th>Item</th>
          <th className="text-right whitespace-nowrap">Qty</th>
          <th className="hidden text-right whitespace-nowrap @md:table-cell">Cost each</th>
          <th className="text-right whitespace-nowrap">Line total</th>
          {editable ? (
            <th className="w-0">
              <span className="sr-only">Actions</span>
            </th>
          ) : (
            <th className="whitespace-nowrap">Received</th>
          )}
        </tr>
      </thead>
      <tbody>
        {editable
          ? draft.lines.map((line, index) => (
              <DraftLineRow key={line.id ?? `new-${String(index)}`} pane={pane} line={line} />
            ))
          : (detail?.lines ?? []).map((line) => (
              <PlacedLineRow key={line.id} line={line} currency={currency} />
            ))}
      </tbody>
    </Table>
  );
}

function TotalRow({ label, amount, strong }: { label: string; amount: string; strong?: boolean }) {
  return (
    <div className="flex w-full max-w-xs items-baseline justify-between">
      <Text className={strong ? 'font-semibold' : 'text-sm'}>{label}</Text>
      <Text className={strong ? 'text-lg font-semibold tabular-nums' : 'tabular-nums'}>
        {amount}
      </Text>
    </div>
  );
}

/** Totals sit under the lines, right-aligned. */
function ItemTotals({ pane }: { pane: PurchaseOrderPane }) {
  const { draft, subtotal, total, currency } = pane;
  return (
    <div className="border-base-300 flex flex-col items-end gap-1 border-t pt-3">
      <TotalRow label="Items" amount={formatCents(subtotal, currency)} />
      {draft.header.freightCents > 0 ? (
        <TotalRow label="Freight" amount={formatCents(draft.header.freightCents, currency)} />
      ) : null}
      <TotalRow label="Total" amount={formatCents(total, currency)} strong />
    </div>
  );
}

function AddLineButton({ pane }: { pane: PurchaseOrderPane }) {
  const { supplierChosen } = pane;
  return (
    <Button
      size="sm"
      variant="outline"
      color="neutral"
      disabled={!supplierChosen}
      title={supplierChosen ? undefined : 'Choose a supplier first'}
      onClick={() => {
        pane.setEditing({ line: null });
      }}
    >
      <Icon glyph={faPlus} className="size-4" aria-hidden />
      Add a line
    </Button>
  );
}

export function ItemsSection({ pane }: { pane: PurchaseOrderPane }) {
  const { editable, draft, detail, supplierChosen } = pane;
  const shown = (editable ? draft.lines : (detail?.lines ?? [])).length > 0;
  return (
    <FormSection
      title="Items"
      description={
        editable
          ? 'What you are ordering, and the price you have agreed for each.'
          : 'What was ordered, and how much of each has arrived.'
      }
      action={editable ? <AddLineButton pane={pane} /> : null}
    >
      {draft.lines.length === 0 && editable ? (
        <Text className="text-sm">
          {supplierChosen
            ? 'No items yet. Add a line for each thing you are ordering.'
            : 'Choose a supplier above, then add the items you are ordering from them.'}
        </Text>
      ) : null}
      {shown ? <ItemsTable pane={pane} /> : null}
      {shown ? <ItemTotals pane={pane} /> : null}
    </FormSection>
  );
}
