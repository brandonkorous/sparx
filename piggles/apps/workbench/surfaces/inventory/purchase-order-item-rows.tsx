// One row of the Items table: an editable draft line, or a placed line showing
// how much of it has arrived.

import type { ReactNode } from 'react';
import { Badge, Button } from '@wizeworks/silicaui-react';
import { faPencil, faTrashCan } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { formatCents } from './data';
import { describeQuantityShort } from './assembly-data';
import type { PurchaseOrderLine, PurchaseOrderLineDraft } from './purchase-orders-data';
import type { PurchaseOrderPane } from './use-purchase-order-detail';

type Shown = Pick<
  PurchaseOrderLineDraft,
  'description' | 'productTitle' | 'quantityOrdered' | 'uomCode' | 'unitsPerUom'
>;

/** Both readings, always: the pack count is how it was bought, the singles are what
 *  the ledger holds, and dropping either hides a wrong pack factor. */
function QuantityCell({ line }: { line: Shown }) {
  return (
    <td className="text-right tabular-nums">
      {describeQuantityShort({
        baseQuantity: line.quantityOrdered,
        uomCode: line.uomCode,
        unitsPerUom: line.unitsPerUom,
      })}
    </td>
  );
}

function ItemCell({ line, code }: { line: Shown; code: ReactNode }) {
  return (
    <td className="w-full max-w-0 min-w-56">
      <span className="flex min-w-0 flex-col">
        <span className="truncate">{line.description ?? line.productTitle ?? 'Item'}</span>
        <span className="truncate font-mono text-sm">{code}</span>
      </span>
    </td>
  );
}

function LineButtons({ pane, line }: { pane: PurchaseOrderPane; line: PurchaseOrderLineDraft }) {
  return (
    <div className="flex items-center justify-end gap-1">
      <Button
        size="sm"
        variant="ghost"
        color="neutral"
        shape="square"
        aria-label="Edit this line"
        onClick={() => {
          pane.setEditing({ line });
        }}
      >
        <Icon glyph={faPencil} className="size-4" aria-hidden />
      </Button>
      <Button
        size="sm"
        variant="ghost"
        color="danger"
        shape="square"
        aria-label="Remove this line"
        onClick={() => {
          pane.removeLine(line);
        }}
      >
        <Icon glyph={faTrashCan} className="size-4" aria-hidden />
      </Button>
    </div>
  );
}

export function DraftLineRow({
  pane,
  line,
}: {
  pane: PurchaseOrderPane;
  line: PurchaseOrderLineDraft;
}) {
  const code = (
    <>
      {line.variantSku ?? 'No code'}
      {line.supplierSku ? ` · ${line.supplierSku}` : ''}
    </>
  );
  return (
    <tr>
      <ItemCell line={line} code={code} />
      <QuantityCell line={line} />
      <td className="hidden text-right tabular-nums @md:table-cell">
        {formatCents(line.unitCostCents, pane.currency)}
      </td>
      <td className="text-right font-medium tabular-nums">
        {formatCents(line.quantityOrdered * line.unitCostCents, pane.currency)}
      </td>
      <td>
        <LineButtons pane={pane} line={line} />
      </td>
    </tr>
  );
}

export function PlacedLineRow({ line, currency }: { line: PurchaseOrderLine; currency: string }) {
  const complete = line.quantityReceived >= line.quantityOrdered;
  return (
    <tr>
      <ItemCell line={line} code={line.variantSku ?? 'No code'} />
      <QuantityCell line={line} />
      <td className="hidden text-right tabular-nums @md:table-cell">
        {formatCents(line.unitCostCents, currency)}
      </td>
      <td className="text-right font-medium tabular-nums">
        {formatCents(line.lineTotalCents, currency)}
      </td>
      <td className="whitespace-nowrap">
        <Badge color={complete ? 'success' : 'warning'} variant="soft" size="sm">
          {line.quantityReceived} of {line.quantityOrdered}
        </Badge>
      </td>
    </tr>
  );
}
